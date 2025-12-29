import { Link } from "react-router-dom";
import { ArrowLeft, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

const PrivacyPolicy = () => {
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
              <Shield className="h-5 w-5 text-primary" />
              <span className="font-semibold">Política de Privacidade</span>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="prose prose-invert max-w-none">
          <h1 className="text-3xl font-bold text-foreground mb-2">Política de Privacidade</h1>
          <p className="text-muted-foreground mb-8">Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">1. Introdução</h2>
            <p className="text-muted-foreground leading-relaxed">
              Esta Política de Privacidade descreve como coletamos, usamos, armazenamos e protegemos suas informações 
              pessoais quando você utiliza nossa plataforma de automação e gestão de WhatsApp. Estamos comprometidos 
              com a proteção da sua privacidade e em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018) 
              e demais legislações aplicáveis.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">2. Dados que Coletamos</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">Coletamos os seguintes tipos de dados:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li><strong>Dados de cadastro:</strong> Nome, e-mail, telefone e senha (criptografada)</li>
              <li><strong>Dados de uso:</strong> Informações sobre como você utiliza a plataforma</li>
              <li><strong>Dados de contatos:</strong> Números de telefone e nomes dos contatos que você gerencia</li>
              <li><strong>Mensagens:</strong> Histórico de conversas processadas pela plataforma</li>
              <li><strong>Dados de integração:</strong> Tokens de acesso para conexão com WhatsApp</li>
              <li><strong>Dados técnicos:</strong> Endereço IP, tipo de navegador, dispositivo utilizado</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">3. Como Usamos seus Dados</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">Utilizamos seus dados para:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Fornecer e manter nossos serviços de automação de WhatsApp</li>
              <li>Processar e enviar mensagens em seu nome</li>
              <li>Gerenciar sua conta e assinatura</li>
              <li>Enviar comunicações sobre o serviço</li>
              <li>Melhorar e personalizar sua experiência</li>
              <li>Cumprir obrigações legais e regulatórias</li>
              <li>Prevenir fraudes e garantir a segurança</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">4. Compartilhamento de Dados</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Compartilhamos seus dados apenas quando necessário para a prestação dos serviços:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li><strong>Meta/WhatsApp:</strong> Para permitir a integração e envio de mensagens via WhatsApp Business API</li>
              <li><strong>Processadores de pagamento:</strong> Para processar transações financeiras (Stripe)</li>
              <li><strong>Provedores de infraestrutura:</strong> Para hospedagem e armazenamento seguro de dados</li>
              <li><strong>Autoridades legais:</strong> Quando exigido por lei ou ordem judicial</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              <strong>Não vendemos, alugamos ou compartilhamos seus dados pessoais com terceiros para fins de marketing.</strong>
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">5. Segurança dos Dados</h2>
            <p className="text-muted-foreground leading-relaxed">
              Implementamos medidas técnicas e organizacionais para proteger seus dados, incluindo:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-4">
              <li>Criptografia de dados em trânsito (TLS/SSL) e em repouso</li>
              <li>Controles de acesso rigorosos</li>
              <li>Monitoramento contínuo de segurança</li>
              <li>Backups regulares com proteção adequada</li>
              <li>Política de senhas fortes e autenticação segura</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">6. Retenção de Dados</h2>
            <p className="text-muted-foreground leading-relaxed">
              Mantemos seus dados pelo tempo necessário para fornecer os serviços ou conforme exigido por lei. 
              Após o encerramento da sua conta, seus dados serão excluídos ou anonimizados em até 30 dias, 
              exceto quando a retenção for necessária para cumprimento de obrigações legais.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">7. Seus Direitos (LGPD)</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              De acordo com a LGPD, você tem os seguintes direitos:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li><strong>Confirmação e acesso:</strong> Confirmar e acessar seus dados pessoais</li>
              <li><strong>Correção:</strong> Solicitar a correção de dados incompletos ou desatualizados</li>
              <li><strong>Anonimização ou bloqueio:</strong> Solicitar a anonimização ou bloqueio de dados desnecessários</li>
              <li><strong>Portabilidade:</strong> Solicitar a portabilidade dos seus dados</li>
              <li><strong>Eliminação:</strong> Solicitar a exclusão dos seus dados pessoais</li>
              <li><strong>Revogação do consentimento:</strong> Revogar seu consentimento a qualquer momento</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              Para exercer seus direitos, acesse nossa <Link to="/data-deletion" className="text-primary hover:underline">página de exclusão de dados</Link> ou 
              entre em contato conosco pelos canais indicados abaixo.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">8. Cookies e Tecnologias Semelhantes</h2>
            <p className="text-muted-foreground leading-relaxed">
              Utilizamos cookies e tecnologias semelhantes para melhorar sua experiência, analisar o uso da 
              plataforma e personalizar conteúdo. Você pode gerenciar suas preferências de cookies nas 
              configurações do seu navegador.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">9. Alterações nesta Política</h2>
            <p className="text-muted-foreground leading-relaxed">
              Podemos atualizar esta Política de Privacidade periodicamente. Notificaremos você sobre 
              alterações significativas por e-mail ou através de aviso em nossa plataforma. O uso 
              continuado dos serviços após as alterações constitui aceitação da política atualizada.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">10. Contato</h2>
            <p className="text-muted-foreground leading-relaxed">
              Para dúvidas sobre esta política ou para exercer seus direitos de privacidade, entre em contato:
            </p>
            <div className="bg-card border border-border rounded-lg p-4 mt-4">
              <p className="text-muted-foreground"><strong>E-mail:</strong> privacidade@seudominio.com</p>
              <p className="text-muted-foreground"><strong>Encarregado de Dados (DPO):</strong> dpo@seudominio.com</p>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 mt-12">
        <div className="container mx-auto px-4 text-center text-muted-foreground text-sm">
          <p>© {new Date().getFullYear()} Sua Empresa. Todos os direitos reservados.</p>
          <div className="flex justify-center gap-4 mt-2">
            <Link to="/terms" className="hover:text-primary">Termos de Serviço</Link>
            <Link to="/data-deletion" className="hover:text-primary">Exclusão de Dados</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PrivacyPolicy;
