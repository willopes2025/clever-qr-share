import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HelpCircle } from "lucide-react";

const faqs = [
  {
    question: "Como funciona o QR Code ilimitado?",
    answer: "Você pode conectar quantas contas WhatsApp quiser de acordo com seu plano. Basta escanear o QR Code exibido na plataforma e sua instância estará pronta para uso em segundos. Não há limite de reconexões.",
  },
  {
    question: "Posso testar a plataforma gratuitamente?",
    answer: "Sim! Oferecemos um período de teste gratuito para você conhecer todas as funcionalidades da plataforma antes de decidir pelo plano ideal. Não é necessário cartão de crédito para começar.",
  },
  {
    question: "Quantas mensagens posso enviar por dia?",
    answer: "Todos os nossos planos oferecem mensagens ilimitadas. Porém, recomendamos seguir as boas práticas de envio para manter a saúde da sua conta WhatsApp, com intervalos adequados entre as mensagens.",
  },
  {
    question: "O que acontece se meu WhatsApp for bloqueado?",
    answer: "Nosso sistema possui recursos inteligentes para minimizar riscos de bloqueio, como variações automáticas de mensagens e intervalos randomizados. Caso ocorra algum problema, nosso suporte está disponível 24/7 para ajudar.",
  },
  {
    question: "Posso importar minha lista de contatos?",
    answer: "Sim! Você pode importar contatos via arquivo CSV ou Excel. Nossa plataforma também permite adicionar contatos manualmente e organizá-los com tags inteligentes para segmentação.",
  },
  {
    question: "Como funciona o suporte técnico?",
    answer: "Oferecemos suporte via email para todos os planos e suporte prioritário para os planos Pro e Business. O plano Business conta ainda com um gerente de conta dedicado para atendimento personalizado.",
  },
  {
    question: "É possível cancelar a qualquer momento?",
    answer: "Sim, você pode cancelar sua assinatura a qualquer momento diretamente pela plataforma. Não há fidelidade ou multas de cancelamento. Seu acesso permanece ativo até o fim do período já pago.",
  },
  {
    question: "Os templates com IA estão incluídos?",
    answer: "Sim! Nos planos Pro e Business você tem acesso ao gerador de variações com IA, que cria automaticamente diferentes versões das suas mensagens para aumentar a entregabilidade e evitar bloqueios.",
  },
];

export const FAQSection = () => {
  return (
    <section className="py-24 px-4 bg-secondary/30">
      <div className="container mx-auto max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-accent/10 text-accent font-medium mb-6">
            <HelpCircle className="h-4 w-4" />
            <span className="text-sm">Tire suas dúvidas</span>
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 text-foreground">
            Perguntas <span className="text-primary">Frequentes</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Encontre respostas para as dúvidas mais comuns sobre nossa plataforma
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          viewport={{ once: true }}
        >
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="bg-card border border-border rounded-xl px-6 data-[state=open]:shadow-soft transition-all"
              >
                <AccordionTrigger className="text-left text-lg font-semibold text-foreground hover:text-primary py-5">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-5 text-base">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
};
