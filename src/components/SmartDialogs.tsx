import React, { useEffect, useId, useRef } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  ShieldAlert,
  X,
} from 'lucide-react';
import { Language } from '../types/auction';

export type AppDialogVariant =
  | 'navy'
  | 'error'
  | 'warning'
  | 'confirm'
  | 'info'
  | 'success';

export interface SensitiveImpactMeta {
  operationName: string;
  periodLabel?: string;
  affectedCountLabel?: string;
  impactDescription: string;
  reversibilityLabel?: string;
}

interface AppDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  variant?: AppDialogVariant;
  icon?: React.ReactNode;
  lang: Language;
  maxWidthClass?: string;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  isLoading?: boolean;
  role?: 'dialog' | 'alertdialog';
  children: React.ReactNode;
  footer?: React.ReactNode;
  zIndexClass?: string;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

let activeDialogLockCount = 0;

function lockBodyScroll(): () => void {
  if (typeof document === 'undefined') return () => {};
  activeDialogLockCount += 1;
  const prevOverflow = document.body.style.overflow;
  if (activeDialogLockCount === 1) {
    document.body.style.overflow = 'hidden';
  }
  return () => {
    activeDialogLockCount = Math.max(0, activeDialogLockCount - 1);
    if (activeDialogLockCount === 0) {
      document.body.style.overflow = prevOverflow || '';
    }
  };
}

function getDefaultVariantIcon(variant: AppDialogVariant) {
  switch (variant) {
    case 'error':
      return <AlertCircle className="w-5 h-5 text-[#FCA5A5]" />;
    case 'warning':
      return <AlertTriangle className="w-5 h-5 text-[#FCD34D]" />;
    case 'confirm':
      return <ShieldAlert className="w-5 h-5 text-[#D6A348]" />;
    case 'success':
      return <CheckCircle2 className="w-5 h-5 text-[#86EFAC]" />;
    case 'info':
      return <Info className="w-5 h-5 text-[#93C5FD]" />;
    case 'navy':
    default:
      return null;
  }
}

function getHeaderAccentStrip(variant: AppDialogVariant): string {
  switch (variant) {
    case 'error':
      return 'border-b-[3px] border-[#C52B36]';
    case 'warning':
      return 'border-b-[3px] border-[#D99A24]';
    case 'success':
      return 'border-b-[3px] border-[#16843B]';
    case 'info':
      return 'border-b-[3px] border-[#2467B2]';
    case 'confirm':
    case 'navy':
    default:
      return 'border-b-[3px] border-[#D6A348]';
  }
}

export const AppDialog: React.FC<AppDialogProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  variant = 'navy',
  icon,
  lang,
  maxWidthClass = 'max-w-[480px]',
  closeOnBackdrop = false,
  closeOnEscape = true,
  isLoading = false,
  role = 'dialog',
  children,
  footer,
  zIndexClass = 'z-50',
}) => {
  const isAr = lang === 'ar';
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previousActiveRef = useRef<HTMLElement | null>(null);

  // Capture opener focus and lock scroll cleanly
  useEffect(() => {
    if (!isOpen) return;
    previousActiveRef.current = document.activeElement as HTMLElement | null;
    const unlockScroll = lockBodyScroll();

    const rafId = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusables.length > 0) {
        // Focus first interactive element that isn't only the top X button if a form/primary action exists,
        // or focus panel itself for alertdialogs to avoid accidental destructive confirms
        if (role === 'alertdialog') {
          const cancelBtn = panel.querySelector<HTMLElement>(
            '[data-dialog-cancel="true"]'
          );
          if (cancelBtn) {
            cancelBtn.focus();
            return;
          }
        }
        focusables[0].focus();
      } else {
        panel.focus();
      }
    });

    return () => {
      cancelAnimationFrame(rafId);
      unlockScroll();
      const prev = previousActiveRef.current;
      if (prev && typeof prev.focus === 'function' && document.contains(prev)) {
        requestAnimationFrame(() => prev.focus());
      }
    };
  }, [isOpen, role]);

  // Keyboard Escape + Focus Trap (Tab / Shift+Tab)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const panel = panelRef.current;
      if (!panel) return;

      // Only handle key events for the topmost open dialog
      const allDialogs = document.querySelectorAll('[data-saaed-dialog="true"]');
      if (
        allDialogs.length > 0 &&
        allDialogs[allDialogs.length - 1] !== panel
      ) {
        return;
      }

      if (e.key === 'Escape') {
        if (closeOnEscape && !isLoading) {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
        return;
      }

      if (e.key === 'Tab') {
        const focusables = Array.from(
          panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        ).filter((el) => el.offsetParent !== null || el === document.activeElement);

        if (focusables.length === 0) {
          e.preventDefault();
          panel.focus();
          return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;

        if (e.shiftKey) {
          if (!active || active === first || !panel.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (!active || active === last || !panel.contains(active)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, closeOnEscape, isLoading, onClose]);

  if (!isOpen) return null;

  const resolvedIcon = icon ?? getDefaultVariantIcon(variant);

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && closeOnBackdrop && !isLoading) {
          onClose();
        }
      }}
      className={`no-print saaed-dialog-backdrop fixed inset-0 ${zIndexClass} bg-[#0A1E3A]/65 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-5 overflow-y-auto`}
    >
      <div
        ref={panelRef}
        data-saaed-dialog="true"
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
        className={`saaed-dialog-panel bg-white rounded-[18px] shadow-[0_22px_50px_-12px_rgba(12,35,68,0.42)] border border-[#CBD5E1] w-full ${maxWidthClass} max-h-[92vh] flex flex-col overflow-hidden focus:outline-none`}
      >
        {/* Corporate Deep Navy Header */}
        <div
          className={`bg-gradient-to-l from-[#123B70] to-[#175A9C] text-white px-5 py-3.5 flex items-center justify-between gap-3 shrink-0 ${getHeaderAccentStrip(
            variant
          )}`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {resolvedIcon && (
              <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
                {resolvedIcon}
              </div>
            )}
            <div className="min-w-0">
              <h2
                id={titleId}
                className="text-[15px] sm:text-base font-extrabold text-white leading-snug"
              >
                {title}
              </h2>
              {subtitle && (
                <p className="text-[11.5px] font-semibold text-white/80 mt-0.5 leading-snug">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            aria-label={isAr ? 'إغلاق النافذة' : 'Close dialog'}
            className="p-1.5 rounded-lg text-white/85 hover:text-white hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-[#D6A348] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div
          id={descId}
          className="p-5 sm:p-6 overflow-y-auto flex-1 text-[#0F172A]"
        >
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-5 sm:px-6 py-3.5 bg-[#F4F7FB] border-t border-[#E2E8F0] flex flex-wrap items-center justify-end gap-2.5 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

/* ============================================================================
   SENSITIVE OPERATION IMPACT SUMMARY BLOCK
   ============================================================================ */
export const SensitiveImpactPanel: React.FC<{
  meta: SensitiveImpactMeta;
  lang: Language;
  tone?: 'danger' | 'warning' | 'info';
}> = ({ meta, lang, tone = 'warning' }) => {
  const isAr = lang === 'ar';
  const boxClass =
    tone === 'danger'
      ? 'bg-red-50/80 border-red-200 text-[#7F1D1D]'
      : tone === 'info'
      ? 'bg-[#EEF3F9] border-[#BCC8D6] text-[#123B70]'
      : 'bg-amber-50/85 border-amber-200 text-[#78350F]';

  return (
    <div className={`mt-3 rounded-xl border p-3.5 text-xs space-y-2 ${boxClass}`}>
      <div className="flex items-start justify-between gap-2 border-b border-current/10 pb-1.5">
        <span className="font-bold opacity-80">
          {isAr ? 'العملية المطلوبة:' : 'Operation:'}
        </span>
        <span className="font-black text-end">{meta.operationName}</span>
      </div>

      {meta.periodLabel && (
        <div className="flex items-start justify-between gap-2">
          <span className="font-bold opacity-80">
            {isAr ? 'الشهر / السنة المتأثرة:' : 'Affected Period:'}
          </span>
          <span className="font-extrabold text-end">{meta.periodLabel}</span>
        </div>
      )}

      {meta.affectedCountLabel && (
        <div className="flex items-start justify-between gap-2">
          <span className="font-bold opacity-80">
            {isAr ? 'نطاق البيانات:' : 'Scope:'}
          </span>
          <span className="font-extrabold text-end">{meta.affectedCountLabel}</span>
        </div>
      )}

      <div className="pt-1 border-t border-current/10">
        <span className="font-bold opacity-80 block mb-0.5">
          {isAr ? 'الأثر المترتب:' : 'Impact:'}
        </span>
        <p className="font-semibold leading-relaxed">{meta.impactDescription}</p>
      </div>

      {meta.reversibilityLabel && (
        <div className="pt-1 text-[11px] font-extrabold opacity-90 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
          <span>{meta.reversibilityLabel}</span>
        </div>
      )}
    </div>
  );
};

/* ============================================================================
   ERROR DIALOG
   ============================================================================ */
export interface ErrorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  title: string;
  message: string;
  details?: string[];
  hint?: string;
  confirmText?: string;
  zIndexClass?: string;
}

export const ErrorDialog: React.FC<ErrorDialogProps> = ({
  isOpen,
  onClose,
  lang,
  title,
  message,
  details,
  hint,
  confirmText,
  zIndexClass = 'z-[70]',
}) => {
  const isAr = lang === 'ar';
  return (
    <AppDialog
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      variant="error"
      role="alertdialog"
      lang={lang}
      maxWidthClass="max-w-[490px]"
      closeOnBackdrop={false}
      zIndexClass={zIndexClass}
      footer={
        <button
          type="button"
          data-dialog-cancel="true"
          onClick={onClose}
          className="px-5 py-2 text-xs sm:text-[13px] font-extrabold text-white bg-[#123B70] hover:bg-[#175A9C] focus:outline-none focus:ring-2 focus:ring-[#2467B2]/40 rounded-xl shadow-xs transition-colors cursor-pointer"
        >
          {confirmText || (isAr ? 'العودة للتصحيح' : 'Return & Fix')}
        </button>
      }
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
          <AlertCircle className="w-5 h-5 text-[#C52B36]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] sm:text-sm font-bold text-[#1E293B] leading-relaxed">
            {message}
          </p>
        </div>
      </div>

      {details && details.length > 0 && (
        <ul className="mt-4 bg-[#FFF5F5] border border-red-200 rounded-xl p-3.5 space-y-2 text-xs font-bold text-[#991B1B]">
          {details.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 leading-relaxed">
              <span className="w-1.5 h-1.5 rounded-full bg-[#C52B36] mt-1.5 shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}

      {hint && (
        <div className="mt-3.5 bg-[#F4F7FB] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs font-semibold text-[#475569] leading-relaxed">
          {hint}
        </div>
      )}
    </AppDialog>
  );
};

/* ============================================================================
   CONFIRMATION DIALOG
   ============================================================================ */
export interface ConfirmationDialogProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  lang: Language;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  isLoading?: boolean;
  impactMeta?: SensitiveImpactMeta;
  zIndexClass?: string;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  onCancel,
  onConfirm,
  lang,
  title,
  message,
  confirmText,
  cancelText,
  destructive = false,
  isLoading = false,
  impactMeta,
  zIndexClass = 'z-[65]',
}) => {
  const isAr = lang === 'ar';

  return (
    <AppDialog
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      variant={destructive ? 'error' : 'confirm'}
      icon={
        destructive ? (
          <AlertTriangle className="w-5 h-5 text-[#FCA5A5]" />
        ) : (
          <ShieldAlert className="w-5 h-5 text-[#D6A348]" />
        )
      }
      role="alertdialog"
      lang={lang}
      maxWidthClass="max-w-[500px]"
      closeOnBackdrop={false}
      closeOnEscape={!isLoading}
      isLoading={isLoading}
      zIndexClass={zIndexClass}
      footer={
        <>
          <button
            type="button"
            data-dialog-cancel="true"
            disabled={isLoading}
            onClick={onCancel}
            className="px-4 py-2 text-xs sm:text-[13px] font-bold text-[#334155] bg-white hover:bg-slate-100 border border-[#CBD5E1] focus:outline-none focus:ring-2 focus:ring-slate-300 rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelText || (isAr ? 'إلغاء' : 'Cancel')}
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={onConfirm}
            className={`flex items-center gap-1.5 px-5 py-2 text-xs sm:text-[13px] font-extrabold text-white rounded-xl shadow-xs focus:outline-none focus:ring-2 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
              destructive
                ? 'bg-[#C52B36] hover:bg-[#A1212B] focus:ring-[#C52B36]/40'
                : 'bg-[#123B70] hover:bg-[#175A9C] focus:ring-[#2467B2]/40'
            }`}
          >
            {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>
              {confirmText ||
                (destructive
                  ? isAr
                    ? 'تأكيد الحذف'
                    : 'Confirm Delete'
                  : isAr
                  ? 'تأكيد الإجراء'
                  : 'Confirm Action')}
            </span>
          </button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
            destructive
              ? 'bg-red-50 border-red-200 text-[#C52B36]'
              : 'bg-amber-50 border-amber-200 text-[#D99A24]'
          }`}
        >
          <AlertTriangle className="w-5 h-5" />
        </div>
        <p className="text-[13px] sm:text-sm font-bold text-[#1E293B] leading-relaxed">
          {message}
        </p>
      </div>

      {impactMeta && (
        <SensitiveImpactPanel
          meta={impactMeta}
          lang={lang}
          tone={destructive ? 'danger' : 'warning'}
        />
      )}
    </AppDialog>
  );
};

/* ============================================================================
   WARNING DIALOG
   ============================================================================ */
export interface WarningDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onProceed?: () => void;
  lang: Language;
  title: string;
  message: string;
  details?: string[];
  primaryText?: string;
  secondaryText?: string;
  impactMeta?: SensitiveImpactMeta;
  zIndexClass?: string;
}

export const WarningDialog: React.FC<WarningDialogProps> = ({
  isOpen,
  onClose,
  onProceed,
  lang,
  title,
  message,
  details,
  primaryText,
  secondaryText,
  impactMeta,
  zIndexClass = 'z-[65]',
}) => {
  const isAr = lang === 'ar';

  return (
    <AppDialog
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      variant="warning"
      role="alertdialog"
      lang={lang}
      maxWidthClass="max-w-[490px]"
      closeOnBackdrop={false}
      zIndexClass={zIndexClass}
      footer={
        <>
          <button
            type="button"
            data-dialog-cancel="true"
            onClick={onClose}
            className={`px-4 py-2 text-xs sm:text-[13px] font-extrabold rounded-xl transition-colors cursor-pointer ${
              onProceed
                ? 'text-[#123B70] bg-white hover:bg-slate-100 border border-[#CBD5E1]'
                : 'text-white bg-[#123B70] hover:bg-[#175A9C]'
            }`}
          >
            {secondaryText || (isAr ? 'العودة والمراجعة' : 'Return & Review')}
          </button>
          {onProceed && (
            <button
              type="button"
              onClick={onProceed}
              className="px-4 py-2 text-xs sm:text-[13px] font-extrabold text-white bg-[#D99A24] hover:bg-[#B8801A] rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              {primaryText || (isAr ? 'المتابعة على أي حال' : 'Proceed Anyway')}
            </button>
          )}
        </>
      }
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-5 h-5 text-[#D99A24]" />
        </div>
        <p className="text-[13px] sm:text-sm font-bold text-[#1E293B] leading-relaxed">
          {message}
        </p>
      </div>

      {details && details.length > 0 && (
        <ul className="mt-4 bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 space-y-1.5 text-xs font-bold text-[#92400E]">
          {details.map((d, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D99A24] mt-1.5 shrink-0" />
              <span>{d}</span>
            </li>
          ))}
        </ul>
      )}

      {impactMeta && (
        <SensitiveImpactPanel meta={impactMeta} lang={lang} tone="warning" />
      )}
    </AppDialog>
  );
};

/* ============================================================================
   INFO DIALOG
   ============================================================================ */
export interface InfoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  title: string;
  message: string;
  details?: string[];
  confirmText?: string;
  zIndexClass?: string;
}

export const InfoDialog: React.FC<InfoDialogProps> = ({
  isOpen,
  onClose,
  lang,
  title,
  message,
  details,
  confirmText,
  zIndexClass = 'z-[65]',
}) => {
  const isAr = lang === 'ar';

  return (
    <AppDialog
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      variant="info"
      lang={lang}
      maxWidthClass="max-w-[480px]"
      closeOnBackdrop={true}
      zIndexClass={zIndexClass}
      footer={
        <button
          type="button"
          onClick={onClose}
          className="px-5 py-2 text-xs sm:text-[13px] font-extrabold text-white bg-[#175A9C] hover:bg-[#123B70] rounded-xl shadow-xs transition-colors cursor-pointer"
        >
          {confirmText || (isAr ? 'حسناً' : 'OK')}
        </button>
      }
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#EEF3F9] border border-[#BCC8D6] flex items-center justify-center shrink-0">
          <Info className="w-5 h-5 text-[#2467B2]" />
        </div>
        <p className="text-[13px] sm:text-sm font-bold text-[#1E293B] leading-relaxed">
          {message}
        </p>
      </div>

      {details && details.length > 0 && (
        <ul className="mt-4 bg-[#F4F7FB] border border-[#E2E8F0] rounded-xl p-3.5 space-y-1.5 text-xs font-semibold text-[#334155]">
          {details.map((d, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2467B2] mt-1.5 shrink-0" />
              <span>{d}</span>
            </li>
          ))}
        </ul>
      )}
    </AppDialog>
  );
};

/* ============================================================================
   TOAST NOTIFICATION ITEM (Success / Info / Warning / Error / Progress)
   ============================================================================ */
export type ToastVariant = 'success' | 'info' | 'warning' | 'error' | 'loading';

export interface ToastItem {
  id: string;
  variant: ToastVariant;
  title: string;
  message?: string;
}

export const SuccessToast: React.FC<{
  toast: ToastItem;
  lang: Language;
  onDismiss: (id: string) => void;
}> = ({ toast, lang, onDismiss }) => {
  const isAr = lang === 'ar';

  const variantStyles: Record<
    ToastVariant,
    { border: string; iconBg: string; icon: React.ReactNode; bar: string }
  > = {
    success: {
      border: 'border-[#16843B]/35',
      iconBg: 'bg-[#16843B]/15 text-[#4ADE80]',
      icon: <CheckCircle2 className="w-4 h-4 text-[#4ADE80]" />,
      bar: 'bg-[#16843B]',
    },
    info: {
      border: 'border-[#2467B2]/45',
      iconBg: 'bg-[#2467B2]/20 text-[#93C5FD]',
      icon: <Info className="w-4 h-4 text-[#93C5FD]" />,
      bar: 'bg-[#2467B2]',
    },
    warning: {
      border: 'border-[#D99A24]/50',
      iconBg: 'bg-[#D99A24]/20 text-[#FCD34D]',
      icon: <AlertTriangle className="w-4 h-4 text-[#FCD34D]" />,
      bar: 'bg-[#D99A24]',
    },
    error: {
      border: 'border-[#C52B36]/55',
      iconBg: 'bg-[#C52B36]/25 text-[#FCA5A5]',
      icon: <AlertCircle className="w-4 h-4 text-[#FCA5A5]" />,
      bar: 'bg-[#C52B36]',
    },
    loading: {
      border: 'border-[#D6A348]/60',
      iconBg: 'bg-[#D6A348]/20 text-[#D6A348]',
      icon: <Loader2 className="w-4 h-4 text-[#D6A348] animate-spin" />,
      bar: 'bg-[#D6A348]',
    },
  };

  const st = variantStyles[toast.variant];

  return (
    <div
      role={toast.variant === 'error' ? 'alert' : 'status'}
      className={`saaed-toast-enter pointer-events-auto relative overflow-hidden bg-[#123B70] text-white border ${st.border} rounded-[14px] shadow-[0_14px_30px_-8px_rgba(12,35,68,0.45)] min-w-[280px] max-w-[400px] w-full sm:w-auto`}
    >
      <div className={`h-1 w-full ${st.bar}`} />
      <div className="px-3.5 py-2.5 flex items-start gap-2.5">
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${st.iconBg}`}
        >
          {st.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs sm:text-[13px] font-extrabold text-white leading-snug">
            {toast.title}
          </div>
          {toast.message && (
            <div className="text-[11.5px] font-semibold text-white/80 mt-0.5 leading-snug">
              {toast.message}
            </div>
          )}
        </div>
        {toast.variant !== 'loading' && (
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            aria-label={isAr ? 'إغلاق الإشعار' : 'Dismiss notification'}
            className="p-1 rounded-md text-white/65 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
