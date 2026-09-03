import React, { useRef } from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

export interface PipelineStep {
  icon: LucideIcon;
  /** The component that owns this stage, e.g. `ai-service` */
  actor: string;
  title: string;
  description: string;
  /** Short technical facts shown as chips under the description */
  facts: string[];
}

interface PipelineFlowProps {
  steps: PipelineStep[];
}

/**
 * The end-to-end path a single frame takes, drawn as a timeline whose rail
 * lights up as you scroll past it. Each stage names the component that owns
 * it, so the diagram maps onto the repository rather than onto a metaphor.
 */
const PipelineFlow: React.FC<PipelineFlowProps> = ({ steps }) => {
  const containerRef = useRef<HTMLOListElement>(null);

  // Rail fill tracks scroll through the list rather than a fixed duration, so
  // the light always sits at the stage being read.
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start 0.8', 'end 0.55'],
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
        className="pipeline-rail absolute left-[19px] top-2 bottom-2 w-px sm:left-[27px]"
      />
      {/* Bright rail, scaled by scroll position */}
      <motion.div
        aria-hidden="true"
        style={{ scaleY: railScale }}
        className="absolute left-[19px] top-2 bottom-2 w-px origin-top bg-gradient-to-b from-ai-white/80 to-ai-white/20 sm:left-[27px]"
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
            className="relative flex gap-4 pb-8 last:pb-0 sm:gap-6 sm:pb-12"
          >
            {/* Node */}
            <div className="relative z-10 shrink-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-ai-gray-700 bg-ai-black sm:h-14 sm:w-14">
                <Icon className="h-4 w-4 text-ai-white sm:h-5 sm:w-5" strokeWidth={1.5} />
              </div>
              <span className="tabular absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-ai-white text-[10px] font-bold text-ai-black">
                {index + 1}
              </span>
            </div>

            {/* Card */}
            <div className="edge-card min-w-0 flex-1 rounded-xl border border-ai-gray-800/80 bg-ai-gray-900/40 p-4 backdrop-blur-sm transition-colors duration-300 hover:border-ai-gray-600 sm:p-6">
              <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <h3 className="text-base font-semibold tracking-tight text-ai-white sm:text-lg">
                  {step.title}
                </h3>
                <code className="rounded border border-ai-gray-800 bg-ai-black px-2 py-0.5 text-[11px] text-ai-gray-400">
                  {step.actor}
                </code>
              </div>

              <p className="text-sm leading-relaxed text-ai-gray-300">{step.description}</p>

              <div className="mt-3 flex flex-wrap gap-2">
                {step.facts.map((fact) => (
                  <span
                    key={fact}
                    className="rounded-md bg-ai-gray-800/60 px-2 py-1 text-[11px] text-ai-gray-400"
                  >
                    {fact}
                  </span>
                ))}
              </div>
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
};

export default PipelineFlow;
