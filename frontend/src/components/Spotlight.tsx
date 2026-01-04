import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface SpotlightProps {
  className?: string;
}

const Spotlight: React.FC<SpotlightProps> = ({ className = '' }) => {
  const spotlightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (spotlightRef.current) {
        const { clientX, clientY } = e;
        spotlightRef.current.style.setProperty('--mouse-x', `${clientX}px`);
        spotlightRef.current.style.setProperty('--mouse-y', `${clientY}px`);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <>
      {/* Main spotlight that follows cursor */}
      <div
        ref={spotlightRef}
        className={`pointer-events-none fixed inset-0 z-10 transition-opacity duration-300 ${className}`}
        style={{
          background: `radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(255, 255, 255, 0.06), transparent 40%)`,
        }}
      />
      
      {/* Static spotlights for depth */}
      <motion.div
        className="pointer-events-none fixed inset-0 z-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
      >
        {/* Top left spotlight */}
        <div
          className="absolute w-[600px] h-[600px] rounded-full"
          style={{
            top: '10%',
            left: '10%',
            background: 'radial-gradient(circle, rgba(255, 255, 255, 0.03) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />
        
        {/* Bottom right spotlight */}
        <div
          className="absolute w-[500px] h-[500px] rounded-full"
          style={{
            bottom: '15%',
            right: '15%',
            background: 'radial-gradient(circle, rgba(255, 255, 255, 0.02) 0%, transparent 70%)',
            filter: 'blur(50px)',
          }}
        />
        
        {/* Center soft glow */}
        <div
          className="absolute w-[800px] h-[800px] rounded-full"
          style={{
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'radial-gradient(circle, rgba(255, 255, 255, 0.01) 0%, transparent 60%)',
            filter: 'blur(60px)',
          }}
        />
      </motion.div>
    </>
  );
};

export default Spotlight;
