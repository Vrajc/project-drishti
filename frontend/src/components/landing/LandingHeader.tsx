import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, ArrowRight } from 'lucide-react';
import GradientButton from '../GradientButton';

export interface NavSection {
  id: string;
  label: string;
}

interface LandingHeaderProps {
  sections: NavSection[];
  onLogin: () => void;
  onRegister: () => void;
}

/**
 * Page header. Starts transparent over the hero and hardens into glass once
 * you leave it, tracks which section is being read, and collapses to a sheet
 * below `md`, where six items cannot share a 4rem bar.
 */
const LandingHeader: React.FC<LandingHeaderProps> = ({ sections, onLogin, onRegister }) => {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<string>('');
  const [menuOpen, setMenuOpen] = useState(false);

  // Hardened state, coalesced to one read per frame
  useEffect(() => {
    let frame: number | undefined;
    const read = () => {
      frame = undefined;
      setScrolled(window.scrollY > 24);
    };
    const onScroll = () => {
      if (frame === undefined) frame = requestAnimationFrame(read);
    };
    read();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, []);

  // Which section sits under the reading line, roughly a third down the viewport
  useEffect(() => {
    const observed = sections
      .map((section) => document.getElementById(section.id))
      .filter((el): el is HTMLElement => el !== null);

    if (observed.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: '-30% 0px -55% 0px', threshold: [0, 0.25, 0.5, 1] }
    );

    observed.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sections]);

  // A sheet that covers the page must not leave the page scrolling behind it
  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [menuOpen]);

  // Escape closes the sheet, as a dialog should
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const jump = (id: string) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      <motion.header
        initial={{ opacity: 0, y: -24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
          scrolled
            ? 'glassmorphism border-b border-ai-gray-800 shadow-[0_8px_32px_rgba(0,0,0,0.6)]'
            : 'border-b border-transparent bg-transparent'
        }`}
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="page-container">
          <div
            className={`flex items-center justify-between gap-3 transition-[height] duration-500 ${
              scrolled ? 'h-14' : 'h-16 sm:h-20'
            }`}
          >
            {/* Mark */}
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="group flex shrink-0 items-center gap-2.5 sm:gap-3"
              aria-label="Drishti, back to top"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-ai-white transition-transform duration-500 group-hover:rotate-90 sm:h-9 sm:w-9">
                <span className="text-base font-bold text-ai-black sm:text-lg">&#10022;</span>
              </span>
              <span className="flex flex-col items-start leading-none">
                <span className="text-lg font-bold tracking-tight sm:text-xl">Drishti</span>
                <span className="hidden text-[10px] uppercase tracking-[0.22em] text-ai-gray-500 sm:block">
                  Event Safety
                </span>
              </span>
            </button>

            {/* Section nav, desktop */}
            <nav className="hidden items-center gap-1 md:flex" aria-label="Sections">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => jump(section.id)}
                  className={`relative rounded-lg px-3 py-2 text-sm transition-colors duration-300 ${
                    active === section.id
                      ? 'text-ai-white'
                      : 'text-ai-gray-400 hover:text-ai-gray-200'
                  }`}
                >
                  {section.label}
                  {active === section.id && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute inset-x-2 -bottom-0.5 h-px bg-ai-white"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                </button>
              ))}
            </nav>

            {/* Actions */}
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <GradientButton onClick={onLogin} variant="ghost" className="hidden xs:inline-flex">
                Login
              </GradientButton>
              <GradientButton onClick={onRegister} variant="primary">
                <span className="hidden xs:inline">Get Started</span>
                <span className="xs:hidden">Start</span>
              </GradientButton>
              <button
                onClick={() => setMenuOpen(true)}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-ai-gray-800 text-ai-gray-300 transition-colors hover:text-ai-white md:hidden"
                aria-label="Open menu"
                aria-expanded={menuOpen}
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Mobile sheet */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[70] md:hidden"
            role="dialog"
            aria-modal="true"
          >
            <div
              className="absolute inset-0 bg-ai-black/80 backdrop-blur-md"
              onClick={() => setMenuOpen(false)}
            />
            <motion.div
              initial={{ y: -24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -24, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="glassmorphism-strong relative m-3 rounded-2xl border border-ai-gray-800 p-5"
              style={{ marginTop: 'max(0.75rem, env(safe-area-inset-top))' }}
            >
              <div className="mb-5 flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.22em] text-ai-gray-500">
                  Navigate
                </span>
                <button
                  onClick={() => setMenuOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-ai-gray-800 text-ai-gray-300"
                  aria-label="Close menu"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <nav className="flex flex-col">
                {sections.map((section, i) => (
                  <motion.button
                    key={section.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.04 * i }}
                    onClick={() => jump(section.id)}
                    className="flex items-center justify-between border-b border-ai-gray-900 py-3.5 text-left text-base text-ai-gray-200 last:border-0"
                  >
                    <span className="flex items-center gap-3">
                      <span className="tabular text-[11px] text-ai-gray-600">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      {section.label}
                    </span>
                    <ArrowRight className="h-4 w-4 text-ai-gray-600" />
                  </motion.button>
                ))}
              </nav>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <GradientButton onClick={onLogin} variant="ghost" className="w-full">
                  Login
                </GradientButton>
                <GradientButton onClick={onRegister} variant="primary" className="w-full">
                  Get Started
                </GradientButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default LandingHeader;
