import React from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';

/**
 * Hairline read-out of how far down the page you are. Sits above the header
 * so it stays visible once the header turns opaque.
 */
const ScrollProgress: React.FC = () => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 140,
    damping: 30,
    restDelta: 0.001,
  });

  return (
    <motion.div
      aria-hidden="true"
      style={{ scaleX }}
      className="fixed top-0 left-0 right-0 z-[60] h-px origin-left
        bg-gradient-to-r from-ai-gray-600 via-ai-white to-ai-gray-600"
    />
  );
};

export default ScrollProgress;
