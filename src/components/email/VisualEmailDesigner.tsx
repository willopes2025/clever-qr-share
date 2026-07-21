import { useMemo, useState } from "react";
import { EmailDesign, EmailBlock, defaultDesign, newBlock, compileDesignToHtml } from "@/lib/email-design";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from "lucide-react";

interface Props {
  value: EmailDesign | null;
  onChange: (design: EmailDesign, html: string) => void;
  subject: string;
}

const BLOCK_LABEL: Record<EmailBlock["type"], string> = {
  header: "Cabeçalho",
  text: "Texto",
  image: "Imagem",
  button: "Botão",
  divider: "Divisor",
  columns: "2 Colunas",
  footer: "Rodapé",
};

export function VisualEmailDesigner({ value, onChange, subject }: Props) {
  const [design, setDesign] = useState<EmailDesign>(value ?? defaultDesign());
  const [selectedId, setSelectedId] = useState<string | null>(design.blocks[0]?.id ?? null);

  const html = useMemo(() => compileDesignToHtml(design, subject || "(sem assunto)"), [design, subject]);

  function update(next: EmailDesign) {
    setDesign(next);
    onChange(next, compileDesignToHtml(next, subject || "(sem assunto)"));
  }

  function updateBlock(id: string, patch: Partial<EmailBlock>) {
    update({ ...design, blocks: design.blocks.map(b => b.id === id ? { ...b, ...patch } as EmailBlock : b) });
  }
  function addBlock(type: EmailBlock["type"]) {
    const b = newBlock(type);
    update({ ...design, blocks: [...design.blocks, b] });
    setSelectedId(b.id);
  }
  function removeBlock(id: string) {
    const next = design.blocks.filter(b => b.id !== id);
    update({ ...design, blocks: next });
    if (selectedId === id) setSelectedId(next[0]?.id ?? null);
  }
  function move(id: string, dir: -1 | 1) {
    const idx = design.blocks.findIndex(b => b.id === id);
    if (idx < 0) return;
    const target = idx + dir;
    if (target < 0 || target >= design.blocks.length) return;
    const arr = [...design.blocks];
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    update({ ...design, blocks: arr });
  }
  function duplicate(id: string) {
    const b = design.blocks.find(x => x.id === id); if (!b) return;
    const copy = { ...b, id: crypto.randomUUID() } as EmailBlock;
    const idx = design.blocks.findIndex(x => x.id === id);
    const arr = [...design.blocks]; arr.splice(idx + 1, 0, copy);
    update({ ...design, blocks: arr });
  }

  const selected = design.blocks.find(b => b.id === selectedId) ?? null;

  return (
    <div className="grid grid-cols-[240px_1fr_280px] gap-3 h-[560px]">
      {/* Palette + blocks list */}
      <div className="border rounded-md overflow-hidden flex flex-col">
        <div className="p-2 border-b bg-muted/40">
          <div className="text-xs font-medium mb-1">Adicionar bloco</div>
          <Select onValueChange={(v) => addBlock(v as EmailBlock["type"])}>
            <SelectTrigger className="h-8"><SelectValue placeholder="Escolher..." /></SelectTrigger>
            <SelectContent>
              {(Object.keys(BLOCK_LABEL) as EmailBlock["type"][]).map(t => (
                <SelectItem key={t} value={t}>{BLOCK_LABEL[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {design.blocks.map((b, i) => (
            <div key={b.id}
              onClick={() => setSelectedId(b.id)}
              className={`p-2 rounded text-xs cursor-pointer border ${selectedId === b.id ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted"}`}>
              <div className="flex items-center justify-between">
                <span className="font-medium">{i + 1}. {BLOCK_LABEL[b.type]}</span>
                <div className="flex items-center gap-0.5">
                  <button onClick={(e) => { e.stopPropagation(); move(b.id, -1); }} className="p-0.5 hover:bg-muted rounded"><ArrowUp className="h-3 w-3" /></button>
                  <button onClick={(e) => { e.stopPropagation(); move(b.id, 1); }} className="p-0.5 hover:bg-muted rounded"><ArrowDown className="h-3 w-3" /></button>
                  <button onClick={(e) => { e.stopPropagation(); duplicate(b.id); }} className="p-0.5 hover:bg-muted rounded"><Copy className="h-3 w-3" /></button>
                  <button onClick={(e) => { e.stopPropagation(); removeBlock(b.id); }} className="p-0.5 hover:bg-muted rounded text-destructive"><Trash2 className="h-3 w-3" /></button>
                </div>
              </div>
            </div>
          ))}
          {design.blocks.length === 0 && <div className="text-xs text-muted-foreground p-2">Nenhum bloco. Adicione acima.</div>}
        </div>
        <div className="p-2 border-t space-y-2">
          <Label className="text-xs">Cor de fundo da página</Label>
          <Input type="color" value={design.bg} onChange={(e) => update({ ...design, bg: e.target.value })} className="h-8" />
          <Label className="text-xs">Cor do cartão</Label>
          <Input type="color" value={design.cardBg} onChange={(e) => update({ ...design, cardBg: e.target.value })} className="h-8" />
        </div>
      </div>

      {/* Preview */}
      <Card className="overflow-hidden">
        <iframe title="preview" srcDoc={html} className="w-full h-full border-0" />
      </Card>

      {/* Inspector */}
      <div className="border rounded-md overflow-y-auto p-3 space-y-2">
        {!selected && <div className="text-xs text-muted-foreground">Selecione um bloco para editar.</div>}
        {selected && <BlockInspector block={selected} onChange={(patch) => updateBlock(selected.id, patch)} />}
      </div>
    </div>
  );
}

function BlockInspector({ block, onChange }: { block: EmailBlock; onChange: (patch: Partial<EmailBlock>) => void }) {
  const color = (label: string, val: string, key: string) => (
    <div><Label className="text-xs">{label}</Label><Input type="color" value={val} onChange={(e) => onChange({ [key]: e.target.value } as any)} className="h-8" /></div>
  );
  switch (block.type) {
    case "header":
      return (<>
        <div><Label className="text-xs">Título</Label><Input value={block.title} onChange={e => onChange({ title: e.target.value } as any)} /></div>
        <div><Label className="text-xs">Subtítulo</Label><Input value={block.subtitle ?? ""} onChange={e => onChange({ subtitle: e.target.value } as any)} /></div>
        <div><Label className="text-xs">Logo URL</Label><Input value={block.logoUrl ?? ""} onChange={e => onChange({ logoUrl: e.target.value } as any)} /></div>
        {color("Cor de fundo", block.bgColor, "bgColor")}
        {color("Cor do texto", block.textColor, "textColor")}
      </>);
    case "text":
      return (<>
        <div><Label className="text-xs">Texto (use {"{{nome}}"})</Label>
          <Textarea rows={6} value={block.content} onChange={e => onChange({ content: e.target.value } as any)} /></div>
        <div><Label className="text-xs">Alinhamento</Label>
          <Select value={block.align ?? "left"} onValueChange={(v) => onChange({ align: v as any } as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="left">Esquerda</SelectItem><SelectItem value="center">Centro</SelectItem><SelectItem value="right">Direita</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </>);
    case "image":
      return (<>
        <div><Label className="text-xs">URL da imagem</Label><Input value={block.url} onChange={e => onChange({ url: e.target.value } as any)} /></div>
        <div><Label className="text-xs">Alt</Label><Input value={block.alt ?? ""} onChange={e => onChange({ alt: e.target.value } as any)} /></div>
        <div><Label className="text-xs">Link ao clicar</Label><Input value={block.href ?? ""} onChange={e => onChange({ href: e.target.value } as any)} /></div>
        <div><Label className="text-xs">Largura (px)</Label><Input type="number" value={block.width ?? 552} onChange={e => onChange({ width: Number(e.target.value) } as any)} /></div>
      </>);
    case "button":
      return (<>
        <div><Label className="text-xs">Rótulo</Label><Input value={block.label} onChange={e => onChange({ label: e.target.value } as any)} /></div>
        <div><Label className="text-xs">Link</Label><Input value={block.href} onChange={e => onChange({ href: e.target.value } as any)} /></div>
        {color("Cor de fundo", block.bgColor, "bgColor")}
        {color("Cor do texto", block.textColor, "textColor")}
        <div><Label className="text-xs">Alinhamento</Label>
          <Select value={block.align ?? "center"} onValueChange={(v) => onChange({ align: v as any } as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="left">Esquerda</SelectItem><SelectItem value="center">Centro</SelectItem><SelectItem value="right">Direita</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </>);
    case "divider":
      return color("Cor", block.color ?? "#e5e7eb", "color");
    case "columns":
      return (<>
        <div><Label className="text-xs">Coluna esquerda</Label><Textarea rows={4} value={block.left} onChange={e => onChange({ left: e.target.value } as any)} /></div>
        <div><Label className="text-xs">Coluna direita</Label><Textarea rows={4} value={block.right} onChange={e => onChange({ right: e.target.value } as any)} /></div>
      </>);
    case "footer":
      return <div><Label className="text-xs">Texto</Label><Textarea rows={3} value={block.text} onChange={e => onChange({ text: e.target.value } as any)} /></div>;
  }
}
