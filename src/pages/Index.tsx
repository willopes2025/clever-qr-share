import { useState } from 'react';
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Check, Zap, Shield, Smartphone, BarChart, Users, Sparkles, MessageSquare, Send, Target, ArrowRight, LogIn, UserPlus } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ParticlesBackground } from "@/components/landing/ParticlesBackground";
import { GlitchText } from "@/components/landing/GlitchText";
import { TypingText } from "@/components/landing/TypingText";
import { HolographicCard } from "@/components/landing/HolographicCard";
import { AnimatedCounter } from "@/components/landing/AnimatedCounter";
import { PricingCard } from "@/components/landing/PricingCard";

const features = [
  {
    icon: Zap,
    title: "QR Code Ilimitado",
    description: "Conecte quantas contas WhatsApp você precisar, sem limites de instâncias."
  },
  {
    icon: Shield,
    title: "100% Seguro",
    description: "Seus dados e conversas protegidos com criptografia de ponta a ponta."
  },
  {
    icon: Smartphone,
    title: "Multi-dispositivo",
    description: "Gerencie múltiplas instâncias simultaneamente em um só lugar."
  },
  {
    icon: BarChart,
    title: "Relatórios Detalhados",
    description: "Acompanhe métricas e resultados das suas campanhas em tempo real."
  },
  {
    icon: Users,
    title: "Gestão de Contatos",
    description: "Organize e segmente sua base de contatos com tags inteligentes."
  },
  {
    icon: Sparkles,
    title: "Disparos Inteligentes",
    description: "Envie mensagens em massa com personalização e variações automáticas."
  }
];

const stats = [
  { value: 10000, suffix: '+', label: 'Usuários Ativos' },
  { value: 5, suffix: 'M+', label: 'Mensagens Enviadas' },
  { value: 99.9, suffix: '%', label: 'Uptime Garantido' },
  { value: 24, suffix: '/7', label: 'Suporte Técnico' },
];

const pricingTiers = [
  {
    name: 'Starter',
    price: 'Grátis',
    period: '',
    description: 'Perfeito para começar a explorar',
    features: [
      '1 Instância WhatsApp',
      '500 mensagens/mês',
      '100 contatos',
      'Templates básicos',
      'Suporte por email',
    ],
    icon: 'zap' as const,
    cta: 'Começar Grátis',
  },
  {
    name: 'Professional',
    price: '197',
    period: 'mês',
    description: 'Para profissionais e pequenas empresas',
    features: [
      '5 Instâncias WhatsApp',
      'Mensagens ilimitadas',
      'Contatos ilimitados',
      'Templates com IA',
      'Campanhas agendadas',
      'Relatórios avançados',
      'Suporte prioritário',
    ],
    highlighted: true,
    icon: 'crown' as const,
    cta: 'Começar Agora',
  },
  {
    name: 'Enterprise',
    price: '497',
    period: 'mês',
    description: 'Para grandes operações e agências',
    features: [
      'Instâncias ilimitadas',
      'Tudo do Professional',
      'API completa',
      'Webhooks personalizados',
      'Gerente de conta dedicado',
      'SLA garantido',
      'Treinamento exclusivo',
    ],
    icon: 'rocket' as const,
    cta: 'Falar com Vendas',
  },
];

const typingTexts = [
  'Automação de Marketing',
  'Disparos em Massa',
  'Funis de Conversão',
  'Campanhas Inteligentes',
];

const Index = () => {
  const [isAnnual, setIsAnnual] = useState(false);

  return (
    <div className="min-h-screen bg-background animated-gradient relative overflow-hidden">
      {/* Particles Background */}
      <ParticlesBackground />
      
      {/* Cyber Grid */}
      <div className="fixed inset-0 cyber-grid pointer-events-none z-[1]" />
      
      {/* Ambient glow effects */}
      <div className="fixed top-0 left-1/4 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] pointer-events-none z-[2]" />
      <div className="fixed bottom-0 right-1/4 w-[600px] h-[600px] bg-accent/10 rounded-full blur-[120px] pointer-events-none z-[2]" />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-neon-green/5 rounded-full blur-[150px] pointer-events-none z-[2]" />
      
      <Header />
      
      {/* Hero Section */}
      <section className="relative pt-32 pb-24 px-4 overflow-hidden z-10">
        <div className="container mx-auto relative">
          <div className="max-w-5xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-6"
            >
              <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary/10 border border-primary/30 backdrop-blur-sm">
                <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                <span className="text-sm font-medium text-primary">Plataforma #1 em Automação WhatsApp</span>
              </span>
            </motion.div>
            
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-5xl md:text-7xl lg:text-8xl font-display font-bold mb-6 leading-tight"
            >
              <GlitchText text="WIDEZAP" className="text-primary text-glow-cyan" />
            </motion.h1>
            
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-2xl md:text-3xl lg:text-4xl font-display mb-8 h-12"
            >
              <TypingText 
                texts={typingTexts} 
                className="bg-gradient-neon bg-clip-text text-transparent"
              />
            </motion.div>
            
            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-3xl mx-auto font-body"
            >
              Plataforma completa para escalar seu marketing conversacional com QR Code ilimitado, Evolution API integrada e IA avançada.
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
                className="text-lg h-16 px-10 bg-gradient-neon hover:shadow-glow-cyan text-background font-semibold transition-all duration-300 btn-shine group"
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
                className="text-lg h-16 px-10 border-primary/50 text-primary hover:bg-primary/10 hover:shadow-glow-cyan transition-all duration-300 backdrop-blur-sm"
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
                <div key={index} className="stat-glow p-4">
                  <div className="text-3xl md:text-4xl font-display font-bold text-primary text-glow-cyan">
                    <AnimatedCounter end={stat.value} suffix={stat.suffix} />
                  </div>
                  <div className="text-sm md:text-base text-muted-foreground font-body mt-1">
                    {stat.label}
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
        
        {/* Floating elements */}
        <motion.div 
          className="absolute top-40 left-10 p-4 glass-card rounded-xl shadow-glow-cyan hidden lg:block"
          animate={{ y: [0, -15, 0], rotate: [0, 5, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        >
          <MessageSquare className="h-8 w-8 text-primary" />
        </motion.div>
        
        <motion.div 
          className="absolute top-60 right-10 p-4 glass-card rounded-xl shadow-glow-magenta hidden lg:block"
          animate={{ y: [0, 15, 0], rotate: [0, -5, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        >
          <Send className="h-8 w-8 text-accent" />
        </motion.div>
        
        <motion.div 
          className="absolute bottom-20 left-20 p-4 glass-card rounded-xl shadow-glow-green hidden lg:block"
          animate={{ y: [0, -10, 0], rotate: [0, -3, 0] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <Target className="h-8 w-8 text-neon-green" />
        </motion.div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-4 relative z-10">
        <div className="container mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold mb-4">
              Tecnologia de{" "}
              <span className="text-primary text-glow-cyan">Ponta</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto font-body">
              Recursos poderosos para escalar seu marketing conversacional e maximizar resultados
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <HolographicCard
                key={index}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                index={index}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-24 px-4 relative z-10">
        <div className="container mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold mb-4">
              Escolha seu{" "}
              <span className="text-primary text-glow-cyan">Plano</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto font-body mb-8">
              Planos flexíveis para todos os tamanhos de negócio
            </p>
            
            {/* Billing Toggle */}
            <div className="flex items-center justify-center gap-4">
              <span className={`text-lg font-body ${!isAnnual ? 'text-foreground' : 'text-muted-foreground'}`}>
                Mensal
              </span>
              <Switch
                checked={isAnnual}
                onCheckedChange={setIsAnnual}
                className="data-[state=checked]:bg-gradient-neon"
              />
              <span className={`text-lg font-body ${isAnnual ? 'text-foreground' : 'text-muted-foreground'}`}>
                Anual
              </span>
              {isAnnual && (
                <span className="px-3 py-1 rounded-full bg-neon-green/20 text-neon-green text-sm font-semibold">
                  -20%
                </span>
              )}
            </div>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {pricingTiers.map((tier, index) => (
              <PricingCard
                key={tier.name}
                tier={tier}
                index={index}
                isAnnual={isAnnual}
              />
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4 relative z-10">
        <div className="container mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center p-12 md:p-16 rounded-3xl glass-card shadow-neon neon-border relative overflow-hidden"
          >
            {/* Background glow */}
            <div className="absolute inset-0 bg-gradient-cyber opacity-50" />
            
            <div className="relative z-10">
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold mb-6 text-foreground">
                Pronto para{" "}
                <span className="text-primary text-glow-cyan">decolar</span>?
              </h2>
              <p className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-2xl mx-auto font-body">
                Junte-se a mais de 10.000 empresas que já utilizam nossa plataforma para crescer no WhatsApp.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  size="lg" 
                  asChild 
                  className="text-lg h-16 px-12 bg-gradient-neon hover:shadow-glow-cyan text-background font-semibold transition-all duration-300 btn-shine"
                >
                  <Link to="/login?tab=signup">
                    <Zap className="mr-2 h-5 w-5" />
                    Criar Conta Grátis Agora
                  </Link>
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-border/50 relative z-10">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-neon flex items-center justify-center shadow-glow-cyan">
                <Zap className="h-6 w-6 text-background" />
              </div>
              <span className="text-xl font-display font-bold text-glow-cyan">
                WIDEZAP
              </span>
            </div>
            
            <nav className="flex items-center gap-8">
              <Link to="/" className="text-muted-foreground hover:text-primary transition-colors font-body">
                Recursos
              </Link>
              <Link to="/" className="text-muted-foreground hover:text-primary transition-colors font-body">
                Preços
              </Link>
              <Link to="/" className="text-muted-foreground hover:text-primary transition-colors font-body">
                Suporte
              </Link>
            </nav>
            
            <p className="text-muted-foreground font-body">
              &copy; 2024 <span className="text-primary">WIDEZAP</span>. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
