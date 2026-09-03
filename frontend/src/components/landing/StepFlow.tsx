import React, { useRef } from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

export interface FlowStep {
  icon: LucideIcon;
  title: string;
  description: string;
}

interface StepFlowProps {
  steps: FlowStep[];
}

/**
 * The "how it works" list, drawn as a timeline whose rail lights up as you
 * scroll past it. Deliberately few steps and generous type — this is the part
 * of the page someone reads before they have decided to care.
 */
const StepFlow: React.FC<StepFlowProps> = ({ steps }) => {
  const containerRef = useRef<HTMLOListElement>(null);

  // Rail fill tracks scroll through the list rather than a fixed duration, so
  // the light always sits at the step being read.
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start 0.8', 'end 0.6'],
  });
  const railScale = useSpring(scrollYProgress, {
    stiffness: 90,
    damping: 26,
    restDelta: 0.001,
  });

  return (
    <ol ref={containerRef} className="relative">
      {/* Dim rail, full height */}
      <div
        aria-hidden="true"
        className="pipeline-rail absolute left-[23px] top-3 bottom-3 w-px sm:left-[31px]"
      />
      {/* Bright rail, scaled by scroll position */}
      <motion.div
        aria-hidden="true"
        style={{ scaleY: railScale }}
        className="absolute left-[23px] top-3 bottom-3 w-px origin-top bg-gradient-to-b from-ai-white/80 to-ai-white/20 sm:left-[31px]"
      />

      {steps.map((step, index) => {
        const Icon = step.icon;
        return (
          <motion.li
            key={step.title}
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
            className="relative flex gap-5 pb-10 last:pb-0 sm:gap-8 sm:pb-14"
          >
            {/* Node */}
            <div className="relative z-10 shrink-0">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-ai-gray-700 bg-ai-black sm:h-16 sm:w-16">
                <Icon className="h-5 w-5 text-ai-white sm:h-6 sm:w-6" strokeWidth={1.5} />
              </div>
              <span className="tabular absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-ai-white text-[10px] font-bold text-ai-black">
                {index + 1}
              </span>
            </div>

            <div className="min-w-0 flex-1 pt-1.5 sm:pt-3">
              <h3 className="mb-2 text-lg font-semibold tracking-tight text-ai-white sm:text-xl md:text-2xl">
                {step.title}
              </h3>
              <p className="max-w-xl text-sm font-light leading-relaxed text-ai-gray-400 sm:text-base">
                {step.description}
              </p>
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
};

export default StepFlow;
