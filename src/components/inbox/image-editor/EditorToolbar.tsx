import { Pen, Type, Square, Circle, Minus, ArrowUpRight, Crop, RotateCw, Shapes, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { EDITOR_COLORS, type EditorTool, type ShapeKind } from './types';

interface Props {
  tool: EditorTool;
  onToolChange: (t: EditorTool) => void;
  shape: ShapeKind;
  onShapeChange: (s: ShapeKind) => void;
  color: string;
  onColorChange: (c: string) => void;
  width: number;
  onWidthChange: (w: number) => void;
  fontSize: number;
  onFontSizeChange: (s: number) => void;
  onRotate: () => void;
}

const SHAPES: { id: ShapeKind; icon: React.ElementType; label: string }[] = [
  { id: 'rect', icon: Square, label: 'Retângulo' },
  { id: 'ellipse', icon: Circle, label: 'Círculo' },
  { id: 'line', icon: Minus, label: 'Linha' },
  { id: 'arrow', icon: ArrowUpRight, label: 'Seta' },
];

export const EditorToolbar = ({
  tool,
  onToolChange,
  shape,
  onShapeChange,
  color,
  onColorChange,
  width,
  onWidthChange,
  fontSize,
  onFontSizeChange,
  onRotate,
}: Props) => {
  const ActiveShapeIcon = SHAPES.find((s) => s.id === shape)?.icon ?? Shapes;

  const btn = (active: boolean) =>
    cn(
      'h-10 w-10 text-neutral-200 hover:bg-neutral-800 hover:text-neutral-50',
      active && 'bg-neutral-700 text-neutral-50',
    );

  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      <div className="flex flex-wrap items-center justify-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Desenho livre"
          aria-label="Desenho livre"
          aria-pressed={tool === 'pen'}
          onClick={() => onToolChange('pen')}
          className={btn(tool === 'pen')}
        >
          <Pen className="h-5 w-5" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Texto"
          aria-label="Texto"
          aria-pressed={tool === 'text'}
          onClick={() => onToolChange('text')}
          className={btn(tool === 'text')}
        >
          <Type className="h-5 w-5" />
        </Button>

        {/* Unified shapes button */}
        <Popover>
          <div className={cn('flex items-center rounded-md', tool === 'shape' && 'bg-neutral-700')}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title="Formas"
              aria-label="Formas"
              aria-pressed={tool === 'shape'}
              onClick={() => onToolChange('shape')}
              className={cn('h-10 w-10 text-neutral-200 hover:bg-neutral-800 hover:text-neutral-50', tool === 'shape' && 'text-neutral-50')}
            >
              <ActiveShapeIcon className="h-5 w-5" />
            </Button>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title="Escolher forma"
                aria-label="Escolher forma"
                className="h-10 w-5 text-neutral-300 hover:bg-neutral-800 hover:text-neutral-50"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
          </div>
          <PopoverContent side="top" align="center" className="z-[200] w-auto p-1 flex gap-1 bg-neutral-900 border-neutral-700">
            {SHAPES.map(({ id, icon: Icon, label }) => (
              <Button
                key={id}
                type="button"
                variant="ghost"
                size="icon"
                title={label}
                aria-label={label}
                aria-pressed={shape === id}
                onClick={() => {
                  onShapeChange(id);
                  onToolChange('shape');
                }}
                className={btn(shape === id && tool === 'shape')}
              >
                <Icon className="h-5 w-5" />
              </Button>
            ))}
          </PopoverContent>
        </Popover>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Cortar"
          aria-label="Cortar"
          aria-pressed={tool === 'crop'}
          onClick={() => onToolChange('crop')}
          className={btn(tool === 'crop')}
        >
          <Crop className="h-5 w-5" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Girar 90°"
          aria-label="Girar 90°"
          onClick={onRotate}
          className="h-10 w-10 text-neutral-200 hover:bg-neutral-800 hover:text-neutral-50"
        >
          <RotateCw className="h-5 w-5" />
        </Button>
      </div>

      {tool !== 'crop' && (
        <div className="flex flex-wrap items-center justify-center gap-4">
          <div className="flex items-center gap-1.5">
            {EDITOR_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                title={c}
                aria-label={`Cor ${c}`}
                onClick={() => onColorChange(c)}
                style={{ backgroundColor: c }}
                className={cn(
                  'h-6 w-6 rounded-full border border-neutral-500 transition-transform',
                  color === c && 'scale-125 ring-2 ring-neutral-100',
                )}
              />
            ))}
          </div>

          <div className="flex items-center gap-2 min-w-[160px]">
            <span className="text-xs text-neutral-300 whitespace-nowrap">
              {tool === 'text' ? 'Tamanho' : 'Espessura'}
            </span>
            {tool === 'text' ? (
              <Slider
                value={[fontSize]}
                min={12}
                max={120}
                step={2}
                onValueChange={([v]) => onFontSizeChange(v)}
                className="w-28"
              />
            ) : (
              <Slider
                value={[width]}
                min={2}
                max={24}
                step={1}
                onValueChange={([v]) => onWidthChange(v)}
                className="w-28"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
