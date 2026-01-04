import React from 'react';
import { motion } from 'framer-motion';

interface GlowingCardProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
  hoverEffect?: boolean;
  delay?: number;
  onClick?: () => void;
}

const GlowingCard: React.FC<GlowingCardProps> = ({
  children,
  className = '',
  glowColor = 'rgba(255, 255, 255, 0.1)',
  hoverEffect = true,
  delay = 0,
  onClick
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.5, 
        delay,
        type: 'spring',
        stiffness: 100,
        damping: 15
      }}
      whileHover={hoverEffect ? { 
        y: -6,
        scale: 1.01,
        boxShadow: '0 24px 48px rgba(0, 0, 0, 0.35), 0 0 35px ' + glowColor,
        transition: {
          type: 'spring',
          stiffness: 300,
          damping: 20
        }
      } : undefined}
      whileTap={hoverEffect ? { scale: 0.99 } : undefined}
      className={`
        relative group
        bg-[#111111] 
        border border-[#262626]
        rounded-xl
        overflow-hidden
        transition-all duration-300
        ${hoverEffect ? 'cursor-pointer' : ''}
        ${className}
      `}
      style={{
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15), 0 0 15px rgba(255, 255, 255, 0.02)'
      }}
      onClick={onClick}
    >
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />
      
      {/* Glow effect on hover */}
      {hoverEffect && (
        <div 
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
          style={{
            background: `radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), ${glowColor}, transparent 40%)`
          }}
        />
      )}
      
      {/* Border glow */}
      <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
        <div className="absolute inset-0 rounded-xl border border-white/10" />
      </div>
      
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </motion.div>
  );
};

export default GlowingCard;
