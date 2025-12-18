import { motion } from 'framer-motion';

interface GlitchTextProps {
  text: string;
  className?: string;
}

export const GlitchText = ({ text, className = '' }: GlitchTextProps) => {
  return (
    <motion.span 
      className={`glitch-text relative inline-block ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <span className="glitch-text-main">{text}</span>
      <span className="glitch-text-clone glitch-clone-1" aria-hidden="true">{text}</span>
      <span className="glitch-text-clone glitch-clone-2" aria-hidden="true">{text}</span>
    </motion.span>
  );
};
