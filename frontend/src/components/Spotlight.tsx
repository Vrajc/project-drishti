import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface SpotlightProps {
  className?: string;
}

const Spotlight: React.FC<SpotlightProps> = ({ className = '' }) => {
  const spotlightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // A cursor-following spotlight has no meaning on a touch screen, and the
    // listener would only ever fire from synthesised taps. Skip it entirely.
    const hasFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (!hasFinePointer) return;

    let frame: number | undefined;
    let pending: { x: number; y: number } | null = null;

    const apply = () => {
      frame = undefined;
      if (!pending || !spotlightRef.current) return;
      spotlightRef.current.style.setProperty('--mouse-x', `${pending.x}px`);
      spotlightRef.current.style.setProperty('--mouse-y', `${pending.y}px`);
    };

    // Coalesce to one style write per frame instead of one per mousemove
    const handleMouseMove = (e: MouseEvent) => {
      pending = { x: e.clientX, y: e.clientY };
      if (frame === undefined) frame = requestAnimationFrame(apply);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <>
      {/* Cursor spotlight — pointer devices only */}
      <div
        ref={spotlightRef}
        aria-hidden="true"
        className={`pointer-events-none fixed inset-0 z-10 hidden can-hover:block transition-opacity duration-300 ${className}`}
        style={{
          background: `radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(255, 255, 255, 0.06), transparent 40%)`,
        }}
      />

      {/* Static spotlights for depth.
          Sized in vmin so they stay proportional instead of spilling far
          past a phone viewport, and clipped so they can never contribute
          to page scroll width. */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
      >
        {/* Top left spotlight */}
        <div
          className="absolute rounded-full w-[110vmin] h-[110vmin] max-w-[600px] max-h-[600px]"
          style={{
            top: '10%',
            left: '10%',
            background: 'radial-gradient(circle, rgba(255, 255, 255, 0.03) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />

        {/* Bottom right spotlight */}
        <div
          className="absolute rounded-full w-[90vmin] h-[90vmin] max-w-[500px] max-h-[500px]"
          style={{
            bottom: '15%',
            right: '15%',
            background: 'radial-gradient(circle, rgba(255, 255, 255, 0.02) 0%, transparent 70%)',
            filter: 'blur(50px)',
          }}
        />

        {/* Center soft glow */}
        <div
          className="absolute rounded-full w-[150vmin] h-[150vmin] max-w-[800px] max-h-[800px]"
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
