// Client-side video compression using HTMLVideoElement + MediaRecorder.
// Used to keep WhatsApp video uploads under the 16 MB hard limit.

const WA_VIDEO_MAX_BYTES = 16 * 1024 * 1024;

export interface CompressOptions {
  targetBytes?: number;        // default: 15 MB (safety margin under 16 MB)
  maxDimension?: number;       // default: 720 (longest side)
  audioBitrate?: number;       // default: 96 kbps
  minVideoBitrate?: number;    // default: 150 kbps
  onProgress?: (ratio: number) => void; // 0..1
}

function pickMimeType(): { mimeType: string; ext: string } {
  const candidates: Array<{ mimeType: string; ext: string }> = [
    { mimeType: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', ext: 'mp4' },
    { mimeType: 'video/mp4;codecs=h264,aac', ext: 'mp4' },
    { mimeType: 'video/mp4', ext: 'mp4' },
    { mimeType: 'video/webm;codecs=vp9,opus', ext: 'webm' },
    { mimeType: 'video/webm;codecs=vp8,opus', ext: 'webm' },
    { mimeType: 'video/webm', ext: 'webm' },
  ];
  for (const c of candidates) {
    try {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c.mimeType)) {
        return c;
      }
    } catch {
      // ignore
    }
  }
  return { mimeType: 'video/webm', ext: 'webm' };
}

export async function compressVideo(file: File, opts: CompressOptions = {}): Promise<File> {
  const targetBytes = opts.targetBytes ?? Math.floor(WA_VIDEO_MAX_BYTES * 0.93);
  const maxDimension = opts.maxDimension ?? 720;
  const audioBitrate = opts.audioBitrate ?? 96_000;
  const minVideoBitrate = opts.minVideoBitrate ?? 150_000;
  const { mimeType, ext } = pickMimeType();

  return new Promise<File>((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    (video as HTMLVideoElement & { playsInline?: boolean }).playsInline = true;
    video.preload = 'auto';
    video.crossOrigin = 'anonymous';
    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;

    const cleanup = () => {
      try { URL.revokeObjectURL(objectUrl); } catch { /* noop */ }
    };

    video.onerror = () => {
      cleanup();
      reject(new Error('Não foi possível ler o vídeo para compressão'));
    };

    video.onloadedmetadata = async () => {
      try {
        const duration = video.duration;
        if (!isFinite(duration) || duration <= 0) {
          throw new Error('Duração do vídeo inválida');
        }

        // Bitrate target. Reserve room for audio + container overhead.
        const overheadFactor = 0.95;
        const totalBits = targetBytes * 8 * overheadFactor;
        const videoBitrate = Math.max(minVideoBitrate, Math.floor(totalBits / duration) - audioBitrate);

        // Scale down dimensions if needed (longest side -> maxDimension).
        const srcW = video.videoWidth || 1280;
        const srcH = video.videoHeight || 720;
        const scale = Math.min(1, maxDimension / Math.max(srcW, srcH));
        const w = Math.max(2, Math.floor((srcW * scale) / 2) * 2);
        const h = Math.max(2, Math.floor((srcH * scale) / 2) * 2);

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas indisponível');

        const fps = 24;
        const canvasStream = canvas.captureStream(fps);

        // Try to capture audio from the source video.
        try {
          const vWithCapture = video as HTMLVideoElement & {
            captureStream?: () => MediaStream;
            mozCaptureStream?: () => MediaStream;
          };
          const capture = vWithCapture.captureStream?.bind(vWithCapture) || vWithCapture.mozCaptureStream?.bind(vWithCapture);
          if (capture) {
            const srcStream = capture();
            srcStream.getAudioTracks().forEach((t) => canvasStream.addTrack(t));
          }
        } catch {
          // No audio support — proceed silently
        }

        let recorder: MediaRecorder;
        try {
          recorder = new MediaRecorder(canvasStream, {
            mimeType,
            videoBitsPerSecond: videoBitrate,
            audioBitsPerSecond: audioBitrate,
          });
        } catch {
          recorder = new MediaRecorder(canvasStream, { videoBitsPerSecond: videoBitrate });
        }

        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };

        const finish = () => {
          try {
            const outType = recorder.mimeType || mimeType;
            const blob = new Blob(chunks, { type: outType });
            const baseName = file.name.replace(/\.[^.]+$/, '') || 'video';
            const out = new File([blob], `${baseName}-compressed.${ext}`, { type: outType });
            cleanup();
            resolve(out);
          } catch (err) {
            cleanup();
            reject(err);
          }
        };

        recorder.onstop = finish;
        recorder.onerror = (e) => {
          cleanup();
          reject((e as ErrorEvent).error || new Error('Falha durante a compressão'));
        };

        let rafId = 0;
        const drawLoop = () => {
          if (video.paused || video.ended) return;
          try {
            ctx.drawImage(video, 0, 0, w, h);
          } catch {
            // ignore frame draw error
          }
          if (opts.onProgress) {
            opts.onProgress(Math.min(1, video.currentTime / duration));
          }
          rafId = requestAnimationFrame(drawLoop);
        };

        video.onended = () => {
          cancelAnimationFrame(rafId);
          // small delay to ensure last frame is captured
          setTimeout(() => {
            if (recorder.state !== 'inactive') recorder.stop();
          }, 120);
        };

        recorder.start(500);
        await video.play();
        drawLoop();
      } catch (err) {
        cleanup();
        reject(err);
      }
    };
  });
}

export const WHATSAPP_VIDEO_LIMIT_BYTES = WA_VIDEO_MAX_BYTES;
