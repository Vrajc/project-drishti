import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick?: () => void;
  delay?: number;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ 
  icon: Icon, 
  title, 
  description, 
  onClick,
  delay = 0 
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      whileHover={{ 
        y: -10,
        transition: {
          type: 'spring',
          stiffness: 300,
          damping: 20
        }
      }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.4, delay, ease: [0.4, 0, 0.2, 1] }}
      viewport={{ once: true }}
      onClick={onClick}
      className={`group relative glassmorphism rounded-xl p-8 
        border border-ai-gray-700 hover:border-ai-gray-500
        transition-all duration-300 ai-card ${onClick ? 'cursor-pointer' : ''}`}
    >
      {/* Hover gradient effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-ai-gray-800/50 to-transparent opacity-0 group-hover:opacity-100 rounded-xl transition-opacity duration-300" />
      
      <div className="relative z-10">
        {/* Icon container with minimal design */}
        <motion.div 
          whileHover={{ 
            scale: 1.15, 
            rotate: 5,
            transition: {
              type: 'spring',
              stiffness: 400,
              damping: 17
            }
          }}
          className="w-14 h-14 bg-ai-white rounded-lg flex items-center justify-center mb-6 
            transition-all duration-300"
        >
          <Icon className="w-7 h-7 text-ai-black" strokeWidth={1.5} />
        </motion.div>
        
        <h3 className="text-xl font-semibold text-ai-white mb-3 tracking-tight">
          {title}
        </h3>
        
        <p className="text-ai-gray-300 leading-relaxed text-sm">
          {description}
        </p>

        {/* Minimal bottom indicator */}
        <div className="mt-6 w-8 h-0.5 bg-ai-white opacity-0 group-hover:opacity-100 group-hover:w-12 transition-all duration-300" />
      </div>
    </motion.div>
  );
};

export default FeatureCard;