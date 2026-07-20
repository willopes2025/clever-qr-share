// Minimal native-Deno IMAP client. Supports LOGIN, SELECT, UID SEARCH SINCE, UID FETCH BODY.PEEK[].
// Reliable inside the edge runtime where npm:imapflow trips on TLS handshakes with some hosts.

export interface ImapConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

export class NativeImap {
  private conn!: Deno.Conn;
  private buf = "";
  private counter = 0;
  private decoder = new TextDecoder("utf-8", { fatal: false });
  private encoder = new TextEncoder();

  constructor(private cfg: ImapConfig) {}

  private nextTag(): string {
    this.counter += 1;
    return `a${this.counter}`;
  }

  async connect(): Promise<void> {
    const p = this.cfg.secure
      ? Deno.connectTls({ hostname: this.cfg.host, port: this.cfg.port })
      : Deno.connect({ hostname: this.cfg.host, port: this.cfg.port });
    this.conn = (await Promise.race([
      p,
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("CONNECT_TIMEOUT")), 20000)),
    ])) as Deno.Conn;
    await this.readUntilServerReady();
    await this.command(`LOGIN "${this.escape(this.cfg.user)}" "${this.escape(this.cfg.pass)}"`);
  }

  private escape(s: string): string {
    return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  private async readChunk(timeoutMs = 15000): Promise<string> {
    const buf = new Uint8Array(65536);
    const n = await Promise.race([
      this.conn.read(buf),
      new Promise<null>((_, rej) => setTimeout(() => rej(new Error("READ_TIMEOUT")), timeoutMs)),
    ]);
    if (n == null || n === 0) throw new Error("CONNECTION_CLOSED");
    return this.decoder.decode(buf.subarray(0, n as number));
  }

  private async readUntilServerReady(): Promise<void> {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      this.buf += await this.readChunk(Math.max(500, deadline - Date.now()));
      if (/\*\s*OK[^\r\n]*\r\n/i.test(this.buf)) {
        // consume greeting
        this.buf = this.buf.replace(/^[\s\S]*?\*\s*OK[^\r\n]*\r\n/i, "");
        return;
      }
    }
    throw new Error("NO_GREETING");
  }

  /** Send a command and read until its tag completes. Returns the raw response. */
  async command(cmd: string, timeoutMs = 60000): Promise<string> {
    const tag = this.nextTag();
    await this.conn.write(this.encoder.encode(`${tag} ${cmd}\r\n`));
    const deadline = Date.now() + timeoutMs;
    // Response ends when we see a line starting with `${tag} OK|NO|BAD`
    const tagRe = new RegExp(`(^|\\n)${tag} (OK|NO|BAD)([^\\r\\n]*)\\r?\\n`, "i");
    while (Date.now() < deadline) {
      const m = this.buf.match(tagRe);
      if (m) {
        const end = m.index! + m[0].length;
        const chunk = this.buf.slice(0, end);
        this.buf = this.buf.slice(end);
        if (m[2].toUpperCase() !== "OK") throw new Error(`IMAP ${m[2]}: ${m[3].trim()}`);
        return chunk;
      }
      this.buf += await this.readChunk(Math.max(500, deadline - Date.now()));
    }
    throw new Error("COMMAND_TIMEOUT");
  }

  /** Handle FETCH which uses {n}\r\n literal blocks. Returns array of { uid, raw }. */
  async fetchRawByUids(uids: number[]): Promise<Array<{ uid: number; raw: Uint8Array }>> {
    if (uids.length === 0) return [];
    const tag = this.nextTag();
    const list = uids.join(",");
    await this.conn.write(this.encoder.encode(`${tag} UID FETCH ${list} (UID BODY.PEEK[])\r\n`));

    const results: Array<{ uid: number; raw: Uint8Array }> = [];
    // We need to parse literals. Work in bytes buffer.
    const bytesBuf: number[] = [];
    // seed with any leftover buf as bytes
    if (this.buf.length) {
      const seed = this.encoder.encode(this.buf);
      for (const b of seed) bytesBuf.push(b);
      this.buf = "";
    }
    const deadline = Date.now() + 120000;
    const tagLineRe = new RegExp(`(?:^|\\n)${tag} (OK|NO|BAD)([^\\r\\n]*)\\r?\\n`, "i");

    while (Date.now() < deadline) {
      // read some
      const chunkArr = new Uint8Array(65536);
      const n = await Promise.race([
        this.conn.read(chunkArr),
        new Promise<null>((_, rej) => setTimeout(() => rej(new Error("READ_TIMEOUT")), Math.max(500, deadline - Date.now()))),
      ]);
      if (n == null || n === 0) throw new Error("CONNECTION_CLOSED");
      for (let i = 0; i < (n as number); i++) bytesBuf.push(chunkArr[i]);

      // Try to parse
      // Convert to string only for scanning headers; but literals may contain binary.
      // Strategy: walk through buffer parsing untagged responses one by one.
      let progressed = true;
      while (progressed) {
        progressed = false;
        const asStr = new TextDecoder("latin1").decode(new Uint8Array(bytesBuf));
        // check tag completion
        const tagMatch = asStr.match(tagLineRe);
        // find start of an untagged FETCH response
        const fetchMatch = asStr.match(/\*\s+(\d+)\s+FETCH\s+\(([^)]*?)UID\s+(\d+)[^)]*?BODY\[\]\s+\{(\d+)\}\r\n/i);
        if (fetchMatch) {
          const uid = parseInt(fetchMatch[3], 10);
          const literalLen = parseInt(fetchMatch[4], 10);
          const headerEnd = fetchMatch.index! + fetchMatch[0].length;
          const literalStart = headerEnd;
          if (bytesBuf.length < literalStart + literalLen + 3) {
            // need more data
            break;
          }
          const raw = new Uint8Array(bytesBuf.slice(literalStart, literalStart + literalLen));
          results.push({ uid, raw });
          // consume up through the closing ')\r\n' after literal
          const after = literalStart + literalLen;
          // find next \r\n after `)`
          const afterStr = new TextDecoder("latin1").decode(new Uint8Array(bytesBuf.slice(after, after + 32)));
          const closeMatch = afterStr.match(/^\s*\)\s*\r\n/);
          const consumeEnd = after + (closeMatch ? closeMatch[0].length : 0);
          bytesBuf.splice(0, consumeEnd);
          progressed = true;
          continue;
        }
        if (tagMatch) {
          const end = (tagMatch.index ?? 0) + tagMatch[0].length;
          bytesBuf.splice(0, end);
          if (tagMatch[1].toUpperCase() !== "OK") throw new Error(`IMAP ${tagMatch[1]}: ${tagMatch[2].trim()}`);
          return results;
        }
      }
    }
    throw new Error("FETCH_TIMEOUT");
  }

  async logout(): Promise<void> {
    try { await this.conn.write(this.encoder.encode(`X LOGOUT\r\n`)); } catch { /* ignore */ }
    try { this.conn.close(); } catch { /* ignore */ }
  }
}

/** Parse untagged * SEARCH lines from a response into UIDs. */
export function parseSearchUids(resp: string): number[] {
  const m = resp.match(/\*\s+SEARCH([^\r\n]*)/i);
  if (!m) return [];
  return m[1].trim().split(/\s+/).filter(Boolean).map((n) => parseInt(n, 10)).filter((n) => !Number.isNaN(n));
}

/** IMAP date literal like "1-Jan-2025". */
export function imapDate(d: Date): string {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${d.getUTCDate()}-${months[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
}
