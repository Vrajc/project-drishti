import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick?: () => void;
  delay?: number;
  /** Two-digit marker printed in the card's top-right corner */
  index?: string;
  /** The one number that matters for this capability, and what it measures */
  metric?: { value: string; label: string };
  /** Concrete details, listed under the description */
  points?: string[];
}

const FeatureCard: React.FC<FeatureCardProps> = ({
  icon: Icon,
  title,
  description,
  onClick,
  delay = 0,
  index,
  metric,
  points
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
      className={`group relative glassmorphism edge-card rounded-xl p-5 sm:p-6 lg:p-8 h-full
        border border-ai-gray-700 hover:border-ai-gray-500
        transition-all duration-300 ai-card ${onClick ? 'cursor-pointer' : ''}`}
    >
      {/* Hover gradient effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-ai-gray-800/50 to-transparent opacity-0 group-hover:opacity-100 rounded-xl transition-opacity duration-300" />

      <div className="relative z-10 flex h-full flex-col">
        {/* Corner marker — keeps the six cards countable at a glance */}
        {index && (
          <span className="tabular absolute right-0 top-0 text-[11px] font-semibold tracking-[0.18em] text-ai-gray-700 transition-colors duration-300 group-hover:text-ai-gray-500">
            {index}
          </span>
        )}

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
          className="w-12 h-12 sm:w-14 sm:h-14 bg-ai-white rounded-lg flex items-center justify-center mb-4 sm:mb-6
            transition-all duration-300"
        >
          <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-ai-black" strokeWidth={1.5} />
        </motion.div>

        <h3 className="text-lg sm:text-xl font-semibold text-ai-white mb-2 sm:mb-3 tracking-tight">
          {title}
        </h3>

        <p className="text-ai-gray-300 leading-relaxed text-sm">
          {description}
        </p>

        {points && points.length > 0 && (
          <ul className="mt-4 space-y-2 border-t border-ai-gray-800 pt-4">
            {points.map((point) => (
              <li key={point} className="flex items-start gap-2 text-xs text-ai-gray-400">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ai-gray-500" />
                <span className="leading-relaxed">{point}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Metric sits at the foot of the card, so a row of cards lines up
            regardless of how much description each one carries */}
        {metric && (
          <div className="mt-auto flex items-baseline gap-2 pt-5">
            <span className="tabular text-xl font-bold text-ai-white sm:text-2xl">
              {metric.value}
            </span>
            <span className="text-[11px] uppercase tracking-[0.12em] text-ai-gray-500">
              {metric.label}
            </span>
          </div>
        )}

        {/* Minimal bottom indicator */}
        <div className="mt-4 sm:mt-6 w-8 h-0.5 bg-ai-white opacity-0 group-hover:opacity-100 group-hover:w-12 transition-all duration-300" />
      </div>
    </motion.div>
  );
};

export default FeatureCard;
