import { useState } from "react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Check,
  Zap,
  Shield,
  Smartphone,
  BarChart,
  Users,
  Sparkles,
  ArrowRight,
  LogIn,
  UserPlus,
  Crown,
  Rocket,
} from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import wideLogo from "@/assets/wide-logo.png";

const features = [
  {
    icon: Zap,
    title: "QR Code Ilimitado",
    description: "Conecte quantas contas WhatsApp você precisar, sem limites de instâncias.",
  },
  {
    icon: Shield,
    title: "100% Seguro",
    description: "Seus dados e conversas protegidos com criptografia de ponta a ponta.",
  },
  {
    icon: Smartphone,
    title: "Multi-dispositivo",
    description: "Gerencie múltiplas instâncias simultaneamente em um só lugar.",
  },
  {
    icon: BarChart,
    title: "Relatórios Detalhados",
    description: "Acompanhe métricas e resultados das suas campanhas em tempo real.",
  },
  {
    icon: Users,
    title: "Gestão de Contatos",
    description: "Organize e segmente sua base de contatos com tags inteligentes.",
  },
  {
    icon: Sparkles,
    title: "Disparos Inteligentes",
    description: "Envie mensagens em massa com personalização e variações automáticas.",
  },
];

const stats = [
  { value: "10.000+", label: "Usuários Ativos" },
  { value: "5M+", label: "Mensagens Enviadas" },
  { value: "99.9%", label: "Uptime Garantido" },
  { value: "24/7", label: "Suporte Técnico" },
];

const pricingTiers = [
  {
    name: "Starter",
    price: "67",
    period: "mês",
    description: "Perfeito para quem está começando",
    features: [
      "1 Instância WhatsApp",
      "Contatos ilimitados",
      "Mensagens ilimitadas",
      "Templates com variações",
      "Campanhas agendadas",
      "Suporte por email",
    ],
    icon: Zap,
    cta: "Começar Agora",
  },
  {
    name: "Pro",
    price: "147",
    period: "mês",
    description: "Para profissionais e pequenas empresas",
    features: [
      "Até 10 Instâncias WhatsApp",
      "Contatos ilimitados",
      "Mensagens ilimitadas",
      "Templates com IA",
      "Campanhas avançadas",
      "Relatórios detalhados",
      "Suporte prioritário",
    ],
    highlighted: true,
    icon: Crown,
    cta: "Assinar Pro",
  },
  {
    name: "Business",
    price: "297",
    period: "mês",
    description: "Para grandes operações e agências",
    features: [
      "Instâncias ilimitadas",
      "Tudo do Pro",
      "API completa",
      "Webhooks personalizados",
      "Gerente de conta dedicado",
      "SLA garantido",
      "Treinamento exclusivo",
    ],
    icon: Rocket,
    cta: "Assinar Business",
  },
];

const Index = () => {
  const [isAnnual, setIsAnnual] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <section className="relative pt-32 pb-24 px-4 overflow-hidden">
        <div className="container mx-auto relative">
          <div className="max-w-5xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-6"
            >
              <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-accent/10 text-accent font-medium">
                <Sparkles className="h-4 w-4" />
                <span className="text-sm">Plataforma #1 em Automação WhatsApp</span>
              </span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mb-6"
            >
              <img src={wideLogo} alt="Widezap" className="h-50 md:h-66 lg:h-82 w-auto mx-auto" />
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-2xl md:text-3xl lg:text-4xl font-semibold mb-8 text-foreground"
            >
              Automação de Marketing no WhatsApp
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-3xl mx-auto"
            >
              Plataforma completa para escalar seu marketing conversacional com QR Code ilimitado e IA avançada.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex flex-col sm:flex-row gap-4 justify-center mb-16"
            >
              <Button
                size="lg"
                asChild
                className="text-lg h-16 px-10 bg-gradient-to-r from-primary to-accent hover:shadow-hover text-white font-semibold transition-all duration-300 rounded-2xl group"
              >
                <Link to="/login?tab=signup">
                  <UserPlus className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />
                  Criar Conta Grátis
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="text-lg h-16 px-10 border-primary/30 text-primary hover:bg-primary/5 hover:shadow-soft transition-all duration-300 rounded-2xl"
              >
                <Link to="/login">
                  <LogIn className="mr-2 h-5 w-5" />
                  Já tenho conta
                </Link>
              </Button>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-6"
            >
              {stats.map((stat, index) => (
                <Card key={index} className="p-6 depth-card text-center">
                  <div className="text-3xl md:text-4xl font-bold text-primary mb-1">{stat.value}</div>
                  <div className="text-sm md:text-base text-muted-foreground">{stat.label}</div>
                </Card>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
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
              Tecnologia de <span className="text-primary">Ponta</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Recursos poderosos para escalar seu marketing conversacional e maximizar resultados
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
                <Card className="p-6 depth-card hover:shadow-hover transition-all h-full">
                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-soft mb-4">
                    <feature.icon className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2 text-foreground">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-24 px-4">
        <div className="container mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 text-foreground">
              Escolha seu <span className="text-primary">Plano</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              Planos flexíveis para todos os tamanhos de negócio
            </p>

            {/* Billing Toggle */}
            <div className="flex items-center justify-center gap-4">
              <span className={`text-lg ${!isAnnual ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                Mensal
              </span>
              <Switch checked={isAnnual} onCheckedChange={setIsAnnual} className="data-[state=checked]:bg-accent" />
              <span className={`text-lg ${isAnnual ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                Anual
              </span>
              {isAnnual && (
                <span className="px-3 py-1 rounded-full bg-accent/10 text-accent text-sm font-semibold">-20%</span>
              )}
            </div>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {pricingTiers.map((tier, index) => {
              const Icon = tier.icon;
              const price = isAnnual ? Math.round(parseInt(tier.price) * 0.8) : tier.price;

              return (
                <motion.div
                  key={tier.name}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  viewport={{ once: true }}
                >
                  <Card
                    className={`p-8 h-full flex flex-col ${tier.highlighted ? "elevated-card ring-2 ring-accent" : "depth-card"}`}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div
                        className={`h-12 w-12 rounded-xl flex items-center justify-center ${tier.highlighted ? "bg-gradient-to-br from-primary to-accent" : "bg-muted"}`}
                      >
                        <Icon className={`h-6 w-6 ${tier.highlighted ? "text-white" : "text-primary"}`} />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-foreground">{tier.name}</h3>
                        <p className="text-sm text-muted-foreground">{tier.description}</p>
                      </div>
                    </div>

                    <div className="mb-6">
                      <span className="text-5xl font-bold text-foreground">R${price}</span>
                      <span className="text-muted-foreground">/{tier.period}</span>
                    </div>

                    <ul className="space-y-3 mb-8 flex-1">
                      {tier.features.map((feature, featureIndex) => (
                        <li key={featureIndex} className="flex items-center gap-3">
                          <Check className="h-5 w-5 text-accent flex-shrink-0" />
                          <span className="text-muted-foreground">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      asChild
                      className={`w-full rounded-xl h-12 ${tier.highlighted ? "bg-gradient-to-r from-primary to-accent text-white hover:shadow-medium" : ""}`}
                      variant={tier.highlighted ? "default" : "outline"}
                    >
                      <Link to="/login?tab=signup">{tier.cta}</Link>
                    </Button>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4">
        <div className="container mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <Card className="text-center p-12 md:p-16 elevated-card">
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 text-foreground">
                Pronto para <span className="text-primary">decolar</span>?
              </h2>
              <p className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-2xl mx-auto">
                Junte-se a mais de 10.000 empresas que já utilizam nossa plataforma para crescer no WhatsApp.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  size="lg"
                  asChild
                  className="text-lg h-16 px-12 bg-gradient-to-r from-primary to-accent hover:shadow-hover text-white font-semibold transition-all duration-300 rounded-2xl"
                >
                  <Link to="/login?tab=signup">
                    <Zap className="mr-2 h-5 w-5" />
                    Criar Conta Grátis Agora
                  </Link>
                </Button>
              </div>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-border">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center">
              <img src={wideLogo} alt="Widezap" className="h-10 w-auto" />
            </div>

            <nav className="flex items-center gap-8">
              <Link to="/" className="text-muted-foreground hover:text-primary transition-colors">
                Recursos
              </Link>
              <Link to="/" className="text-muted-foreground hover:text-primary transition-colors">
                Preços
              </Link>
              <Link to="/" className="text-muted-foreground hover:text-primary transition-colors">
                Suporte
              </Link>
            </nav>

            <p className="text-muted-foreground">
              © 2024 <span className="text-primary">WIDEZAP</span>. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
