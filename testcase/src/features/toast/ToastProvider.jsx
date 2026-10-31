import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

const ToastContext = createContext(null);

/**
 * Renders one toast and removes it after its lifetime.
 * @param {{ toast: { id: number, message: string, tone: string }, onDismiss: (id: number) => void }} props
 */
function ToastItem({ toast, onDismiss }) {
  useEffect(() => {
    const timeout = window.setTimeout(() => onDismiss(toast.id), 4200);
    return () => window.clearTimeout(timeout);
  }, [toast.id, onDismiss]);

  return (
    <output className={`toast toast--${toast.tone}`}>
      <span className="toast__dot" aria-hidden="true" />
      <span>{toast.message}</span>
      <button type="button" className="toast__close" onClick={() => onDismiss(toast.id)}>
        Dismiss
      </button>
    </output>
  );
}

/**
 * Provides transient status messages rendered in a portal above the app.
 * @param {{ children: unknown }} props
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback((message, tone = 'info') => {
    const id = nextId.current;
    nextId.current += 1;
    setToasts((current) => [...current, { id, message, tone }]);
    return id;
  }, []);

  const value = useMemo(() => ({ addToast }), [addToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * Returns the toast API.
 */
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider.');
  return context;
}
