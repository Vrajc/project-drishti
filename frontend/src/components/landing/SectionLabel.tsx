import React from 'react';
import { motion } from 'framer-motion';

interface SectionLabelProps {
  children: React.ReactNode;
  /** Two-digit section marker, e.g. "02". Omitted where a section stands alone. */
  index?: string;
}

/**
 * The small pill that opens every section. One component so the rhythm of
 * dot → index → label is identical the whole way down the page.
 */
const SectionLabel: React.FC<SectionLabelProps> = ({ children, index }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.5 }}
    className="inline-flex items-center gap-2.5 rounded-full border border-ai-gray-800
      bg-ai-gray-900/70 px-3.5 py-1.5 backdrop-blur-sm"
  >
    <span className="relative flex h-1.5 w-1.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ai-white opacity-60" />
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-ai-white" />
    </span>
    {index && (
      <span className="tabular text-[11px] font-semibold tracking-[0.18em] text-ai-gray-600">
        {index}
      </span>
    )}
    <span className="text-xs font-medium uppercase tracking-[0.16em] text-ai-gray-300 sm:text-[13px]">
      {children}
    </span>
  </motion.div>
);

export default SectionLabel;
