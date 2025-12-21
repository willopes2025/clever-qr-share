import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    name: "Carlos Silva",
    role: "CEO, TechStore",
    content: "Com o Widezap conseguimos aumentar nossas vendas em 340% em apenas 3 meses. A automação de mensagens mudou completamente nosso negócio.",
    rating: 5,
    avatar: "CS",
  },
  {
    name: "Ana Rodrigues",
    role: "Gerente de Marketing, Moda Plus",
    content: "A plataforma é incrível! Consigo gerenciar todas as minhas campanhas de WhatsApp em um só lugar. O suporte é excepcional.",
    rating: 5,
    avatar: "AR",
  },
  {
    name: "Pedro Santos",
    role: "Founder, Delivery Express",
    content: "Antes eu perdia horas enviando mensagens manualmente. Agora disparo para milhares de contatos em minutos. Recomendo demais!",
    rating: 5,
    avatar: "PS",
  },
  {
    name: "Mariana Costa",
    role: "Diretora Comercial, Imobiliária Prime",
    content: "Os templates com IA são fantásticos. Minhas mensagens ficaram muito mais profissionais e a taxa de resposta aumentou 200%.",
    rating: 5,
    avatar: "MC",
  },
  {
    name: "Ricardo Oliveira",
    role: "Proprietário, Auto Center RO",
    content: "A gestão de contatos com tags inteligentes revolucionou nossa forma de trabalhar. Segmentação perfeita para cada cliente.",
    rating: 5,
    avatar: "RO",
  },
  {
    name: "Juliana Mendes",
    role: "Head de Vendas, EduTech Brasil",
    content: "O relatório detalhado de campanhas me ajuda a tomar decisões baseadas em dados. A plataforma mais completa que já usei.",
    rating: 5,
    avatar: "JM",
  },
];

export const TestimonialsSection = () => {
  return (
    <section className="py-24 px-4 bg-secondary/30">
      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 text-foreground">
            O que nossos <span className="text-primary">clientes</span> dizem
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Mais de 10.000 empresas já transformaram seu marketing com o Widezap
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <Card className="p-6 depth-card hover:shadow-hover transition-all h-full flex flex-col">
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-accent text-accent" />
                  ))}
                </div>
                
                <div className="relative flex-1">
                  <Quote className="absolute -top-2 -left-1 h-8 w-8 text-primary/20" />
                  <p className="text-muted-foreground pl-6 italic">
                    "{testimonial.content}"
                  </p>
                </div>

                <div className="flex items-center gap-4 mt-6 pt-4 border-t border-border">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{testimonial.name}</p>
                    <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
