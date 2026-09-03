import React, { useEffect, useRef, useState } from 'react';
import { useInView } from 'framer-motion';

interface CountUpProps {
  to: number;
  decimals?: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

/**
 * Counts from zero to `to` the first time the number scrolls into view.
 * Driven by requestAnimationFrame rather than an interval so it stays on the
 * compositor's clock, and it settles on the exact target value.
 */
const CountUp: React.FC<CountUpProps> = ({
  to,
  decimals = 0,
  duration = 1400,
  prefix = '',
  suffix = '',
  className = '',
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;

    // Honour the OS setting: jump straight to the final value.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(to);
      return;
    }

    let frame: number;
    const start = performance.now();
    // easeOutExpo — fast off the line, long settle, so the final digits are readable
    const ease = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      setValue(to * ease(progress));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, to, duration]);

  return (
    <span ref={ref} className={`tabular ${className}`}>
      {prefix}
      {value.toFixed(decimals)}
      {suffix}
    </span>
  );
};

export default CountUp;
