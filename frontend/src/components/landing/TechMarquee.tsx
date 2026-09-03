import React from 'react';

interface TechMarqueeProps {
  items: string[];
}

/**
 * One half of the ticker. Declared at module scope, not inside TechMarquee —
 * a component defined during render is a new type on every render, which
 * remounts the list and restarts the CSS animation from zero mid-scroll.
 */
const MarqueeRow: React.FC<{ items: string[]; duplicate?: boolean }> = ({ items, duplicate }) => (
  <ul className="flex shrink-0 items-center" aria-hidden={duplicate || undefined}>
    {items.map((item) => (
      <li
        key={item}
        className="flex shrink-0 items-center gap-6 px-6 text-sm font-medium tracking-wide text-ai-gray-500 sm:gap-8 sm:px-8"
      >
        <span className="whitespace-nowrap transition-colors duration-300 hover:text-ai-white">
          {item}
        </span>
        <span className="h-1 w-1 rounded-full bg-ai-gray-700" />
      </li>
    ))}
  </ul>
);

/**
 * Continuous ticker of the stack this platform actually runs on. The list is
 * rendered twice and the track translates exactly -50%, so the loop is seamless.
 */
const TechMarquee: React.FC<TechMarqueeProps> = ({ items }) => (
  <div className="marquee-viewport w-full">
    <div className="marquee-track">
      <MarqueeRow items={items} />
      {/* Second copy exists only to make the wrap invisible */}
      <MarqueeRow items={items} duplicate />
    </div>
  </div>
);

export default TechMarquee;
