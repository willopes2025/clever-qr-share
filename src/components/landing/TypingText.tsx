import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface TypingTextProps {
  texts: string[];
  className?: string;
  typingSpeed?: number;
  deletingSpeed?: number;
  pauseTime?: number;
}

export const TypingText = ({ 
  texts, 
  className = '',
  typingSpeed = 100,
  deletingSpeed = 50,
  pauseTime = 2000 
}: TypingTextProps) => {
  const [displayText, setDisplayText] = useState('');
  const [textIndex, setTextIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentText = texts[textIndex];
    
    const timeout = setTimeout(() => {
      if (!isDeleting) {
        if (displayText.length < currentText.length) {
          setDisplayText(currentText.slice(0, displayText.length + 1));
        } else {
          setTimeout(() => setIsDeleting(true), pauseTime);
        }
      } else {
        if (displayText.length > 0) {
          setDisplayText(displayText.slice(0, -1));
        } else {
          setIsDeleting(false);
          setTextIndex((prev) => (prev + 1) % texts.length);
        }
      }
    }, isDeleting ? deletingSpeed : typingSpeed);

    return () => clearTimeout(timeout);
  }, [displayText, isDeleting, textIndex, texts, typingSpeed, deletingSpeed, pauseTime]);

  return (
    <motion.span 
      className={`inline-flex items-center ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <span>{displayText}</span>
      <motion.span
        className="inline-block w-[3px] h-[1em] bg-primary ml-1"
        animate={{ opacity: [1, 0] }}
        transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
      />
    </motion.span>
  );
};
