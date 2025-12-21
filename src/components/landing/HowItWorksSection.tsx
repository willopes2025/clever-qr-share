import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { UserPlus, QrCode, Upload, Rocket } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: UserPlus,
    title: "Crie sua conta",
    description: "Cadastro rápido e gratuito em menos de 2 minutos. Sem cartão de crédito.",
  },
  {
    number: "02",
    icon: QrCode,
    title: "Conecte seu WhatsApp",
    description: "Escaneie o QR Code e pronto! Conexão instantânea e segura.",
  },
  {
    number: "03",
    icon: Upload,
    title: "Importe seus contatos",
    description: "Faça upload da sua lista de contatos ou adicione manualmente.",
  },
  {
    number: "04",
    icon: Rocket,
    title: "Dispare suas campanhas",
    description: "Crie mensagens personalizadas e comece a vender mais!",
  },
];

export const HowItWorksSection = () => {
  return (
    <section className="py-24 px-4">
      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 text-foreground">
            Como <span className="text-primary">funciona</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Comece a usar em 4 passos simples
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          {/* Connection line for desktop */}
          <div className="hidden lg:block absolute top-24 left-[12%] right-[12%] h-0.5 bg-gradient-to-r from-primary via-accent to-primary opacity-30" />

          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.15 }}
              viewport={{ once: true }}
              className="relative"
            >
              <Card className="p-6 depth-card hover:shadow-hover transition-all h-full text-center">
                {/* Step number badge */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-primary to-accent text-white text-sm font-bold">
                  Passo {step.number}
                </div>

                <div className="mt-4 mb-6 flex justify-center">
                  <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
                    <step.icon className="h-10 w-10 text-primary" />
                  </div>
                </div>

                <h3 className="text-xl font-bold mb-3 text-foreground">{step.title}</h3>
                <p className="text-muted-foreground">{step.description}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
