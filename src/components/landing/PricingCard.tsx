import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Zap, Crown, Rocket, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { useState } from 'react';

interface PricingTier {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  icon: 'zap' | 'crown' | 'rocket';
  cta: string;
  planKey?: 'starter' | 'pro' | 'business';
}

interface PricingCardProps {
  tier: PricingTier;
  index: number;
  isAnnual: boolean;
}

const icons = {
  zap: Zap,
  crown: Crown,
  rocket: Rocket,
};

export const PricingCard = ({ tier, index, isAnnual }: PricingCardProps) => {
  const Icon = icons[tier.icon];
  const { user } = useAuth();
  const { createCheckout, currentPlan } = useSubscription();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  const isCurrentPlan = tier.planKey && currentPlan === tier.planKey;
  
  const handleClick = async () => {
    if (!tier.planKey) {
      navigate('/login?tab=signup');
      return;
    }
    
    if (!user) {
      navigate('/login?tab=signup');
      return;
    }
    
    if (isCurrentPlan) return;
    
    setLoading(true);
    try {
      await createCheckout(tier.planKey);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.15 }}
      viewport={{ once: true }}
      className="relative"
    >
      {tier.highlighted && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
          <span className="px-4 py-1 rounded-full bg-gradient-neon text-background text-sm font-semibold shadow-glow-cyan">
            Mais Popular
          </span>
        </div>
      )}
      
      <Card 
        className={`relative p-8 h-full overflow-hidden transition-all duration-300 ${
          tier.highlighted 
            ? 'pricing-card-highlighted scale-105' 
            : 'glass-card hover:shadow-glow-cyan'
        }`}
      >
        {tier.highlighted && (
          <div className="absolute inset-0 pricing-shimmer pointer-events-none" />
        )}
        
        {isCurrentPlan && (
          <div className="absolute top-4 right-4 z-10">
            <span className="px-3 py-1 rounded-full bg-neon-green/20 text-neon-green text-xs font-semibold border border-neon-green/30">
              Seu Plano
            </span>
          </div>
        )}
        
        <div className="relative z-10">
          <div className={`h-14 w-14 rounded-xl flex items-center justify-center mb-6 ${
            tier.highlighted 
              ? 'bg-gradient-neon shadow-glow-cyan' 
              : 'bg-secondary'
          }`}>
            <Icon className={`h-7 w-7 ${tier.highlighted ? 'text-background' : 'text-primary'}`} />
          </div>
          
          <h3 className="text-2xl font-display font-bold mb-2 text-foreground">
            {tier.name}
          </h3>
          
          <p className="text-muted-foreground mb-6 font-body">
            {tier.description}
          </p>
          
          <div className="mb-6">
            <span className="text-5xl font-display font-bold text-foreground">
              R${tier.price}
            </span>
            <span className="text-muted-foreground ml-2">/{tier.period}</span>
            {isAnnual && (
              <div className="text-sm text-neon-green mt-1">
                Economize 20% no plano anual
              </div>
            )}
          </div>
          
          <ul className="space-y-3 mb-8">
            {tier.features.map((feature, i) => (
              <li key={i} className="flex items-start gap-3">
                <div className={`h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  tier.highlighted ? 'bg-gradient-neon' : 'bg-primary/20'
                }`}>
                  <Check className={`h-3 w-3 ${tier.highlighted ? 'text-background' : 'text-primary'}`} />
                </div>
                <span className="text-foreground font-body">{feature}</span>
              </li>
            ))}
          </ul>
          
          <Button 
            onClick={handleClick}
            disabled={loading || isCurrentPlan}
            className={`w-full h-12 font-semibold transition-all duration-300 ${
              isCurrentPlan
                ? 'bg-neon-green/20 text-neon-green border border-neon-green/30 cursor-default'
                : tier.highlighted 
                  ? 'bg-gradient-neon hover:shadow-glow-cyan text-background' 
                  : 'bg-secondary hover:bg-secondary/80 text-foreground'
            }`}
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : isCurrentPlan ? (
              'Plano Atual'
            ) : (
              tier.cta
            )}
          </Button>
        </div>
      </Card>
    </motion.div>
  );
};
