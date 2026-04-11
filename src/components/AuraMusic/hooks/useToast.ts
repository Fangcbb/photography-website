import { createContext, useContext } from 'react';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
}

interface ToastContextType {
    toast: {
        success: (message: string, duration?: number) => void;
        error: (message: string, duration?: number) => void;
        info: (message: string, duration?: number) => void;
    };
}

export const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        // Return a no-op toast if not in provider (prevents crashes in SSR/client)
        return {
            toast: {
                success: () => {},
                error: () => {},
                info: () => {},
            }
        };
    }
    return context;
};
