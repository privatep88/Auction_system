import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ConfirmationDialog,
  ErrorDialog,
  InfoDialog,
  SensitiveImpactMeta,
  SuccessToast,
  ToastItem,
  ToastVariant,
  WarningDialog,
} from '../components/SmartDialogs';
import { Language } from '../types/auction';

export interface ShowErrorOptions {
  title: string;
  message: string;
  details?: string[];
  hint?: string;
  confirmText?: string;
}

export interface ShowWarningOptions {
  title: string;
  message: string;
  details?: string[];
  primaryText?: string;
  secondaryText?: string;
  impactMeta?: SensitiveImpactMeta;
  onProceed?: () => void;
}

export interface ShowInfoOptions {
  title: string;
  message: string;
  details?: string[];
  confirmText?: string;
}

export interface ConfirmActionOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  impactMeta?: SensitiveImpactMeta;
  onConfirm?: () => void | Promise<void>;
}

export interface ShowToastOptions {
  variant: ToastVariant;
  title: string;
  message?: string;
  durationMs?: number;
}

type ActiveModalState =
  | { type: 'error'; options: ShowErrorOptions }
  | { type: 'warning'; options: ShowWarningOptions }
  | { type: 'info'; options: ShowInfoOptions }
  | {
      type: 'confirm';
      options: ConfirmActionOptions;
      resolve: (confirmed: boolean) => void;
    };

interface NotificationContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  showToast: (opts: ShowToastOptions) => string;
  updateToast: (
    id: string,
    patch: Partial<ShowToastOptions>
  ) => void;
  dismissToast: (id: string) => void;
  showSuccess: (title: string, message?: string) => string;
  showError: (opts: ShowErrorOptions) => void;
  showWarning: (opts: ShowWarningOptions) => void;
  showInfo: (opts: ShowInfoOptions) => void;
  confirmAction: (opts: ConfirmActionOptions) => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextValue | null>(
  null
);

export const NotificationProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [lang, setLang] = useState<Language>('ar');
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [activeModal, setActiveModal] = useState<ActiveModalState | null>(null);
  const [confirmLoading, setConfirmLoading] = useState<boolean>(false);

  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const confirmLockRef = useRef<boolean>(false);

  const clearToastTimer = useCallback((id: string) => {
    const t = timersRef.current[id];
    if (t) {
      clearTimeout(t);
      delete timersRef.current[id];
    }
  }, []);

  const dismissToast = useCallback(
    (id: string) => {
      clearToastTimer(id);
      setToasts((prev) => prev.filter((item) => item.id !== id));
    },
    [clearToastTimer]
  );

  const scheduleAutoDismiss = useCallback(
    (id: string, variant: ToastVariant, durationMs?: number) => {
      clearToastTimer(id);
      if (variant === 'loading') return;
      const delay = durationMs ?? (variant === 'error' ? 5200 : 3800);
      if (delay <= 0) return;
      timersRef.current[id] = setTimeout(() => {
        dismissToast(id);
      }, delay);
    },
    [clearToastTimer, dismissToast]
  );

  const showToast = useCallback(
    (opts: ShowToastOptions): string => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const item: ToastItem = {
        id,
        variant: opts.variant,
        title: opts.title,
        message: opts.message,
      };
      setToasts((prev) => {
        const trimmed = prev.length >= 3 ? prev.slice(prev.length - 2) : prev;
        return [...trimmed, item];
      });
      scheduleAutoDismiss(id, opts.variant, opts.durationMs);
      return id;
    },
    [scheduleAutoDismiss]
  );

  const updateToast = useCallback(
    (id: string, patch: Partial<ShowToastOptions>) => {
      setToasts((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;
          const nextVariant = patch.variant ?? item.variant;
          scheduleAutoDismiss(id, nextVariant, patch.durationMs);
          return {
            ...item,
            variant: nextVariant,
            title: patch.title ?? item.title,
            message: patch.message !== undefined ? patch.message : item.message,
          };
        })
      );
    },
    [scheduleAutoDismiss]
  );

  const showSuccess = useCallback(
    (title: string, message?: string) =>
      showToast({ variant: 'success', title, message }),
    [showToast]
  );

  const showError = useCallback((opts: ShowErrorOptions) => {
    setActiveModal((prev) => {
      if (prev?.type === 'confirm' && confirmLockRef.current) {
        return prev;
      }
      return { type: 'error', options: opts };
    });
  }, []);

  const showWarning = useCallback((opts: ShowWarningOptions) => {
    setActiveModal((prev) => {
      if (prev?.type === 'confirm' && confirmLockRef.current) {
        return prev;
      }
      return { type: 'warning', options: opts };
    });
  }, []);

  const showInfo = useCallback((opts: ShowInfoOptions) => {
    setActiveModal((prev) => {
      if (prev?.type === 'confirm' && confirmLockRef.current) {
        return prev;
      }
      return { type: 'info', options: opts };
    });
  }, []);

  const confirmAction = useCallback(
    (opts: ConfirmActionOptions): Promise<boolean> => {
      // Prevent two overlapping confirmation dialogs at once
      if (confirmLockRef.current) {
        return Promise.resolve(false);
      }
      confirmLockRef.current = true;
      setConfirmLoading(false);

      return new Promise<boolean>((resolve) => {
        setActiveModal({
          type: 'confirm',
          options: opts,
          resolve,
        });
      });
    },
    []
  );

  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach(clearTimeout);
    };
  }, []);

  const handleCloseNonConfirm = useCallback(() => {
    setActiveModal(null);
  }, []);

  const handleCancelConfirm = useCallback(() => {
    if (confirmLoading) return;
    setActiveModal((prev) => {
      if (prev?.type === 'confirm') {
        prev.resolve(false);
      }
      return null;
    });
    confirmLockRef.current = false;
  }, [confirmLoading]);

  const handleProceedConfirm = useCallback(async () => {
    if (activeModal?.type !== 'confirm' || confirmLoading) return;
    const current = activeModal;

    if (current.options.onConfirm) {
      try {
        setConfirmLoading(true);
        await current.options.onConfirm();
        setConfirmLoading(false);
        confirmLockRef.current = false;
        setActiveModal(null);
        current.resolve(true);
      } catch (err) {
        setConfirmLoading(false);
        confirmLockRef.current = false;
        setActiveModal(null);
        current.resolve(false);
        const isAr = lang === 'ar';
        showError({
          title: isAr ? 'تعذر إتمام الإجراء' : 'Action Could Not Be Completed',
          message:
            err instanceof Error && err.message
              ? err.message
              : isAr
              ? 'حدث خطأ غير متوقع أثناء تنفيذ الإجراء المطلوب.'
              : 'An unexpected error occurred while executing the requested action.',
        });
      }
    } else {
      confirmLockRef.current = false;
      setActiveModal(null);
      current.resolve(true);
    }
  }, [activeModal, confirmLoading, lang, showError]);

  return (
    <NotificationContext.Provider
      value={{
        lang,
        setLang,
        showToast,
        updateToast,
        dismissToast,
        showSuccess,
        showError,
        showWarning,
        showInfo,
        confirmAction,
      }}
    >
      {children}

      {/* Centralized Toast Viewport */}
      {toasts.length > 0 && (
        <div
          dir={lang === 'ar' ? 'rtl' : 'ltr'}
          aria-live="polite"
          className="no-print pointer-events-none fixed bottom-4 end-4 z-[80] flex flex-col gap-2 items-end max-w-[calc(100vw-2rem)]"
        >
          {toasts.map((toast) => (
            <SuccessToast
              key={toast.id}
              toast={toast}
              lang={lang}
              onDismiss={dismissToast}
            />
          ))}
        </div>
      )}

      {/* Centralized Managed Dialogs */}
      {activeModal?.type === 'error' && (
        <ErrorDialog
          isOpen={true}
          onClose={handleCloseNonConfirm}
          lang={lang}
          title={activeModal.options.title}
          message={activeModal.options.message}
          details={activeModal.options.details}
          hint={activeModal.options.hint}
          confirmText={activeModal.options.confirmText}
        />
      )}

      {activeModal?.type === 'warning' && (
        <WarningDialog
          isOpen={true}
          onClose={handleCloseNonConfirm}
          onProceed={
            activeModal.options.onProceed
              ? () => {
                  const cb = activeModal.options.onProceed;
                  setActiveModal(null);
                  cb?.();
                }
              : undefined
          }
          lang={lang}
          title={activeModal.options.title}
          message={activeModal.options.message}
          details={activeModal.options.details}
          primaryText={activeModal.options.primaryText}
          secondaryText={activeModal.options.secondaryText}
          impactMeta={activeModal.options.impactMeta}
        />
      )}

      {activeModal?.type === 'info' && (
        <InfoDialog
          isOpen={true}
          onClose={handleCloseNonConfirm}
          lang={lang}
          title={activeModal.options.title}
          message={activeModal.options.message}
          details={activeModal.options.details}
          confirmText={activeModal.options.confirmText}
        />
      )}

      {activeModal?.type === 'confirm' && (
        <ConfirmationDialog
          isOpen={true}
          onCancel={handleCancelConfirm}
          onConfirm={handleProceedConfirm}
          lang={lang}
          title={activeModal.options.title}
          message={activeModal.options.message}
          confirmText={activeModal.options.confirmText}
          cancelText={activeModal.options.cancelText}
          destructive={activeModal.options.destructive}
          isLoading={confirmLoading}
          impactMeta={activeModal.options.impactMeta}
        />
      )}
    </NotificationContext.Provider>
  );
};

export function useNotification(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error(
      'useNotification must be used inside a NotificationProvider'
    );
  }
  return ctx;
}
