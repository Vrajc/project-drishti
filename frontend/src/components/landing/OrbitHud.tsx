import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import SplineScene from '../SplineScene';

const STAGES = [
  { label: 'WATCHING', position: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2' },
  { label: 'COUNTING', position: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2' },
  { label: 'PREDICTING', position: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2' },
  { label: 'ALERTING', position: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2' },
] as const;

/**
 * The hero's right-hand visual: the existing orbit composition, with the four
 * things the system is doing riding a slow carousel around it and a framing
 * bracket that makes the whole thing read as an instrument rather than an
 * ornament. Labels counter-rotate so they stay upright as the ring turns.
 */
const OrbitHud: React.FC = () => {
  const reduceMotion = useReducedMotion();
  const spin = reduceMotion ? {} : { rotate: 360 };
  const counterSpin = reduceMotion ? {} : { rotate: -360 };
  const spinTransition = { duration: 48, repeat: Infinity, ease: 'linear' as const };

  return (
    <div className="relative h-full w-full">
      {/* Corner brackets */}
      {[
        'left-0 top-0 border-l border-t',
        'right-0 top-0 border-r border-t',
        'left-0 bottom-0 border-l border-b',
        'right-0 bottom-0 border-r border-b',
      ].map((corner) => (
        <div
          key={corner}
          aria-hidden="true"
          className={`absolute h-6 w-6 border-ai-gray-700 sm:h-8 sm:w-8 ${corner}`}
        />
      ))}

      {/* Base composition */}
      <SplineScene className="h-full w-full" />

      {/* Orbiting stage labels */}
      <motion.div
        aria-hidden="true"
        animate={spin}
        transition={spinTransition}
        className="pointer-events-none absolute left-1/2 top-1/2 z-20 h-[190px] w-[190px] -translate-x-1/2 -translate-y-1/2 sm:h-[280px] sm:w-[280px] lg:h-[380px] lg:w-[380px]"
      >
        {STAGES.map((stage) => (
          <div key={stage.label} className={`absolute ${stage.position}`}>
            <motion.span
              animate={counterSpin}
              transition={spinTransition}
              className="block whitespace-nowrap rounded-full border border-ai-gray-800 bg-ai-black/80 px-2.5 py-1 text-[9px] font-medium tracking-[0.14em] text-ai-gray-400 backdrop-blur-sm sm:text-[10px]"
            >
              {stage.label}
            </motion.span>
          </div>
        ))}
      </motion.div>

      {/* Mark, dead centre of the rings */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center"
      >
        <div className="relative">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-ai-white shadow-2xl sm:h-16 sm:w-16 lg:h-20 lg:w-20">
            <span className="text-2xl font-bold text-ai-black sm:text-3xl lg:text-4xl">
              &#10022;
            </span>
          </div>

          {/* Two rings, offset in phase, so the pulse never has a gap */}
          <motion.div
            className="absolute inset-0 rounded-xl border-2 border-ai-white"
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute inset-0 rounded-xl border-2 border-ai-white"
            animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0, 0.3] }}
            transition={{ duration: 3, delay: 0.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
      </motion.div>
    </div>
  );
};

export default OrbitHud;
