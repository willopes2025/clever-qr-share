import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Loader2, MessageCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface InstagramCommentsSearchFormProps {
  onSearch: (postUrls: string[], resultsLimit: number, includeReplies: boolean) => void;
  isSearching: boolean;
}

export function InstagramCommentsSearchForm({ onSearch, isSearching }: InstagramCommentsSearchFormProps) {
  const [input, setInput] = useState("");
  const [limit, setLimit] = useState(100);
  const [includeReplies, setIncludeReplies] = useState(true);

  const handleSubmit = () => {
    const urls = input
      .split(/[,\n]/)
      .map(u => u.trim())
      .filter(u => u.length > 0 && (u.includes('instagram.com') || u.startsWith('https://')));
    
    onSearch(urls, limit, includeReplies);
  };

  const urlCount = input
    .split(/[,\n]/)
    .map(u => u.trim())
    .filter(u => u.length > 0 && (u.includes('instagram.com') || u.startsWith('https://'))).length;

  return (
    <div className="space-y-6">
      {/* URL Input */}
      <div className="space-y-2">
        <Label htmlFor="post-urls">URLs de Postagens</Label>
        <Textarea
          id="post-urls"
          placeholder="https://instagram.com/p/ABC123&#10;https://instagram.com/reel/XYZ789&#10;&#10;Cole uma URL por linha ou separe por vírgula"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={4}
          className="font-mono text-sm"
        />
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{urlCount} URL(s) detectada(s)</span>
          <span className="text-xs">Máximo: 5 URLs por busca</span>
        </div>
      </div>

      {/* Limit Input */}
      <div className="space-y-2">
        <Label htmlFor="comments-limit">Limite de Comentários por Post</Label>
        <div className="flex items-center gap-3">
          <Input
            id="comments-limit"
            type="number"
            min={1}
            max={500}
            value={limit}
            onChange={(e) => setLimit(Math.min(500, Math.max(1, parseInt(e.target.value) || 100)))}
            className="w-32"
          />
          <span className="text-sm text-muted-foreground">(1-500 comentários por post)</span>
        </div>
      </div>

      {/* Include Replies Checkbox */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id="include-replies"
          checked={includeReplies}
          onCheckedChange={(checked) => setIncludeReplies(checked as boolean)}
        />
        <Label htmlFor="include-replies" className="cursor-pointer">
          Incluir respostas aos comentários
        </Label>
      </div>

      <Alert>
        <MessageCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Custo estimado:</strong> ~$2.30 por 1.000 comentários. 
          Os dados são armazenados em cache por 24 horas.
        </AlertDescription>
      </Alert>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          onClick={handleSubmit}
          disabled={isSearching || urlCount === 0}
          className="gap-2"
        >
          {isSearching ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Extraindo...
            </>
          ) : (
            <>
              <Search className="h-4 w-4" />
              Extrair Comentários
            </>
          )}
        </Button>
        
        <Button
          variant="outline"
          onClick={() => {
            setInput("");
            setLimit(100);
            setIncludeReplies(true);
          }}
          disabled={isSearching || (input.length === 0 && limit === 100)}
        >
          Limpar
        </Button>
      </div>
    </div>
  );
}
