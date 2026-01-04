import React from 'react';
import { motion } from 'framer-motion';

interface GradientButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  className?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
}

const GradientButton: React.FC<GradientButtonProps> = ({ 
  children, 
  onClick, 
  type = 'button', 
  disabled = false,
  className = '',
  variant = 'primary'
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return 'bg-ai-white text-ai-black hover:bg-ai-gray-100 border border-ai-white';
      case 'secondary':
        return 'bg-ai-gray-800 text-ai-white hover:bg-ai-gray-700 border border-ai-gray-600';
      case 'ghost':
        return 'bg-transparent text-ai-white hover:bg-ai-gray-900 border border-ai-gray-700';
      default:
        return 'bg-ai-white text-ai-black hover:bg-ai-gray-100 border border-ai-white';
    }
  };

  return (
    <motion.button
      whileHover={{ 
        scale: disabled ? 1 : 1.03,
        y: disabled ? 0 : -2,
        boxShadow: disabled ? 'none' : '0 8px 30px rgba(255, 255, 255, 0.15)'
      }}
      whileTap={{ 
        scale: disabled ? 1 : 0.97,
        y: disabled ? 0 : 0
      }}
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 17,
        mass: 0.5
      }}
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`px-6 py-3 rounded-lg font-medium transition-all duration-300 
        disabled:opacity-40 disabled:cursor-not-allowed
        shadow-lg hover:shadow-2xl
        ${getVariantStyles()} 
        ${className}`}
    >
      {children}
    </motion.button>
  );
};

export default GradientButton;