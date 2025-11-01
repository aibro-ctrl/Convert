import * as React from "react";

// Toast notification context and implementation
interface Toast {
  id: string;
  message: string;
  description?: string;
  type: 'success' | 'error' | 'info';
}

const ToastContext = React.createContext<{
  toasts: Toast[];
  addToast: (message: string, type: Toast['type'], description?: string) => void;
}>({ toasts: [], addToast: () => {} });

let toastCounter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const addToast = React.useCallback((message: string, type: Toast['type'], description?: string) => {
    const id = `toast-${++toastCounter}`;
    setToasts(prev => [...prev, { id, message, description, type }]);

    // Auto remove after 5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function Toaster() {
  const { toasts } = React.useContext(ToastContext);

  return (
    <div className="fixed bottom-0 right-0 z-50 p-4 space-y-2 pointer-events-none max-w-md">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`
            pointer-events-auto
            w-full
            rounded-lg shadow-lg p-4
            animate-in slide-in-from-right
            ${toast.type === 'success' ? 'bg-green-600 text-white' : ''}
            ${toast.type === 'error' ? 'bg-red-600 text-white' : ''}
            ${toast.type === 'info' ? 'bg-blue-600 text-white' : ''}
          `}
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              {toast.type === 'success' && <span className="text-xl">✓</span>}
              {toast.type === 'error' && <span className="text-xl">✕</span>}
              {toast.type === 'info' && <span className="text-xl">ℹ</span>}
            </div>
            <div className="flex-1">
              <p className="font-semibold">{toast.message}</p>
              {toast.description && (
                <p className="text-sm mt-1 opacity-90">{toast.description}</p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Export toast function for use in components
export const toast = {
  success: (message: string, options?: { description?: string }) => {
    window.dispatchEvent(new CustomEvent('toast', { 
      detail: { message, type: 'success', description: options?.description } 
    }));
  },
  error: (message: string, options?: { description?: string }) => {
    window.dispatchEvent(new CustomEvent('toast', { 
      detail: { message, type: 'error', description: options?.description } 
    }));
  },
  info: (message: string, options?: { description?: string }) => {
    window.dispatchEvent(new CustomEvent('toast', { 
      detail: { message, type: 'info', description: options?.description } 
    }));
  },
};

// Hook to setup toast listener
export function useToastListener() {
  const { addToast } = React.useContext(ToastContext);

  React.useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<{ message: string; type: Toast['type']; description?: string }>;
      addToast(customEvent.detail.message, customEvent.detail.type, customEvent.detail.description);
    };

    window.addEventListener('toast', handler);
    return () => window.removeEventListener('toast', handler);
  }, [addToast]);
}
