import { Pen, Type, Square, ArrowUpRight, Crop, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { EDITOR_COLORS, type EditorTool } from './types';

interface Props {
  tool: EditorTool;
  onToolChange: (t: EditorTool) => void;
  color: string;
  onColorChange: (c: string) => void;
  width: number;
  onWidthChange: (w: number) => void;
  fontSize: number;
  onFontSizeChange: (s: number) => void;
  onRotate: () => void;
}

const TOOLS: { id: EditorTool; icon: React.ElementType; label: string }[] = [
  { id: 'pen', icon: Pen, label: 'Desenho livre' },
  { id: 'text', icon: Type, label: 'Texto' },
  { id: 'rect', icon: Square, label: 'Retângulo' },
  { id: 'arrow', icon: ArrowUpRight, label: 'Seta' },
  { id: 'crop', icon: Crop, label: 'Cortar' },
];

export const EditorToolbar = ({
  tool,
  onToolChange,
  color,
  onColorChange,
  width,
  onWidthChange,
  fontSize,
  onFontSizeChange,
  onRotate,
}: Props) => {
  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      <div className="flex flex-wrap items-center justify-center gap-1">
        {TOOLS.map(({ id, icon: Icon, label }) => (
          <Button
            key={id}
            type="button"
            variant="ghost"
            size="icon"
            title={label}
            aria-label={label}
            aria-pressed={tool === id}
            onClick={() => onToolChange(id)}
            className={cn(
              'h-10 w-10 text-background/80 hover:bg-background/15 hover:text-background',
              tool === id && 'bg-background/20 text-background',
            )}
          >
            <Icon className="h-5 w-5" />
          </Button>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Girar 90°"
          aria-label="Girar 90°"
          onClick={onRotate}
          className="h-10 w-10 text-background/80 hover:bg-background/15 hover:text-background"
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
                  'h-6 w-6 rounded-full border border-background/40 transition-transform',
                  color === c && 'scale-125 ring-2 ring-background',
                )}
              />
            ))}
          </div>

          <div className="flex items-center gap-2 min-w-[160px]">
            <span className="text-xs text-background/70 whitespace-nowrap">
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
