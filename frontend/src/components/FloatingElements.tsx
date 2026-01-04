import React from 'react';
import { motion } from 'framer-motion';

const FloatingElements: React.FC = () => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {/* Minimalist floating geometric shapes */}
      
      {/* Large square outline */}
      <motion.div
        className="absolute w-96 h-96 border border-ai-gray-800 rounded-lg"
        animate={{
          x: [0, 50, 0],
          y: [0, -30, 0],
          rotate: [0, 5, 0],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        style={{ top: '15%', left: '5%', opacity: 0.3 }}
      />
      
      {/* Medium circle with gradient */}
      <motion.div
        className="absolute w-64 h-64 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(255, 255, 255, 0.05) 0%, transparent 70%)',
          top: '50%',
          right: '10%'
        }}
        animate={{
          x: [0, -60, 0],
          y: [0, 40, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      
      {/* Small rotating square */}
      <motion.div
        className="absolute w-32 h-32 border border-ai-gray-700"
        animate={{
          x: [0, 40, 0],
          y: [0, -50, 0],
          rotate: [0, 180, 360],
        }}
        transition={{
          duration: 30,
          repeat: Infinity,
          ease: "linear"
        }}
        style={{ bottom: '20%', left: '15%', opacity: 0.2 }}
      />
      
      {/* Tiny dot clusters */}
      <motion.div
        className="absolute w-2 h-2 bg-ai-white rounded-full"
        animate={{
          opacity: [0.2, 0.6, 0.2],
          scale: [1, 1.5, 1],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        style={{ top: '30%', right: '30%' }}
      />
      
      <motion.div
        className="absolute w-2 h-2 bg-ai-white rounded-full"
        animate={{
          opacity: [0.3, 0.7, 0.3],
          scale: [1, 1.5, 1],
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1
        }}
        style={{ top: '70%', left: '40%' }}
      />
      
      {/* Horizontal line element */}
      <motion.div
        className="absolute h-px bg-gradient-to-r from-transparent via-ai-gray-600 to-transparent"
        style={{ width: '40%', top: '40%', left: '30%', opacity: 0.3 }}
        animate={{
          scaleX: [1, 1.2, 1],
          opacity: [0.2, 0.4, 0.2],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      
      {/* Grid overlay in corner */}
      <div 
        className="absolute w-48 h-48 opacity-10"
        style={{ 
          bottom: '10%', 
          right: '5%',
          backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px)',
          backgroundSize: '20px 20px'
        }}
      />
    </div>
  );
};

export default FloatingElements;