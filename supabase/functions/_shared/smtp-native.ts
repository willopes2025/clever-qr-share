// Minimal native SMTP client using Deno TLS. Supports SSL (implicit) and STARTTLS.
// Sufficient for AUTH LOGIN + basic MAIL/RCPT/DATA send with a MIME message.

interface SmtpOptions {
  host: string;
  port: number;
  secure: boolean; // true = implicit TLS on connect (usually 465). false = STARTTLS on 587/25
  username: string;
  password: string;
  timeoutMs?: number;
}

interface SendOptions {
  from: string; // envelope from (email only)
  to: string[]; // envelope recipients (all: to+cc+bcc, email only)
  raw: string;  // full MIME message with headers + body
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function readResponse(reader: ReadableStreamDefaultReader<Uint8Array>, expectedFirstDigit = "2", timeoutMs = 15000): Promise<string> {
  let buf = "";
  const deadline = Date.now() + timeoutMs;
  while (true) {
    if (Date.now() > deadline) throw new Error(`SMTP timeout aguardando resposta (esperado ${expectedFirstDigit}xx)`);
    const { value, done } = await reader.read();
    if (done) throw new Error("SMTP conexão fechada pelo servidor");
    buf += decoder.decode(value);
    // Response complete when a line has "code<space>..." (not "code-...")
    const lines = buf.split(/\r?\n/).filter(l => l.length);
    const last = lines[lines.length - 1] ?? "";
    if (/^\d{3} /.test(last)) {
      if (!last.startsWith(expectedFirstDigit)) {
        throw new Error(`SMTP resposta inesperada: ${last}`);
      }
      return buf;
    }
  }
}

async function writeLine(writer: WritableStreamDefaultWriter<Uint8Array>, line: string) {
  await writer.write(encoder.encode(line + "\r\n"));
}

export async function sendMailSmtp(opts: SmtpOptions, msg: SendOptions): Promise<void> {
  const timeout = opts.timeoutMs ?? 20000;
  let conn: Deno.TlsConn | Deno.TcpConn;

  if (opts.secure) {
    conn = await Deno.connectTls({ hostname: opts.host, port: opts.port });
  } else {
    conn = await Deno.connect({ hostname: opts.host, port: opts.port });
  }

  let reader = conn.readable.getReader();
  let writer = conn.writable.getWriter();

  try {
    await readResponse(reader, "2", timeout); // greeting

    await writeLine(writer, `EHLO widezap.local`);
    const ehlo = await readResponse(reader, "2", timeout);

    // STARTTLS if plain
    if (!opts.secure) {
      if (!/STARTTLS/i.test(ehlo)) {
        throw new Error("Servidor SMTP não suporta STARTTLS");
      }
      await writeLine(writer, "STARTTLS");
      await readResponse(reader, "2", timeout);
      // release locks before upgrading
      reader.releaseLock();
      writer.releaseLock();
      const tlsConn = await Deno.startTls(conn as Deno.TcpConn, { hostname: opts.host });
      conn = tlsConn;
      reader = conn.readable.getReader();
      writer = conn.writable.getWriter();
      await writeLine(writer, `EHLO widezap.local`);
      await readResponse(reader, "2", timeout);
    }

    // AUTH LOGIN
    await writeLine(writer, "AUTH LOGIN");
    await readResponse(reader, "3", timeout);
    await writeLine(writer, btoa(opts.username));
    await readResponse(reader, "3", timeout);
    await writeLine(writer, btoa(opts.password));
    await readResponse(reader, "2", timeout);

    await writeLine(writer, `MAIL FROM:<${msg.from}>`);
    await readResponse(reader, "2", timeout);
    for (const r of msg.to) {
      await writeLine(writer, `RCPT TO:<${r}>`);
      await readResponse(reader, "2", timeout);
    }
    await writeLine(writer, "DATA");
    await readResponse(reader, "3", timeout);

    // Dot-stuff: any line starting with '.' must be doubled
    const body = msg.raw.replace(/\r?\n/g, "\r\n").replace(/\r\n\./g, "\r\n..");
    await writer.write(encoder.encode(body + "\r\n.\r\n"));
    await readResponse(reader, "2", timeout);

    try { await writeLine(writer, "QUIT"); } catch { /* ignore */ }
  } finally {
    try { reader.releaseLock(); } catch { /* ignore */ }
    try { writer.releaseLock(); } catch { /* ignore */ }
    try { conn.close(); } catch { /* ignore */ }
  }
}

export function buildSimpleMime(params: {
  fromName?: string | null;
  fromEmail: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html?: string | null;
  text?: string | null;
  inReplyTo?: string | null;
}): string {
  const fromHeader = params.fromName ? `${params.fromName} <${params.fromEmail}>` : params.fromEmail;
  const boundary = `_bnd_${crypto.randomUUID().replace(/-/g, "")}`;
  const msgId = `<${crypto.randomUUID()}@${params.fromEmail.split("@")[1] ?? "widezap.local"}>`;

  const headers: string[] = [
    `From: ${fromHeader}`,
    `To: ${params.to.join(", ")}`,
  ];
  if (params.cc?.length) headers.push(`Cc: ${params.cc.join(", ")}`);
  headers.push(`Subject: ${encodeSubject(params.subject)}`);
  headers.push(`Message-ID: ${msgId}`);
  headers.push(`Date: ${new Date().toUTCString()}`);
  headers.push(`MIME-Version: 1.0`);
  if (params.inReplyTo) {
    headers.push(`In-Reply-To: ${params.inReplyTo}`);
    headers.push(`References: ${params.inReplyTo}`);
  }

  const textPart = params.text ?? (params.html ? params.html.replace(/<[^>]+>/g, "") : "");
  const htmlPart = params.html ?? null;

  if (htmlPart) {
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    const body = [
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset=UTF-8`,
      `Content-Transfer-Encoding: 8bit`,
      ``,
      textPart,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: 8bit`,
      ``,
      htmlPart,
      ``,
      `--${boundary}--`,
      ``,
    ].join("\r\n");
    return headers.join("\r\n") + "\r\n" + body;
  } else {
    headers.push(`Content-Type: text/plain; charset=UTF-8`);
    headers.push(`Content-Transfer-Encoding: 8bit`);
    return headers.join("\r\n") + "\r\n\r\n" + textPart;
  }
}

function encodeSubject(s: string): string {
  // RFC 2047 encoded-word if non-ASCII
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(s)) return s;
  const b64 = btoa(unescape(encodeURIComponent(s)));
  return `=?UTF-8?B?${b64}?=`;
}
