import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Search, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

interface DeletionRequest {
  id: string;
  email: string;
  status: string;
  created_at: string;
  processed_at: string | null;
  confirmation_code: string;
}

const DataDeletionCallback = () => {
  const [searchParams] = useSearchParams();
  const [code, setCode] = useState(searchParams.get('code') || "");
  const [isSearching, setIsSearching] = useState(false);
  const [request, setRequest] = useState<DeletionRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (searchParams.get('code')) {
      handleSearch();
    }
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (!code.trim()) {
      setError("Por favor, informe o código de confirmação.");
      return;
    }

    setIsSearching(true);
    setError(null);
    setHasSearched(true);

    try {
      const { data, error: queryError } = await supabase
        .from('data_deletion_requests')
        .select('id, email, status, created_at, processed_at, confirmation_code')
        .eq('confirmation_code', code.trim())
        .single();

      if (queryError) {
        if (queryError.code === 'PGRST116') {
          setError("Nenhuma solicitação encontrada com este código.");
          setRequest(null);
        } else {
          throw queryError;
        }
      } else {
        setRequest(data);
      }
    } catch (err: any) {
      console.error('Error searching deletion request:', err);
      setError("Ocorreu um erro ao buscar a solicitação. Tente novamente.");
      setRequest(null);
    } finally {
      setIsSearching(false);
    }
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          label: 'Pendente',
          description: 'Sua solicitação está na fila para processamento.',
          icon: Clock,
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-500/10',
        };
      case 'processing':
        return {
          label: 'Em Processamento',
          description: 'Sua solicitação está sendo processada pela nossa equipe.',
          icon: Loader2,
          color: 'text-blue-500',
          bgColor: 'bg-blue-500/10',
        };
      case 'completed':
        return {
          label: 'Concluída',
          description: 'Seus dados foram excluídos com sucesso.',
          icon: CheckCircle2,
          color: 'text-green-500',
          bgColor: 'bg-green-500/10',
        };
      case 'rejected':
        return {
          label: 'Rejeitada',
          description: 'Sua solicitação não pôde ser processada. Entre em contato para mais detalhes.',
          icon: XCircle,
          color: 'text-red-500',
          bgColor: 'bg-red-500/10',
        };
      default:
        return {
          label: 'Desconhecido',
          description: 'Status não reconhecido.',
          icon: Clock,
          color: 'text-muted-foreground',
          bgColor: 'bg-muted',
        };
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              <span className="font-semibold">Status da Exclusão</span>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8 max-w-xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Verificar Status</h1>
          <p className="text-muted-foreground">
            Informe o código de confirmação para verificar o status da sua solicitação de exclusão de dados.
          </p>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 mb-8">
          <form onSubmit={handleSearch} className="space-y-4">
            <div>
              <Label htmlFor="code">Código de Confirmação</Label>
              <Input
                id="code"
                type="text"
                placeholder="Ex: abc123def456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="mt-1 font-mono"
              />
            </div>

            <Button type="submit" className="w-full" disabled={isSearching}>
              {isSearching ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Buscando...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Buscar
                </>
              )}
            </Button>
          </form>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 mb-8">
            <p className="text-destructive text-center">{error}</p>
          </div>
        )}

        {request && (
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-lg font-semibold text-foreground mb-6">Detalhes da Solicitação</h2>
            
            {(() => {
              const statusInfo = getStatusInfo(request.status);
              const StatusIcon = statusInfo.icon;
              
              return (
                <div className={`${statusInfo.bgColor} rounded-lg p-4 mb-6`}>
                  <div className="flex items-center gap-3">
                    <StatusIcon className={`h-6 w-6 ${statusInfo.color} ${request.status === 'processing' ? 'animate-spin' : ''}`} />
                    <div>
                      <p className={`font-semibold ${statusInfo.color}`}>{statusInfo.label}</p>
                      <p className="text-sm text-muted-foreground">{statusInfo.description}</p>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-muted-foreground">Código</span>
                <span className="font-mono text-foreground">{request.confirmation_code}</span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-muted-foreground">E-mail</span>
                <span className="text-foreground">{request.email}</span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-muted-foreground">Data da Solicitação</span>
                <span className="text-foreground">
                  {new Date(request.created_at).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              
              {request.processed_at && (
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-muted-foreground">Data de Processamento</span>
                  <span className="text-foreground">
                    {new Date(request.processed_at).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground mt-6">
              Prazo de processamento: até 15 dias úteis após a solicitação.
              Em caso de dúvidas, entre em contato através de privacidade@seudominio.com
            </p>
          </div>
        )}

        {hasSearched && !request && !error && (
          <div className="text-center text-muted-foreground">
            <p>Nenhum resultado encontrado.</p>
          </div>
        )}

        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            Precisa fazer uma nova solicitação?{" "}
            <Link to="/data-deletion" className="text-primary hover:underline">
              Solicitar exclusão
            </Link>
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 mt-12">
        <div className="container mx-auto px-4 text-center text-muted-foreground text-sm">
          <p>© {new Date().getFullYear()} Sua Empresa. Todos os direitos reservados.</p>
          <div className="flex justify-center gap-4 mt-2">
            <Link to="/privacy" className="hover:text-primary">Política de Privacidade</Link>
            <Link to="/terms" className="hover:text-primary">Termos de Serviço</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default DataDeletionCallback;
