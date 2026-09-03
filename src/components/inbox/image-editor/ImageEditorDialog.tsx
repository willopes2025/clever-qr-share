import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Undo2, Redo2, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { EditorToolbar } from './EditorToolbar';
import { canvasToFile, drawOp, fitWithinMaxEdge, loadImageFromFile, renderOps } from './draw';
import type { EditorOp, EditorTool, Point } from './types';

interface Props {
  open: boolean;
  file: File | null;
  onCancel: () => void;
  onDone: (file: File) => void;
}

interface DraftShape {
  start: Point;
  current: Point;
}

export const ImageEditorDialog = ({ open, file, onCancel, onDone }: Props) => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [baseSize, setBaseSize] = useState({ w: 0, h: 0 });
  const [ops, setOps] = useState<EditorOp[]>([]);
  const [redo, setRedo] = useState<EditorOp[]>([]);
  const [tool, setTool] = useState<EditorTool>('pen');
  const [color, setColor] = useState('#ef4444');
  const [width, setWidth] = useState(6);
  const [fontSize, setFontSize] = useState(36);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [display, setDisplay] = useState({ w: 0, h: 0, scale: 1 });
  const [textDraft, setTextDraft] = useState<{ x: number; y: number; value: string } | null>(null);
  const [cropRect, setCropRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderedRef = useRef<HTMLCanvasElement | null>(null);
  const strokeRef = useRef<Point[] | null>(null);
  const shapeRef = useRef<DraftShape | null>(null);
  const preferPngRef = useRef(false);

  // ---- load source image ----
  useEffect(() => {
    if (!open || !file) return;
    let cancelled = false;
    setLoading(true);
    setOps([]);
    setRedo([]);
    setCropRect(null);
    setTextDraft(null);
    preferPngRef.current = file.type === 'image/png' || file.type === 'image/webp';
    loadImageFromFile(file)
      .then((img) => {
        if (cancelled) return;
        const { w, h } = fitWithinMaxEdge(img.naturalWidth, img.naturalHeight);
        setImage(img);
        setBaseSize({ w, h });
      })
      .catch((err) => {
        console.error(err);
        toast.error('Não foi possível abrir a imagem para edição');
        onCancel();
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, file]);

  // ---- re-render the ops pipeline whenever the op list changes ----
  useEffect(() => {
    if (!image || !baseSize.w) return;
    renderedRef.current = renderOps(image, baseSize.w, baseSize.h, ops);
    setCropRect(null);
    paint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image, baseSize, ops]);

  // ---- fit rendered canvas inside the viewport ----
  const recomputeDisplay = useCallback(() => {
    const rendered = renderedRef.current;
    const container = containerRef.current;
    if (!rendered || !container) return;
    const maxW = container.clientWidth;
    const maxH = container.clientHeight;
    if (!maxW || !maxH) return;
    const scale = Math.min(maxW / rendered.width, maxH / rendered.height, 1);
    setDisplay({ w: Math.round(rendered.width * scale), h: Math.round(rendered.height * scale), scale });
  }, []);

  useLayoutEffect(() => {
    recomputeDisplay();
    const onResize = () => recomputeDisplay();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [recomputeDisplay, ops, image, baseSize, open]);

  // ---- paint visible canvas: rendered result + live draft + crop overlay ----
  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const rendered = renderedRef.current;
    if (!canvas || !rendered || !display.w) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(display.w * dpr);
    canvas.height = Math.round(display.h * dpr);
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const s = (display.w / rendered.width) * dpr;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.drawImage(rendered, 0, 0);

    // live previews
    if (strokeRef.current && strokeRef.current.length > 0) {
      drawOp(ctx, { type: 'stroke', points: strokeRef.current, color, width });
    }
    if (shapeRef.current) {
      const { start, current } = shapeRef.current;
      if (tool === 'rect') {
        drawOp(ctx, { type: 'rect', x0: start.x, y0: start.y, x1: current.x, y1: current.y, color, width });
      } else if (tool === 'arrow') {
        drawOp(ctx, { type: 'arrow', x0: start.x, y0: start.y, x1: current.x, y1: current.y, color, width });
      }
    }

    if (tool === 'crop' && cropRect && cropRect.w > 1 && cropRect.h > 1) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath();
      ctx.rect(0, 0, rendered.width, rendered.height);
      ctx.rect(cropRect.x, cropRect.y + cropRect.h, cropRect.w, -cropRect.h);
      ctx.fill('evenodd');
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2 / (display.w / rendered.width);
      ctx.strokeRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
      ctx.restore();
    }
  }, [display, color, width, tool, cropRect]);

  useEffect(() => {
    paint();
  }, [paint]);

  // ---- coordinate mapping ----
  const toImageCoords = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rendered = renderedRef.current!;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = rendered.width / rect.width;
    return {
      x: Math.max(0, Math.min(rendered.width, (e.clientX - rect.left) * ratio)),
      y: Math.max(0, Math.min(rendered.height, (e.clientY - rect.top) * ratio)),
    };
  };

  const pushOp = (op: EditorOp) => {
    setOps((prev) => [...prev, op]);
    setRedo([]);
  };

  // ---- pointer handlers ----
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!renderedRef.current || textDraft) return;
    const p = toImageCoords(e);
    e.currentTarget.setPointerCapture(e.pointerId);

    if (tool === 'text') {
      setTextDraft({ x: p.x, y: p.y, value: '' });
      return;
    }
    if (tool === 'pen') {
      strokeRef.current = [p];
      paint();
      return;
    }
    if (tool === 'crop') {
      shapeRef.current = { start: p, current: p };
      setCropRect({ x: p.x, y: p.y, w: 0, h: 0 });
      return;
    }
    shapeRef.current = { start: p, current: p };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!renderedRef.current) return;
    if (tool === 'pen' && strokeRef.current) {
      strokeRef.current = [...strokeRef.current, toImageCoords(e)];
      paint();
      return;
    }
    if (shapeRef.current) {
      const p = toImageCoords(e);
      shapeRef.current = { ...shapeRef.current, current: p };
      if (tool === 'crop') {
        const { start } = shapeRef.current;
        setCropRect({
          x: Math.min(start.x, p.x),
          y: Math.min(start.y, p.y),
          w: Math.abs(p.x - start.x),
          h: Math.abs(p.y - start.y),
        });
      } else {
        paint();
      }
    }
  };

  const handlePointerUp = () => {
    if (tool === 'pen' && strokeRef.current) {
      const points = strokeRef.current;
      strokeRef.current = null;
      if (points.length) pushOp({ type: 'stroke', points, color, width });
      return;
    }
    const shape = shapeRef.current;
    shapeRef.current = null;
    if (!shape) return;
    if (tool === 'crop') return; // waits for explicit confirmation
    const { start, current } = shape;
    if (Math.hypot(current.x - start.x, current.y - start.y) < 4) {
      paint();
      return;
    }
    if (tool === 'rect') {
      pushOp({ type: 'rect', x0: start.x, y0: start.y, x1: current.x, y1: current.y, color, width });
    } else if (tool === 'arrow') {
      pushOp({ type: 'arrow', x0: start.x, y0: start.y, x1: current.x, y1: current.y, color, width });
    }
  };

  // ---- actions ----
  const undo = useCallback(() => {
    setOps((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setRedo((r) => [...r, last]);
      return prev.slice(0, -1);
    });
  }, []);

  const redoAction = useCallback(() => {
    setRedo((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setOps((o) => [...o, last]);
      return prev.slice(0, -1);
    });
  }, []);

  const commitText = () => {
    if (!textDraft) return;
    const value = textDraft.value.trim();
    if (value) {
      pushOp({ type: 'text', x: textDraft.x, y: textDraft.y, text: textDraft.value, color, size: fontSize });
    }
    setTextDraft(null);
  };

  const applyCrop = () => {
    if (!cropRect || cropRect.w < 8 || cropRect.h < 8) {
      toast.error('Selecione uma área maior para cortar');
      return;
    }
    pushOp({ type: 'crop', ...cropRect });
    setTool('pen');
  };

  const handleDone = async () => {
    const rendered = renderedRef.current;
    if (!rendered || !file) return;
    setSaving(true);
    try {
      const edited = await canvasToFile(rendered, file.name, preferPngRef.current);
      onDone(edited);
    } catch (err) {
      console.error(err);
      toast.error('Falha ao aplicar as edições');
    } finally {
      setSaving(false);
    }
  };

  // ---- keyboard shortcuts ----
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (textDraft) {
        if (e.key === 'Escape') setTextDraft(null);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redoAction();
        else undo();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, undo, redoAction, onCancel, textDraft]);

  if (!open || !file) return null;

  const rendered = renderedRef.current;
  const textScreen = textDraft && rendered
    ? { left: (textDraft.x / rendered.width) * display.w, top: (textDraft.y / rendered.height) * display.h }
    : null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-neutral-950/97">
      {/* top bar */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-neutral-800">
        <Button
          variant="ghost"
          size="icon"
          onClick={onCancel}
          title="Cancelar edição"
          className="text-neutral-200 hover:bg-neutral-800 hover:text-neutral-50"
        >
          <X className="h-5 w-5" />
        </Button>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={undo}
            disabled={ops.length === 0}
            title="Desfazer"
            className="text-neutral-200 hover:bg-neutral-800 hover:text-neutral-50 disabled:opacity-30"
          >
            <Undo2 className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={redoAction}
            disabled={redo.length === 0}
            title="Refazer"
            className="text-neutral-200 hover:bg-neutral-800 hover:text-neutral-50 disabled:opacity-30"
          >
            <Redo2 className="h-5 w-5" />
          </Button>
        </div>

        <Button onClick={handleDone} disabled={saving || loading} size="sm" className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Concluir
        </Button>
      </div>

      {/* canvas area */}
      <div ref={containerRef} className="flex-1 min-h-0 flex items-center justify-center p-4 overflow-hidden">
        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin text-neutral-300" />
        ) : (
          <div className="relative" style={{ width: display.w || undefined, height: display.h || undefined }}>
            <canvas
              ref={canvasRef}
              style={{ width: display.w, height: display.h, touchAction: 'none' }}
              className="rounded-md shadow-2xl cursor-crosshair"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            />
            {textDraft && textScreen && (
              <input
                autoFocus
                value={textDraft.value}
                onChange={(e) => setTextDraft({ ...textDraft, value: e.target.value })}
                onBlur={commitText}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitText();
                  }
                }}
                placeholder="Digite…"
                style={{
                  left: textScreen.left,
                  top: textScreen.top,
                  color,
                  fontSize: Math.max(12, fontSize * (display.scale || 1)),
                }}
                className="absolute bg-transparent border border-dashed border-neutral-300 outline-none px-1 min-w-[80px] font-semibold"
              />
            )}
          </div>
        )}
      </div>

      {/* crop confirmation */}
      {tool === 'crop' && (
        <div className="flex items-center justify-center gap-2 pb-1">
          <span className="text-xs text-neutral-400 mr-2">Arraste sobre a imagem para selecionar a área</span>
          <Button size="sm" variant="secondary" onClick={() => setCropRect(null)} disabled={!cropRect}>
            Limpar
          </Button>
          <Button size="sm" onClick={applyCrop} disabled={!cropRect}>
            Aplicar corte
          </Button>
        </div>
      )}

      {/* toolbar */}
      <div className="border-t border-neutral-800">
        <EditorToolbar
          tool={tool}
          onToolChange={(t) => {
            commitText();
            setTool(t);
            setCropRect(null);
          }}
          color={color}
          onColorChange={setColor}
          width={width}
          onWidthChange={setWidth}
          fontSize={fontSize}
          onFontSizeChange={setFontSize}
          onRotate={() => pushOp({ type: 'rotate' })}
        />
      </div>
    </div>,
    document.body,
  );
};
