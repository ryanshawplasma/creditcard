import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Info, AlertTriangle, XCircle, Undo2 } from 'lucide-react';
import { cn, uid } from '@/lib/utils';

type ToastKind = 'success' | 'error' | 'info' | 'warning';
interface Toast {
  id: string;
  kind: ToastKind;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

interface ToastCtx {
  toast: (t: Omit<Toast, 'id'>) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  /** Show a toast with an inline Undo action. */
  withUndo: (title: string, onUndo: () => void, description?: string) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

const iconFor: Record<ToastKind, ReactNode> = {
  success: <CheckCircle2 className="text-success" size={18} />,
  error: <XCircle className="text-danger" size={18} />,
  info: <Info className="text-info" size={18} />,
  warning: <AlertTriangle className="text-warning" size={18} />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const toast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = uid('toast_');
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => dismiss(id), t.action ? 6000 : 3800);
  }, [dismiss]);

  const success = useCallback((title: string, description?: string) => toast({ kind: 'success', title, description }), [toast]);
  const error = useCallback((title: string, description?: string) => toast({ kind: 'error', title, description }), [toast]);
  const info = useCallback((title: string, description?: string) => toast({ kind: 'info', title, description }), [toast]);
  const withUndo = useCallback(
    (title: string, onUndo: () => void, description?: string) =>
      toast({ kind: 'info', title, description, action: { label: 'Undo', onClick: onUndo } }),
    [toast],
  );

  return (
    <Ctx.Provider value={{ toast, success, error, info, withUndo }}>
      {children}
      {createPortal(
        <div className="fixed bottom-5 right-5 z-[60] flex w-[360px] max-w-[calc(100vw-2.5rem)] flex-col gap-2">
          <AnimatePresence>
            {toasts.map((t) => (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                className="glass-strong flex items-start gap-3 rounded-2xl p-3.5 shadow-lift"
              >
                <div className="mt-0.5 shrink-0">{iconFor[t.kind]}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-fg">{t.title}</p>
                  {t.description && <p className="mt-0.5 text-xs text-muted">{t.description}</p>}
                </div>
                {t.action && (
                  <button
                    onClick={() => {
                      t.action!.onClick();
                      dismiss(t.id);
                    }}
                    className={cn('flex items-center gap-1 rounded-lg bg-surface-2 px-2.5 py-1 text-xs font-medium text-accent hover:bg-elevated')}
                  >
                    <Undo2 size={13} /> {t.action.label}
                  </button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>,
        document.body,
      )}
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
