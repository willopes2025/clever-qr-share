import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface HolographicCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  index: number;
}

export const HolographicCard = ({ icon: Icon, title, description, index }: HolographicCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [glarePosition, setGlarePosition] = useState({ x: 50, y: 50 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    
    const rect = cardRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const mouseX = e.clientX - centerX;
    const mouseY = e.clientY - centerY;
    
    const rotateXVal = (mouseY / (rect.height / 2)) * -10;
    const rotateYVal = (mouseX / (rect.width / 2)) * 10;
    
    setRotateX(rotateXVal);
    setRotateY(rotateYVal);
    
    const glareX = ((e.clientX - rect.left) / rect.width) * 100;
    const glareY = ((e.clientY - rect.top) / rect.height) * 100;
    setGlarePosition({ x: glareX, y: glareY });
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
    setGlarePosition({ x: 50, y: 50 });
  };

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      viewport={{ once: true }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        perspective: '1000px',
      }}
    >
      <Card
        className="relative p-6 h-full overflow-hidden holographic-card"
        style={{
          transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
          transition: 'transform 0.1s ease-out',
        }}
      >
        {/* Holographic glare effect */}
        <div
          className="absolute inset-0 pointer-events-none opacity-30"
          style={{
            background: `radial-gradient(circle at ${glarePosition.x}% ${glarePosition.y}%, rgba(0, 255, 255, 0.4) 0%, transparent 50%)`,
          }}
        />
        
        {/* Rainbow reflection */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            background: `linear-gradient(${135 + rotateY * 2}deg, 
              transparent 0%, 
              rgba(0, 255, 255, 0.3) 25%, 
              rgba(255, 0, 170, 0.3) 50%, 
              rgba(0, 255, 100, 0.3) 75%, 
              transparent 100%)`,
          }}
        />

        <div className="relative z-10">
          <motion.div 
            className="h-16 w-16 rounded-2xl bg-gradient-neon flex items-center justify-center mb-5 shadow-glow-cyan"
            whileHover={{ scale: 1.1, rotate: 5 }}
            transition={{ type: 'spring', stiffness: 300 }}
          >
            <Icon className="h-8 w-8 text-background" />
          </motion.div>
          
          <h3 className="text-xl font-display font-semibold mb-3 text-foreground">
            {title}
          </h3>
          <p className="text-muted-foreground font-body text-base leading-relaxed">
            {description}
          </p>
        </div>
      </Card>
    </motion.div>
  );
};
