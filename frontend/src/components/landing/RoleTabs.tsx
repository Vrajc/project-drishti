import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LucideIcon, Check, ArrowUpRight } from 'lucide-react';

export interface RoleDefinition {
  id: string;
  label: string;
  icon: LucideIcon;
  headline: string;
  summary: string;
  /** What this role can do, in the product's own language */
  abilities: string[];
  /** The routes this role actually lands on */
  screens: string[];
  /** What the role is deliberately not given */
  boundary: string;
}

interface RoleTabsProps {
  roles: RoleDefinition[];
  onOpen: () => void;
}

/**
 * Four audiences, four different products behind one login. The tab list is a
 * horizontal scroller on phones rather than a wrapping grid, so the selected
 * tab never jumps to a different row when the panel below changes height.
 */
const RoleTabs: React.FC<RoleTabsProps> = ({ roles, onOpen }) => {
  const [activeId, setActiveId] = useState(roles[0]?.id ?? '');
  const active = roles.find((role) => role.id === activeId) ?? roles[0];

  if (!active) return null;

  const ActiveIcon = active.icon;

  return (
    <div>
      {/* Tabs */}
      <div
        className="no-scrollbar mb-6 flex gap-2 overflow-x-auto pb-2 sm:mb-8 sm:justify-center"
        role="tablist"
        aria-label="Roles"
      >
        {roles.map((role) => {
          const Icon = role.icon;
          const selected = role.id === active.id;
          return (
            <button
              key={role.id}
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveId(role.id)}
              className={`relative flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors duration-300 ${
                selected
                  ? 'border-ai-white/60 text-ai-white'
                  : 'border-ai-gray-800 text-ai-gray-400 hover:border-ai-gray-600 hover:text-ai-gray-200'
              }`}
            >
              {selected && (
                <motion.span
                  layoutId="role-pill"
                  className="absolute inset-0 rounded-full bg-ai-gray-800/70"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              )}
              <Icon className="relative z-10 h-4 w-4" strokeWidth={1.5} />
              <span className="relative z-10 whitespace-nowrap">{role.label}</span>
            </button>
          );
        })}
      </div>

      {/* Panel */}
      <AnimatePresence mode="wait">
        <motion.div
          key={active.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="edge-card glassmorphism rounded-2xl border border-ai-gray-800 p-5 sm:p-8 lg:p-10"
        >
          <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:gap-12">
            {/* Left: who it is */}
            <div>
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-ai-white sm:h-14 sm:w-14">
                <ActiveIcon className="h-6 w-6 text-ai-black sm:h-7 sm:w-7" strokeWidth={1.5} />
              </div>

              <h3 className="mb-3 text-xl font-bold tracking-tight text-ai-white sm:text-2xl md:text-3xl">
                {active.headline}
              </h3>
              <p className="mb-6 text-sm leading-relaxed text-ai-gray-300 sm:text-base">
                {active.summary}
              </p>

              <div className="rounded-xl border border-ai-gray-800 bg-ai-black/50 p-4">
                <div className="mb-1.5 text-[11px] uppercase tracking-[0.16em] text-ai-gray-600">
                  Not granted
                </div>
                <p className="text-sm text-ai-gray-400">{active.boundary}</p>
              </div>

              <button
                onClick={onOpen}
                className="group mt-6 inline-flex items-center gap-2 text-sm font-medium text-ai-white"
              >
                Open this workspace
                <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </button>
            </div>

            {/* Right: what they get */}
            <div>
              <div className="mb-3 text-[11px] uppercase tracking-[0.16em] text-ai-gray-600">
                Capabilities
              </div>
              <ul className="mb-7 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {active.abilities.map((ability, index) => (
                  <motion.li
                    key={ability}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.03 * index }}
                    className="flex items-start gap-2.5 text-sm text-ai-gray-300"
                  >
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-ai-white" strokeWidth={2} />
                    <span>{ability}</span>
                  </motion.li>
                ))}
              </ul>

              <div className="mb-3 text-[11px] uppercase tracking-[0.16em] text-ai-gray-600">
                Screens
              </div>
              <div className="flex flex-wrap gap-2">
                {active.screens.map((screen) => (
                  <code
                    key={screen}
                    className="rounded-md border border-ai-gray-800 bg-ai-black px-2.5 py-1 text-[11px] text-ai-gray-400 transition-colors duration-300 hover:border-ai-gray-600 hover:text-ai-gray-200"
                  >
                    {screen}
                  </code>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default RoleTabs;
