import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';

export interface FaqItem {
  question: string;
  answer: string;
}

interface FaqAccordionProps {
  items: FaqItem[];
}

/**
 * One panel open at a time. Height animates from `auto`, which framer-motion
 * measures for us, so answers of very different lengths behave the same.
 */
const FaqAccordion: React.FC<FaqAccordionProps> = ({ items }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="divide-y divide-ai-gray-900 border-y border-ai-gray-900">
      {items.map((item, index) => {
        const open = openIndex === index;
        return (
          <div key={item.question}>
            <button
              onClick={() => setOpenIndex(open ? null : index)}
              aria-expanded={open}
              className="flex w-full items-start justify-between gap-4 py-5 text-left transition-colors duration-300 hover:text-ai-white sm:py-6"
            >
              <span className="flex items-start gap-3 sm:gap-4">
                <span className="tabular mt-1 text-[11px] text-ai-gray-600">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span
                  className={`text-base font-medium tracking-tight transition-colors duration-300 sm:text-lg ${
                    open ? 'text-ai-white' : 'text-ai-gray-200'
                  }`}
                >
                  {item.question}
                </span>
              </span>
              <motion.span
                animate={{ rotate: open ? 45 : 0 }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-ai-gray-700 text-ai-gray-300"
              >
                <Plus className="h-3.5 w-3.5" />
              </motion.span>
            </button>

            <AnimatePresence initial={false}>
              {open && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                  className="overflow-hidden"
                >
                  <p className="max-w-3xl pb-6 pl-7 text-sm leading-relaxed text-ai-gray-400 sm:pl-9 sm:text-base">
                    {item.answer}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
};

export default FaqAccordion;
