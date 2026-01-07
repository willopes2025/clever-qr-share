import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Search, Loader2, Users, UserPlus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export type ScrapeType = 'Followers' | 'Following';

interface InstagramSearchFormProps {
  onSearch: (usernames: string[], scrapeType: ScrapeType, limit: number) => void;
  isSearching: boolean;
}

export function InstagramSearchForm({ onSearch, isSearching }: InstagramSearchFormProps) {
  const [input, setInput] = useState("");
  const [scrapeType, setScrapeType] = useState<ScrapeType>("Followers");
  const [limit, setLimit] = useState(100);

  const handleSubmit = () => {
    const usernames = input
      .split(/[,\n]/)
      .map(u => u.trim().replace('@', ''))
      .filter(u => u.length > 0);
    
    onSearch(usernames, scrapeType, limit);
  };

  const usernameCount = input
    .split(/[,\n]/)
    .map(u => u.trim().replace('@', ''))
    .filter(u => u.length > 0).length;

  return (
    <div className="space-y-6">
      {/* Username Input */}
      <div className="space-y-2">
        <Label htmlFor="usernames">Perfis para Analisar</Label>
        <Textarea
          id="usernames"
          placeholder="@mrbeast&#10;@neymarjr&#10;&#10;ou separe por vírgula: mrbeast, neymarjr"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={4}
          className="font-mono text-sm"
        />
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{usernameCount} perfil(is) detectado(s)</span>
          <span className="text-xs">Máximo: 5 perfis por busca</span>
        </div>
      </div>

      {/* Scrape Type Selection */}
      <div className="space-y-3">
        <Label>Tipo de Extração</Label>
        <RadioGroup 
          value={scrapeType} 
          onValueChange={(v) => setScrapeType(v as ScrapeType)}
          className="flex gap-6"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="Followers" id="followers" />
            <Label htmlFor="followers" className="flex items-center gap-2 cursor-pointer font-normal">
              <Users className="h-4 w-4" />
              Seguidores
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="Following" id="following" />
            <Label htmlFor="following" className="flex items-center gap-2 cursor-pointer font-normal">
              <UserPlus className="h-4 w-4" />
              Seguindo
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Limit Input */}
      <div className="space-y-2">
        <Label htmlFor="limit">Limite por Perfil</Label>
        <div className="flex items-center gap-3">
          <Input
            id="limit"
            type="number"
            min={1}
            max={500}
            value={limit}
            onChange={(e) => setLimit(Math.min(500, Math.max(1, parseInt(e.target.value) || 100)))}
            className="w-32"
          />
          <span className="text-sm text-muted-foreground">(1-500 resultados por perfil)</span>
        </div>
      </div>

      <Alert>
        <Users className="h-4 w-4" />
        <AlertDescription>
          <strong>Custo estimado:</strong> ~$0.60 por 1.000 resultados. Apenas seguidores/seguidos de perfis 
          públicos serão extraídos. Os dados são armazenados em cache por 24 horas.
        </AlertDescription>
      </Alert>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          onClick={handleSubmit}
          disabled={isSearching || usernameCount === 0}
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
              Iniciar Scraping
            </>
          )}
        </Button>
        
        <Button
          variant="outline"
          onClick={() => {
            setInput("");
            setLimit(100);
          }}
          disabled={isSearching || (input.length === 0 && limit === 100)}
        >
          Limpar
        </Button>
      </div>
    </div>
  );
}
