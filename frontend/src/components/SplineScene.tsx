import React from 'react';
import { motion } from 'framer-motion';

interface SplineSceneProps {
  className?: string;
}

const SplineScene: React.FC<SplineSceneProps> = ({ className = '' }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1, delay: 0.3 }}
      className={`relative ${className}`}
    >
      {/* 3D-like geometric composition */}
      <div className="relative w-full h-full flex items-center justify-center">
        {/* Main central sphere */}
        <motion.div
          className="absolute w-64 h-64 rounded-full border border-text-tertiary/20"
          animate={{
            scale: [1, 1.05, 1],
            rotate: [0, 360],
          }}
          transition={{
            scale: {
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut"
            },
            rotate: {
              duration: 20,
              repeat: Infinity,
              ease: "linear"
            }
          }}
          style={{
            background: 'radial-gradient(circle, rgba(255, 255, 255, 0.05) 0%, transparent 70%)',
          }}
        />

        {/* Orbiting elements */}
        <motion.div
          className="absolute w-48 h-48 rounded-full border border-text-tertiary/30"
          animate={{
            rotate: [0, 360],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "linear"
          }}
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-interactive-primary rounded-full shadow-glow" />
        </motion.div>

        <motion.div
          className="absolute w-56 h-56 rounded-full border border-text-tertiary/15"
          animate={{
            rotate: [360, 0],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "linear"
          }}
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-text-tertiary rounded-full" />
        </motion.div>

        {/* Floating geometric shapes */}
        <motion.div
          className="absolute w-16 h-16 border border-text-tertiary/40"
          style={{ top: '20%', right: '15%' }}
          animate={{
            y: [0, -20, 0],
            rotate: [0, 90, 0],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />

        <motion.div
          className="absolute w-12 h-12 rounded-full border border-text-tertiary/30"
          style={{ bottom: '25%', left: '10%' }}
          animate={{
            y: [0, 15, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />

        {/* Central glow */}
        <div 
          className="absolute w-32 h-32 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 70%)',
            filter: 'blur(20px)',
          }}
        />
      </div>
    </motion.div>
  );
};

export default SplineScene;
