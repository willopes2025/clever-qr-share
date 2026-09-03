import type { EditorOp, StrokeOp, RectOp, ArrowOp, TextOp } from './types';

export const MAX_EDGE = 4096;

function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function drawStroke(ctx: CanvasRenderingContext2D, op: StrokeOp) {
  if (op.points.length === 0) return;
  ctx.save();
  ctx.strokeStyle = op.color;
  ctx.lineWidth = op.width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (op.points.length === 1) {
    // Single tap: render a dot
    ctx.arc(op.points[0].x, op.points[0].y, op.width / 2, 0, Math.PI * 2);
    ctx.fillStyle = op.color;
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.moveTo(op.points[0].x, op.points[0].y);
  for (let i = 1; i < op.points.length - 1; i++) {
    const mid = {
      x: (op.points[i].x + op.points[i + 1].x) / 2,
      y: (op.points[i].y + op.points[i + 1].y) / 2,
    };
    ctx.quadraticCurveTo(op.points[i].x, op.points[i].y, mid.x, mid.y);
  }
  const last = op.points[op.points.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
  ctx.restore();
}

function drawRect(ctx: CanvasRenderingContext2D, op: RectOp) {
  ctx.save();
  ctx.strokeStyle = op.color;
  ctx.lineWidth = op.width;
  ctx.lineJoin = 'round';
  ctx.strokeRect(
    Math.min(op.x0, op.x1),
    Math.min(op.y0, op.y1),
    Math.abs(op.x1 - op.x0),
    Math.abs(op.y1 - op.y0),
  );
  ctx.restore();
}

function drawArrow(ctx: CanvasRenderingContext2D, op: ArrowOp) {
  ctx.save();
  ctx.strokeStyle = op.color;
  ctx.fillStyle = op.color;
  ctx.lineWidth = op.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const angle = Math.atan2(op.y1 - op.y0, op.x1 - op.x0);
  const len = Math.hypot(op.x1 - op.x0, op.y1 - op.y0);
  const head = Math.max(op.width * 3.5, Math.min(len * 0.35, op.width * 8));

  ctx.beginPath();
  ctx.moveTo(op.x0, op.y0);
  ctx.lineTo(op.x1, op.y1);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(op.x1, op.y1);
  ctx.lineTo(op.x1 - head * Math.cos(angle - Math.PI / 7), op.y1 - head * Math.sin(angle - Math.PI / 7));
  ctx.moveTo(op.x1, op.y1);
  ctx.lineTo(op.x1 - head * Math.cos(angle + Math.PI / 7), op.y1 - head * Math.sin(angle + Math.PI / 7));
  ctx.stroke();
  ctx.restore();
}

function drawText(ctx: CanvasRenderingContext2D, op: TextOp) {
  ctx.save();
  ctx.font = `600 ${op.size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textBaseline = 'top';
  ctx.fillStyle = op.color;
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = Math.max(2, op.size / 8);
  const lines = op.text.split('\n');
  lines.forEach((line, i) => {
    ctx.fillText(line, op.x, op.y + i * op.size * 1.2);
  });
  ctx.restore();
}

export function drawOp(ctx: CanvasRenderingContext2D, op: EditorOp) {
  switch (op.type) {
    case 'stroke':
      return drawStroke(ctx, op);
    case 'rect':
      return drawRect(ctx, op);
    case 'arrow':
      return drawArrow(ctx, op);
    case 'text':
      return drawText(ctx, op);
    default:
      return;
  }
}

/**
 * Renders the base image plus the ordered op list into a fresh canvas.
 * `rotate` and `crop` rebuild the canvas (and therefore the coordinate space),
 * so ops recorded afterwards are already in the new space.
 */
export function renderOps(base: CanvasImageSource, baseW: number, baseH: number, ops: EditorOp[]): HTMLCanvasElement {
  let canvas = makeCanvas(baseW, baseH);
  let ctx = canvas.getContext('2d')!;
  ctx.drawImage(base, 0, 0, baseW, baseH);

  for (const op of ops) {
    if (op.type === 'rotate') {
      const next = makeCanvas(canvas.height, canvas.width);
      const nctx = next.getContext('2d')!;
      nctx.translate(next.width / 2, next.height / 2);
      nctx.rotate(Math.PI / 2);
      nctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
      canvas = next;
      ctx = nctx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    } else if (op.type === 'crop') {
      const x = Math.max(0, Math.round(op.x));
      const y = Math.max(0, Math.round(op.y));
      const w = Math.max(1, Math.min(Math.round(op.w), canvas.width - x));
      const h = Math.max(1, Math.min(Math.round(op.h), canvas.height - y));
      const next = makeCanvas(w, h);
      const nctx = next.getContext('2d')!;
      nctx.drawImage(canvas, x, y, w, h, 0, 0, w, h);
      canvas = next;
      ctx = nctx;
    } else {
      drawOp(ctx, op);
    }
  }

  return canvas;
}

export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não foi possível carregar a imagem'));
    };
    img.src = url;
  });
}

export function fitWithinMaxEdge(w: number, h: number) {
  const longest = Math.max(w, h);
  if (longest <= MAX_EDGE) return { w, h };
  const ratio = MAX_EDGE / longest;
  return { w: Math.round(w * ratio), h: Math.round(h * ratio) };
}

export function canvasToFile(canvas: HTMLCanvasElement, name: string, preferPng: boolean): Promise<File> {
  const mime = preferPng ? 'image/png' : 'image/jpeg';
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('Falha ao gerar a imagem editada'));
        const base = name.replace(/\.[^.]+$/, '') || 'imagem';
        const ext = preferPng ? 'png' : 'jpg';
        resolve(new File([blob], `${base}.${ext}`, { type: mime }));
      },
      mime,
      0.92,
    );
  });
}
