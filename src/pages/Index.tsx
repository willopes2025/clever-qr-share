import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, Zap, Shield, Smartphone, BarChart, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import heroPhones from "@/assets/hero-phones.jpg";

const features = [
  {
    icon: Zap,
    title: "QR Code Ilimitado",
    description: "Conecte quantas contas WhatsApp você precisar, sem limites."
  },
  {
    icon: Shield,
    title: "100% Seguro",
    description: "Seus dados e conversas protegidos com criptografia de ponta."
  },
  {
    icon: Smartphone,
    title: "Multi-dispositivo",
    description: "Gerencie múltiplas instâncias em um só lugar."
  },
  {
    icon: BarChart,
    title: "Relatórios Detalhados",
    description: "Acompanhe métricas e resultados em tempo real."
  },
  {
    icon: Users,
    title: "Gestão de Contatos",
    description: "Organize e segmente sua base de contatos facilmente."
  },
  {
    icon: Zap,
    title: "Disparos Inteligentes",
    description: "Envie mensagens em massa com personalização avançada."
  }
];

const benefits = [
  "Conexões ilimitadas via QR Code",
  "API Evolution integrada",
  "Disparos em massa personalizados",
  "Funis de conversação automatizados",
  "Suporte técnico especializado",
  "Atualizações constantes"
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-whatsapp-light via-background to-background opacity-50" />
        <div className="container mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
                Dispare Mensagens no{" "}
                <span className="text-primary">WhatsApp</span> em Escala
              </h1>
              <p className="text-xl text-muted-foreground mb-8">
                Plataforma completa para automação de marketing conversacional com QR Code ilimitado e Evolution API integrada.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" asChild className="text-lg h-14 px-8">
                  <Link to="/dashboard">
                    Começar Agora - Grátis
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild className="text-lg h-14 px-8">
                  <Link to="/dashboard">
                    Ver Demonstração
                  </Link>
                </Button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <img
                src={heroPhones}
                alt="WhatsApp Marketing Platform"
                className="rounded-2xl shadow-large"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold mb-4">
              Tudo que você precisa para crescer
            </h2>
            <p className="text-xl text-muted-foreground">
              Recursos poderosos para escalar seu marketing conversacional
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="p-6 h-full shadow-medium hover:shadow-large transition-all">
                  <div className="h-12 w-12 rounded-xl bg-gradient-primary flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <h2 className="text-4xl font-bold mb-6">
                Por que escolher o DisparaZap?
              </h2>
              <p className="text-xl text-muted-foreground mb-8">
                A solução completa para você escalar suas vendas e conversões através do WhatsApp.
              </p>
              <div className="space-y-4">
                {benefits.map((benefit, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.1 }}
                    viewport={{ once: true }}
                    className="flex items-start gap-3"
                  >
                    <div className="h-6 w-6 rounded-full bg-whatsapp flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-lg">{benefit}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <Card className="p-8 shadow-large bg-gradient-to-br from-card to-muted/30">
                <div className="text-center mb-6">
                  <h3 className="text-3xl font-bold mb-2">Comece Grátis</h3>
                  <p className="text-muted-foreground">Sem cartão de crédito</p>
                </div>
                <div className="bg-background rounded-xl p-6 mb-6">
                  <div className="text-5xl font-bold text-center mb-2">
                    <span className="text-primary">Ilimitado</span>
                  </div>
                  <p className="text-center text-muted-foreground">
                    QR Codes e Instâncias
                  </p>
                </div>
                <Button size="lg" className="w-full text-lg h-14" asChild>
                  <Link to="/dashboard">
                    Criar Conta Grátis
                  </Link>
                </Button>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-primary">
        <div className="container mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl font-bold text-white mb-6">
              Pronto para começar?
            </h2>
            <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
              Junte-se a milhares de empresas que já utilizam nossa plataforma para crescer no WhatsApp.
            </p>
            <Button size="lg" variant="secondary" asChild className="text-lg h-14 px-8">
              <Link to="/dashboard">
                Criar Conta Grátis Agora
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-border">
        <div className="container mx-auto text-center text-muted-foreground">
          <p>&copy; 2024 DisparaZap. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
