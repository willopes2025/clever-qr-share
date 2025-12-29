import { Link } from "react-router-dom";
import { ArrowLeft, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

const TermsOfService = () => {
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
              <FileText className="h-5 w-5 text-primary" />
              <span className="font-semibold">Termos de Serviço</span>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="prose prose-invert max-w-none">
          <h1 className="text-3xl font-bold text-foreground mb-2">Termos de Serviço</h1>
          <p className="text-muted-foreground mb-8">Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">1. Aceitação dos Termos</h2>
            <p className="text-muted-foreground leading-relaxed">
              Ao acessar e usar nossa plataforma de automação e gestão de WhatsApp, você concorda em cumprir 
              estes Termos de Serviço. Se você não concordar com qualquer parte destes termos, não poderá 
              acessar ou usar nossos serviços. Estes termos constituem um acordo legal vinculativo entre 
              você e nossa empresa.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">2. Descrição do Serviço</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Nossa plataforma oferece ferramentas para:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Gerenciamento de conversas do WhatsApp Business</li>
              <li>Automação de mensagens e campanhas</li>
              <li>Gestão de contatos e listas de transmissão</li>
              <li>Funis de vendas e CRM integrado</li>
              <li>Chatbots e inteligência artificial para atendimento</li>
              <li>Relatórios e análises de desempenho</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">3. Requisitos de Uso</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">Para usar nossos serviços, você deve:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Ter pelo menos 18 anos de idade</li>
              <li>Possuir capacidade legal para celebrar contratos</li>
              <li>Fornecer informações verdadeiras e precisas no cadastro</li>
              <li>Possuir uma conta comercial válida no WhatsApp Business</li>
              <li>Cumprir as políticas do WhatsApp Business e da Meta</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">4. Uso Aceitável</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Você concorda em usar a plataforma apenas para fins legais e de acordo com estas regras:
            </p>
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 mb-4">
              <p className="text-foreground font-semibold mb-2">É estritamente proibido:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Enviar spam ou mensagens não solicitadas</li>
                <li>Compartilhar conteúdo ilegal, ofensivo ou prejudicial</li>
                <li>Violar direitos de terceiros ou propriedade intelectual</li>
                <li>Realizar atividades fraudulentas ou enganosas</li>
                <li>Tentar acessar sistemas ou dados não autorizados</li>
                <li>Interferir no funcionamento da plataforma</li>
                <li>Revender ou sublicenciar o serviço sem autorização</li>
                <li>Violar as políticas do WhatsApp Business</li>
              </ul>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              A violação destas regras pode resultar na suspensão ou encerramento imediato da sua conta.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">5. Conta e Segurança</h2>
            <p className="text-muted-foreground leading-relaxed">
              Você é responsável por manter a confidencialidade das suas credenciais de acesso e por todas 
              as atividades realizadas em sua conta. Notifique-nos imediatamente sobre qualquer uso não 
              autorizado. Recomendamos o uso de senhas fortes e a ativação de recursos de segurança adicionais.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">6. Planos e Pagamentos</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Os serviços são oferecidos em diferentes planos de assinatura:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Os preços estão sujeitos a alterações com aviso prévio de 30 dias</li>
              <li>A cobrança é realizada automaticamente no início de cada período</li>
              <li>Não oferecemos reembolsos por períodos parciais não utilizados</li>
              <li>O não pagamento pode resultar na suspensão ou cancelamento do serviço</li>
              <li>Impostos aplicáveis serão adicionados conforme a legislação vigente</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">7. Propriedade Intelectual</h2>
            <p className="text-muted-foreground leading-relaxed">
              Todos os direitos de propriedade intelectual relacionados à plataforma, incluindo software, 
              design, logotipos e conteúdo, pertencem exclusivamente a nós ou nossos licenciadores. 
              Você recebe uma licença limitada, não exclusiva e não transferível para usar a plataforma 
              de acordo com estes termos.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">8. Limitação de Responsabilidade</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Na extensão máxima permitida por lei:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>O serviço é fornecido "como está" sem garantias expressas ou implícitas</li>
              <li>Não garantimos disponibilidade ininterrupta ou livre de erros</li>
              <li>Não somos responsáveis por ações do WhatsApp ou da Meta</li>
              <li>Nossa responsabilidade é limitada ao valor pago nos últimos 12 meses</li>
              <li>Não nos responsabilizamos por danos indiretos, incidentais ou consequenciais</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">9. Indenização</h2>
            <p className="text-muted-foreground leading-relaxed">
              Você concorda em nos indenizar e isentar de responsabilidade por quaisquer reclamações, 
              danos, perdas ou despesas decorrentes do seu uso indevido da plataforma, violação destes 
              termos ou violação de direitos de terceiros.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">10. Rescisão</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Este acordo pode ser encerrado:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Por você, a qualquer momento, cancelando sua assinatura</li>
              <li>Por nós, imediatamente, em caso de violação destes termos</li>
              <li>Por nós, com 30 dias de aviso, por qualquer motivo</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              Após a rescisão, você perderá acesso à plataforma e seus dados poderão ser excluídos 
              de acordo com nossa Política de Privacidade.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">11. Alterações nos Termos</h2>
            <p className="text-muted-foreground leading-relaxed">
              Reservamos o direito de modificar estes termos a qualquer momento. Alterações significativas 
              serão comunicadas por e-mail ou através da plataforma com pelo menos 30 dias de antecedência. 
              O uso continuado após as alterações constitui aceitação dos novos termos.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">12. Lei Aplicável e Foro</h2>
            <p className="text-muted-foreground leading-relaxed">
              Estes termos são regidos pelas leis da República Federativa do Brasil. Qualquer disputa 
              será submetida ao foro da comarca de [Cidade/Estado], com exclusão de qualquer outro, 
              por mais privilegiado que seja.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">13. Contato</h2>
            <p className="text-muted-foreground leading-relaxed">
              Para dúvidas sobre estes termos, entre em contato:
            </p>
            <div className="bg-card border border-border rounded-lg p-4 mt-4">
              <p className="text-muted-foreground"><strong>E-mail:</strong> suporte@seudominio.com</p>
              <p className="text-muted-foreground"><strong>Jurídico:</strong> juridico@seudominio.com</p>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 mt-12">
        <div className="container mx-auto px-4 text-center text-muted-foreground text-sm">
          <p>© {new Date().getFullYear()} Sua Empresa. Todos os direitos reservados.</p>
          <div className="flex justify-center gap-4 mt-2">
            <Link to="/privacy" className="hover:text-primary">Política de Privacidade</Link>
            <Link to="/data-deletion" className="hover:text-primary">Exclusão de Dados</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default TermsOfService;
