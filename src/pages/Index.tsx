import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, Zap, Shield, Smartphone, BarChart, Users, Sparkles } from "lucide-react";
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
    icon: Sparkles,
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
    <div className="min-h-screen bg-background animated-gradient cyber-grid relative overflow-hidden">
      {/* Ambient glow effects */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-neon-cyan/10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-neon-magenta/10 rounded-full blur-3xl pointer-events-none" />
      
      <Header />
      
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 overflow-hidden">
        <div className="container mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/30 mb-6">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">Plataforma #1 em Automação</span>
              </div>
              
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-display font-bold mb-6 leading-tight">
                Dispare no{" "}
                <span className="text-primary text-glow-cyan">WhatsApp</span>
                <br />
                <span className="bg-gradient-neon bg-clip-text text-transparent">em Escala</span>
              </h1>
              
              <p className="text-xl text-muted-foreground mb-8 font-body">
                Plataforma completa para automação de marketing conversacional com QR Code ilimitado e Evolution API integrada.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" asChild className="text-lg h-14 px-8 bg-gradient-neon hover:shadow-glow-cyan text-background font-semibold transition-all duration-300">
                  <Link to="/dashboard">
                    <Zap className="mr-2 h-5 w-5" />
                    Começar Agora
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild className="text-lg h-14 px-8 border-primary/50 text-primary hover:bg-primary/10 hover:shadow-glow-cyan transition-all duration-300">
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
              <div className="relative neon-border rounded-2xl overflow-hidden">
                <img
                  src={heroPhones}
                  alt="Widezap Marketing Platform"
                  className="rounded-2xl shadow-neon"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
              </div>
              {/* Floating elements */}
              <motion.div 
                className="absolute -top-4 -right-4 p-4 glass-card rounded-xl shadow-glow-cyan"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <Zap className="h-8 w-8 text-primary" />
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 relative">
        <div className="container mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-4">
              Tecnologia de{" "}
              <span className="text-primary text-glow-cyan">Ponta</span>
            </h2>
            <p className="text-xl text-muted-foreground">
              Recursos poderosos para escalar seu marketing conversacional
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="p-6 h-full glass-card hover:shadow-glow-cyan hover-glow transition-all duration-300 group neon-border">
                  <div className="h-14 w-14 rounded-xl bg-gradient-neon flex items-center justify-center mb-4 shadow-glow-cyan group-hover:shadow-glow-magenta transition-all">
                    <feature.icon className="h-7 w-7 text-background" />
                  </div>
                  <h3 className="text-xl font-display font-semibold mb-2 text-foreground group-hover:text-primary transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-4 relative">
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <h2 className="text-4xl md:text-5xl font-display font-bold mb-6">
                Por que escolher o{" "}
                <span className="text-primary text-glow-cyan">Widezap</span>?
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
                    <div className="h-6 w-6 rounded-full bg-gradient-neon flex items-center justify-center flex-shrink-0 mt-0.5 shadow-glow-cyan">
                      <Check className="h-4 w-4 text-background" />
                    </div>
                    <span className="text-lg text-foreground">{benefit}</span>
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
              <Card className="p-8 glass-card shadow-neon neon-border">
                <div className="text-center mb-6">
                  <h3 className="text-3xl font-display font-bold mb-2 text-foreground">Comece Grátis</h3>
                  <p className="text-muted-foreground">Sem cartão de crédito</p>
                </div>
                <div className="bg-gradient-cyber rounded-xl p-6 mb-6 border border-primary/20">
                  <div className="text-5xl font-display font-bold text-center mb-2">
                    <span className="bg-gradient-neon bg-clip-text text-transparent">Ilimitado</span>
                  </div>
                  <p className="text-center text-muted-foreground">
                    QR Codes e Instâncias
                  </p>
                </div>
                <Button size="lg" className="w-full text-lg h-14 bg-gradient-neon hover:shadow-glow-cyan text-background font-semibold transition-all duration-300" asChild>
                  <Link to="/dashboard">
                    <Zap className="mr-2 h-5 w-5" />
                    Criar Conta Grátis
                  </Link>
                </Button>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 relative">
        <div className="container mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center p-12 rounded-3xl glass-card shadow-neon neon-border"
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-6 text-foreground">
              Pronto para{" "}
              <span className="text-primary text-glow-cyan">decolar</span>?
            </h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Junte-se a milhares de empresas que já utilizam nossa plataforma para crescer no WhatsApp.
            </p>
            <Button size="lg" asChild className="text-lg h-14 px-10 bg-gradient-neon hover:shadow-glow-cyan text-background font-semibold transition-all duration-300">
              <Link to="/dashboard">
                <Zap className="mr-2 h-5 w-5" />
                Criar Conta Grátis Agora
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-border/50">
        <div className="container mx-auto text-center text-muted-foreground">
          <p className="font-display">&copy; 2024 <span className="text-primary">WIDEZAP</span>. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
