import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BookOpen, MessageCircle, Mail, Phone, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const faqs = [
  {
    question: "Como conectar minha instância do WhatsApp?",
    answer: "Acesse o menu 'Instâncias' no painel lateral, clique em 'Nova Instância' e siga as instruções para escanear o QR Code com seu WhatsApp."
  },
  {
    question: "Como criar uma campanha de mensagens?",
    answer: "Vá até 'Campanhas' no menu, clique em 'Nova Campanha', selecione sua lista de contatos, configure a mensagem e agende o envio."
  },
  {
    question: "Como funciona o agente de IA?",
    answer: "O agente de IA responde automaticamente às mensagens dos seus clientes. Configure-o em 'Agentes de IA' definindo o prompt, base de conhecimento e regras de comportamento."
  },
  {
    question: "Como importar contatos?",
    answer: "Em 'Contatos', clique em 'Importar' e faça upload de um arquivo CSV ou Excel com os dados dos seus contatos."
  },
  {
    question: "Como usar o funil de vendas?",
    answer: "Acesse 'Funis' para visualizar e gerenciar seus deals. Arraste os cards entre as etapas para atualizar o status de cada negociação."
  },
  {
    question: "Como sincronizar com o Google Calendar?",
    answer: "Em 'Calendário', clique em 'Conectar Google Calendar' e autorize o acesso. Suas tarefas serão sincronizadas automaticamente."
  },
];

const Ajuda = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <Button 
          variant="ghost" 
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Central de Ajuda</h1>
          <p className="text-muted-foreground">
            Encontre respostas para suas dúvidas ou entre em contato conosco
          </p>
        </div>

        {/* Contact Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => window.open("https://wa.me/5527999400707", "_blank")}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <MessageCircle className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="font-medium">WhatsApp</p>
                <p className="text-sm text-muted-foreground">(27) 99940-0707</p>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => window.open("mailto:contato@wideic.com", "_blank")}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Mail className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="font-medium">Email</p>
                <p className="text-sm text-muted-foreground">contato@wideic.com</p>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => window.open("tel:+5527999400707", "_blank")}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                <Phone className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="font-medium">Telefone</p>
                <p className="text-sm text-muted-foreground">(27) 99940-0707</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* FAQs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Perguntas Frequentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`}>
                  <AccordionTrigger className="text-left">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Ajuda;
