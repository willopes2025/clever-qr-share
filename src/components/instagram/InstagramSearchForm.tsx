import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Search, Loader2, Instagram } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface InstagramSearchFormProps {
  onSearch: (usernames: string[]) => void;
  isSearching: boolean;
}

export function InstagramSearchForm({ onSearch, isSearching }: InstagramSearchFormProps) {
  const [input, setInput] = useState("");

  const handleSubmit = () => {
    // Parse usernames from input (comma or newline separated)
    const usernames = input
      .split(/[,\n]/)
      .map(u => u.trim().replace('@', ''))
      .filter(u => u.length > 0);
    
    onSearch(usernames);
  };

  const usernameCount = input
    .split(/[,\n]/)
    .map(u => u.trim().replace('@', ''))
    .filter(u => u.length > 0).length;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Textarea
          placeholder="@usuario1&#10;@usuario2&#10;usuario3&#10;&#10;ou separe por vírgula: usuario1, usuario2, usuario3"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={6}
          className="font-mono text-sm"
        />
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{usernameCount} username(s) detectado(s)</span>
          <span className="text-xs">Máximo: 10 por busca</span>
        </div>
      </div>

      <Alert>
        <Instagram className="h-4 w-4" />
        <AlertDescription>
          Apenas perfis públicos podem ser extraídos. Perfis privados serão ignorados.
          Os dados são armazenados em cache por 24 horas.
        </AlertDescription>
      </Alert>

      <div className="flex gap-2">
        <Button
          onClick={handleSubmit}
          disabled={isSearching || usernameCount === 0}
          className="gap-2"
        >
          {isSearching ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Buscando...
            </>
          ) : (
            <>
              <Search className="h-4 w-4" />
              Buscar Perfis
            </>
          )}
        </Button>
        
        <Button
          variant="outline"
          onClick={() => setInput("")}
          disabled={isSearching || input.length === 0}
        >
          Limpar
        </Button>
      </div>
    </div>
  );
}