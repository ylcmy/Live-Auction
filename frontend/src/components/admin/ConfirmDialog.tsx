import { useState, useCallback, createContext, useContext, type ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/design-system/components/ui/dialog';
import { AlertTriangle, Trash2, Info } from 'lucide-react';

type ConfirmVariant = 'danger' | 'warning' | 'info';

interface ConfirmOptions {
  title: string;
  description: string;
  variant?: ConfirmVariant;
  confirmText?: string;
  cancelText?: string;
}

interface ConfirmState extends ConfirmOptions {
  open: boolean;
  resolve: ((value: boolean) => void) | null;
}

const initialState: ConfirmState = {
  open: false,
  title: '',
  description: '',
  variant: 'info',
  confirmText: '确认',
  cancelText: '取消',
  resolve: null,
};

const ConfirmContext = createContext<{
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}>({ confirm: () => Promise.resolve(false) });

export function useConfirm() {
  return useContext(ConfirmContext);
}

const VARIANT_CONFIG: Record<ConfirmVariant, {
  icon: typeof AlertTriangle;
  iconBg: string;
  iconColor: string;
  confirmBg: string;
  confirmHover: string;
  confirmText: string;
}> = {
  danger: {
    icon: Trash2,
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    confirmBg: 'bg-red-600 hover:bg-red-700',
    confirmHover: 'shadow-red-200',
    confirmText: '删除',
  },
  warning: {
    icon: AlertTriangle,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    confirmBg: 'bg-amber-600 hover:bg-amber-700',
    confirmHover: 'shadow-amber-200',
    confirmText: '确认',
  },
  info: {
    icon: Info,
    iconBg: 'bg-sky-100',
    iconColor: 'text-sky-600',
    confirmBg: 'bg-brand hover:bg-brand-hover',
    confirmHover: 'shadow-brand/20',
    confirmText: '确认',
  },
};

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState>(initialState);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        ...initialState,
        ...options,
        open: true,
        resolve,
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    state.resolve?.(true);
    setState((prev) => ({ ...prev, open: false }));
  }, [state.resolve]);

  const handleCancel = useCallback(() => {
    state.resolve?.(false);
    setState((prev) => ({ ...prev, open: false }));
  }, [state.resolve]);

  const config = VARIANT_CONFIG[state.variant ?? 'info'];
  const Icon = config.icon;

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <Dialog open={state.open} onOpenChange={(open) => { if (!open) handleCancel(); }}>
        <DialogContent className="sm:max-w-[425px] bg-white border-slate-200 p-0 gap-0 overflow-hidden rounded-2xl shadow-2xl">
          <div className="p-6 pb-4">
            <DialogHeader className="flex flex-row items-start gap-4 space-y-0">
              <div className={`flex-shrink-0 w-11 h-11 rounded-xl ${config.iconBg} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${config.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <DialogTitle className="text-base font-semibold text-slate-900 leading-snug">
                  {state.title}
                </DialogTitle>
                <DialogDescription className="text-sm text-slate-500 mt-1.5 leading-relaxed">
                  {state.description}
                </DialogDescription>
              </div>
            </DialogHeader>
          </div>
          <DialogFooter className="px-6 pb-6 pt-2 gap-2 sm:gap-2">
            <button
              onClick={handleCancel}
              className="flex-1 h-10 rounded-xl text-sm font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
            >
              {state.cancelText}
            </button>
            <button
              onClick={handleConfirm}
              className={`flex-1 h-10 rounded-xl text-sm font-medium text-white transition-all ${config.confirmBg} shadow-lg ${config.confirmHover} active:scale-[0.97]`}
            >
              {state.confirmText ?? config.confirmText}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}
