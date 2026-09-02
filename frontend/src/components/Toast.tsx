import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

/**
 * In-app notifications.
 *
 * Everything here used to be `window.alert`. That dialog is drawn by the
 * browser, not the product: it says "project-drishti-seven.vercel.app says"
 * above the message, it blocks the whole page until dismissed, it cannot be
 * styled, and on an operations console it stops an operator from seeing the
 * incident list behind it. A safety tool that freezes the screen to say
 * "Event created successfully" is a worse tool than one that does not.
 *
 * These sit in the corner, stack, dismiss themselves, and never take the page
 * away from whoever is using it. Errors stay until dismissed, because an
 * operator who looked away must still find out that the thing they asked for
 * did not happen.
 */

export type ToastKind = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  detail?: string;
}

interface ToastContextValue {
  /** Shows a notification. Errors persist until dismissed; the rest fade. */
  notify: (kind: ToastKind, title: string, detail?: string) => void;
  success: (title: string, detail?: string) => void;
  error: (title: string, detail?: string) => void;
  info: (title: string, detail?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used inside <ToastProvider>');
  }
  return context;
};

const PRESENTATION: Record<
  ToastKind,
  { icon: typeof Info; ring: string; iconClass: string }
> = {
  success: {
    icon: CheckCircle2,
    ring: 'border-emerald-500/40',
    iconClass: 'text-emerald-400',
  },
  error: {
    icon: AlertTriangle,
    ring: 'border-red-500/50',
    iconClass: 'text-red-400',
  },
  info: {
    icon: Info,
    ring: 'border-ai-gray-700',
    iconClass: 'text-ai-gray-300',
  },
};

let nextId = 1;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (kind: ToastKind, title: string, detail?: string) => {
      const id = nextId++;
      setToasts((current) => [...current, { id, kind, title, detail }]);

      // An error stays put. Anything else has been read or does not matter.
      if (kind !== 'error') {
        setTimeout(() => dismiss(id), 5000);
      }
    },
    [dismiss]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      notify,
      success: (title, detail) => notify('success', title, detail),
      error: (title, detail) => notify('error', title, detail),
      info: (title, detail) => notify('info', title, detail),
    }),
    [notify]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div
        className="fixed z-[100] bottom-4 right-4 left-4 sm:left-auto sm:w-96 flex flex-col gap-2 pointer-events-none"
        role="status"
        aria-live="polite"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => {
            const presentation = PRESENTATION[toast.kind];
            const Icon = presentation.icon;

            return (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ duration: 0.18 }}
                className={`pointer-events-auto rounded-xl border ${presentation.ring} bg-ai-black/95 backdrop-blur-sm p-3.5 shadow-lg shadow-black/40`}
              >
                <div className="flex items-start gap-3">
                  <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${presentation.iconClass}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ai-white break-anywhere">{toast.title}</p>
                    {toast.detail && (
                      <p className="text-xs text-ai-gray-400 mt-1 break-anywhere">{toast.detail}</p>
                    )}
                  </div>
                  <button
                    onClick={() => dismiss(toast.id)}
                    aria-label="Dismiss"
                    className="icon-btn shrink-0 p-0.5 text-ai-gray-500 hover:text-ai-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};
