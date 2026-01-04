import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

interface HeroButtonExpandableProps {
  onClick?: () => void;
  children: React.ReactNode;
  expandedContent?: React.ReactNode;
  variant?: 'primary' | 'secondary';
}

const HeroButtonExpandable: React.FC<HeroButtonExpandableProps> = ({
  onClick,
  children,
  expandedContent,
  variant = 'primary',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const buttonClass = variant === 'primary'
    ? 'bg-interactive-primary text-bg-primary'
    : 'bg-transparent text-text-primary border border-border-medium';

  return (
    <div className="relative w-[200px]">
      <motion.button
        onHoverStart={() => expandedContent && setIsExpanded(true)}
        onHoverEnd={() => setIsExpanded(false)}
        onClick={onClick}
        className={`w-full px-8 py-4 rounded-lg font-medium transition-all duration-300 flex items-center justify-center gap-2 ${buttonClass} overflow-hidden`}
        whileHover={{ 
          scale: 1.03,
          y: -2,
          boxShadow: '0 8px 30px rgba(255, 255, 255, 0.15)'
        }}
        whileTap={{ scale: 0.97 }}
        transition={{
          type: 'spring',
          stiffness: 400,
          damping: 17
        }}
      >
        <span className="relative z-10">{children}</span>
        <motion.div
          animate={{ x: isExpanded ? 8 : 0 }}
          transition={{ 
            type: 'spring',
            stiffness: 300,
            damping: 20
          }}
        >
          <ArrowRight className="w-5 h-5" />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {isExpanded && expandedContent && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ 
              duration: 0.3,
              ease: [0.4, 0, 0.2, 1]
            }}
            className="absolute top-full left-0 mt-2 w-64 glassmorphism-strong rounded-lg p-4 shadow-strong z-50"
          >
            {expandedContent}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default HeroButtonExpandable;
