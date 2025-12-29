import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Trash2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const DataDeletion = () => {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      toast({
        title: "E-mail obrigatório",
        description: "Por favor, informe seu e-mail para solicitar a exclusão.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase
        .from('data_deletion_requests')
        .insert({
          email: email.trim(),
          phone: phone.trim() || null,
          reason: reason.trim() || null,
        })
        .select('confirmation_code')
        .single();

      if (error) throw error;

      setConfirmationCode(data.confirmation_code);
      toast({
        title: "Solicitação enviada",
        description: "Sua solicitação de exclusão foi registrada com sucesso.",
      });
    } catch (error: any) {
      console.error('Error submitting deletion request:', error);
      toast({
        title: "Erro ao enviar",
        description: "Ocorreu um erro ao processar sua solicitação. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (confirmationCode) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-card border border-border rounded-lg p-8 text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Solicitação Recebida</h1>
            <p className="text-muted-foreground mb-6">
              Sua solicitação de exclusão de dados foi registrada com sucesso.
            </p>
            
            <div className="bg-muted/50 rounded-lg p-4 mb-6">
              <p className="text-sm text-muted-foreground mb-2">Código de Confirmação:</p>
              <p className="text-xl font-mono font-bold text-foreground">{confirmationCode}</p>
            </div>

            <p className="text-sm text-muted-foreground mb-6">
              Guarde este código para acompanhar o status da sua solicitação. 
              Nossa equipe processará sua solicitação em até 15 dias úteis e você 
              receberá uma confirmação por e-mail.
            </p>

            <div className="flex flex-col gap-3">
              <Link to={`/data-deletion-callback?code=${confirmationCode}`}>
                <Button variant="outline" className="w-full">
                  Verificar Status
                </Button>
              </Link>
              <Link to="/">
                <Button className="w-full">
                  Voltar ao Início
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
              <Trash2 className="h-5 w-5 text-primary" />
              <span className="font-semibold">Exclusão de Dados</span>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Solicitação de Exclusão de Dados</h1>
          <p className="text-muted-foreground">
            Em conformidade com a LGPD e as políticas da Meta, você pode solicitar a exclusão 
            dos seus dados pessoais da nossa plataforma.
          </p>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">O que será excluído</h2>
          <ul className="list-disc pl-6 text-muted-foreground space-y-2">
            <li>Dados de cadastro (nome, e-mail, telefone)</li>
            <li>Histórico de conversas e mensagens</li>
            <li>Contatos e listas de transmissão</li>
            <li>Configurações e preferências</li>
            <li>Dados de campanhas e automações</li>
            <li>Registros de uso da plataforma</li>
          </ul>
          <p className="text-sm text-muted-foreground mt-4">
            <strong>Nota:</strong> Alguns dados podem ser mantidos por obrigação legal ou para fins de 
            auditoria, conforme descrito em nossa{" "}
            <Link to="/privacy" className="text-primary hover:underline">Política de Privacidade</Link>.
          </p>
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Formulário de Solicitação</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">E-mail *</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Informe o e-mail associado à sua conta
              </p>
            </div>

            <div>
              <Label htmlFor="phone">Telefone (opcional)</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+55 11 99999-9999"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Telefone cadastrado na plataforma
              </p>
            </div>

            <div>
              <Label htmlFor="reason">Motivo (opcional)</Label>
              <Textarea
                id="reason"
                placeholder="Por que você está solicitando a exclusão dos seus dados?"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1 min-h-[100px]"
              />
            </div>

            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">
                <strong>Importante:</strong> Após a confirmação, a exclusão será irreversível. 
                Processaremos sua solicitação em até 15 dias úteis e você receberá uma 
                confirmação por e-mail.
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Enviando..." : "Solicitar Exclusão de Dados"}
            </Button>
          </form>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            Já fez uma solicitação?{" "}
            <Link to="/data-deletion-callback" className="text-primary hover:underline">
              Verificar status
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

export default DataDeletion;
