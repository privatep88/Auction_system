import React, { useState, useEffect } from 'react';
import {
  Check,
  AlertCircle,
  Trash2,
  SlidersHorizontal,
  Database,
  RotateCcw,
  Loader2,
  Gavel,
  ShieldCheck,
} from 'lucide-react';
import {
  AuctionRecord,
  FirebaseConnectionConfig,
  Language,
  PerformanceThresholds,
  ReportingPeriod,
} from '../types/auction';
import {
  getMonthName,
  MigrationSummaryReport,
  VerificationTestResult,
  runMigrationAndDateVerificationSuite,
} from '../services/storageService';
import {
  AppDialog,
  ConfirmationDialog,
  WarningDialog,
} from './SmartDialogs';
import { useNotification } from '../context/NotificationContext';
import {
  AuctionFieldKey,
  validateAuctionDraft,
  validatePerformanceThresholds,
} from '../utils/auctionValidation';

interface AuctionFormModalProps {
  isOpen: boolean;
  mode: 'add' | 'edit';
  selectedPeriod: ReportingPeriod;
  initialRecord: AuctionRecord | null;
  existingAuctions: AuctionRecord[];
  lang: Language;
  onClose: () => void;
  onSave: (record: AuctionRecord) => void | Promise<void>;
}

export const AuctionFormModal: React.FC<AuctionFormModalProps> = ({
  isOpen,
  mode,
  selectedPeriod,
  initialRecord,
  existingAuctions,
  lang,
  onClose,
  onSave,
}) => {
  const isAr = lang === 'ar';
  const monthLabel = getMonthName(selectedPeriod.month, lang);
  const { showError } = useNotification();

  const [auctionNumber, setAuctionNumber] = useState('');
  const [durationAr, setDurationAr] = useState('أسبوع (7 أيام)');
  const [durationEn, setDurationEn] = useState('1 Week (7 Days)');
  const [listedInput, setListedInput] = useState<string>('250');
  const [soldInput, setSoldInput] = useState<string>('200');
  const [notesAr, setNotesAr] = useState('');
  const [notesEn, setNotesEn] = useState('');
  const [challengesAr, setChallengesAr] = useState('');
  const [challengesEn, setChallengesEn] = useState('');
  const [recommendationsAr, setRecommendationsAr] = useState('');
  const [recommendationsEn, setRecommendationsEn] = useState('');
  const [touched, setTouched] = useState<Partial<Record<AuctionFieldKey, boolean>>>({});
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setTouched({});
    setHasSubmitted(false);
    setIsSaving(false);

    if (mode === 'edit' && initialRecord) {
      setAuctionNumber(initialRecord.auctionNumber);
      setDurationAr(initialRecord.durationAr);
      setDurationEn(initialRecord.durationEn);
      setListedInput(String(initialRecord.listedVehicles));
      setSoldInput(String(initialRecord.soldVehicles));
      setNotesAr(initialRecord.notesAr);
      setNotesEn(initialRecord.notesEn);
      setChallengesAr(initialRecord.challengesAr);
      setChallengesEn(initialRecord.challengesEn);
      setRecommendationsAr(initialRecord.recommendationsAr);
      setRecommendationsEn(initialRecord.recommendationsEn);
    } else {
      const nextNum = existingAuctions.length + 1;
      const padded = String(nextNum).padStart(3, '0');
      setAuctionNumber(`AUC-${padded}`);
      setDurationAr('أسبوع (7 أيام)');
      setDurationEn('1 Week (7 Days)');
      setListedInput('250');
      setSoldInput('210');
      setNotesAr('إقبال جيد على فئة المركبات المعروضة.');
      setNotesEn('Good demand on listed vehicle categories.');
      setChallengesAr('ضغط على ساحة المعاينة.');
      setChallengesEn('High traffic in inspection yard.');
      setRecommendationsAr('تعزيز الترويج وتنظيم المعاينة.');
      setRecommendationsEn('Enhance marketing and organize inspection.');
    }
  }, [isOpen, mode, initialRecord, existingAuctions.length]);

  const parsedListed = Number(listedInput);
  const parsedSold = Number(soldInput);
  const safeListed =
    Number.isFinite(parsedListed) && parsedListed > 0 ? parsedListed : 0;
  const safeSold =
    Number.isFinite(parsedSold) && parsedSold >= 0 ? parsedSold : 0;
  const unsoldPreview = Math.max(0, safeListed - safeSold);
  const saleRatePreview =
    safeListed > 0 && safeSold <= safeListed
      ? ((safeSold / safeListed) * 100).toFixed(1)
      : '0.0';

  const currentValidation = validateAuctionDraft(
    {
      id: mode === 'edit' ? initialRecord?.id : undefined,
      auctionNumber,
      durationAr,
      durationEn,
      listedVehicles: listedInput,
      soldVehicles: soldInput,
      notesAr,
      challengesAr,
      recommendationsAr,
    },
    existingAuctions,
    {
      lang,
      periodLabel: `${monthLabel} ${selectedPeriod.year}`,
      requireDuration: true,
    }
  );

  const visibleFieldError = (field: AuctionFieldKey): string | undefined => {
    if (!hasSubmitted && !touched[field]) return undefined;
    return currentValidation.fieldErrors[field];
  };

  const markTouched = (field: AuctionFieldKey) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setHasSubmitted(true);

    if (!currentValidation.valid) {
      showError({
        title: isAr ? 'تعذر حفظ بيانات المزاد' : 'Unable to Save Auction Data',
        message: isAr
          ? 'توجد قيم غير مكتملة أو غير منطقية في النموذج. يرجى تصحيح الحقول التالية دون فقدان مدخلاتك:'
          : 'Some fields contain invalid or conflicting values. Please fix the items below:',
        details: currentValidation.summaryMessages,
        hint: isAr
          ? 'تم الإبقاء على جميع البيانات التي أدخلتها — راجع الحقول المظللة باللون الأحمر ثم أعد الحفظ.'
          : 'All entered data has been preserved — review the highlighted fields and save again.',
        confirmText: isAr ? 'العودة للتصحيح' : 'Return & Fix',
      });
      return;
    }

    const finalListed = Number(listedInput);
    const finalSold = Number(soldInput);
    const finalUnsold = Math.max(0, finalListed - finalSold);
    const finalSaleRate = Number(((finalSold / finalListed) * 100).toFixed(1));
    const finalUnsoldRate = Number(((finalUnsold / finalListed) * 100).toFixed(1));

    const now = new Date().toISOString();
    const targetYear =
      mode === 'edit' && initialRecord
        ? initialRecord.year
        : selectedPeriod.year;
    const targetMonth =
      mode === 'edit' && initialRecord
        ? initialRecord.month
        : selectedPeriod.month;

    const record: AuctionRecord = {
      id:
        mode === 'edit' && initialRecord
          ? initialRecord.id
          : `auc-${targetYear}-${String(targetMonth).padStart(
              2,
              '0'
            )}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      year: targetYear,
      month: targetMonth,
      auctionNumber: auctionNumber.trim().toUpperCase(),
      durationAr: durationAr.trim() || 'أسبوع (7 أيام)',
      durationEn: durationEn.trim() || durationAr.trim() || '1 Week (7 Days)',
      listedVehicles: finalListed,
      soldVehicles: finalSold,
      unsoldVehicles: finalUnsold,
      saleRate: finalSaleRate,
      unsoldRate: finalUnsoldRate,
      notesAr: notesAr.trim() || '—',
      notesEn: notesEn.trim() || notesAr.trim() || '—',
      challengesAr: challengesAr.trim() || '—',
      challengesEn: challengesEn.trim() || challengesAr.trim() || '—',
      recommendationsAr: recommendationsAr.trim() || '—',
      recommendationsEn:
        recommendationsEn.trim() || recommendationsAr.trim() || '—',
      createdAt:
        mode === 'edit' && initialRecord ? initialRecord.createdAt : now,
      updatedAt: now,
    };

    try {
      setIsSaving(true);
      await onSave(record);
    } finally {
      setIsSaving(false);
    }
  };

  const errAuction = visibleFieldError('auctionNumber');
  const errDuration = visibleFieldError('durationAr');
  const errListed = visibleFieldError('listedVehicles');
  const errSold = visibleFieldError('soldVehicles');

  return (
    <AppDialog
      isOpen={isOpen}
      onClose={onClose}
      title={
        mode === 'add'
          ? isAr
            ? `إضافة سجل مزاد جديد — شهر ${monthLabel} ${selectedPeriod.year}`
            : `Add New Auction — ${monthLabel} ${selectedPeriod.year}`
          : isAr
          ? `تعديل بيانات المزاد (${initialRecord?.auctionNumber}) — ${monthLabel} ${selectedPeriod.year}`
          : `Edit Auction (${initialRecord?.auctionNumber}) — ${monthLabel} ${selectedPeriod.year}`
      }
      variant="navy"
      icon={<Gavel className="w-4 h-4 text-[#D6A348]" />}
      lang={lang}
      maxWidthClass="max-w-2xl"
      closeOnBackdrop={false}
      isLoading={isSaving}
    >
      <form noValidate onSubmit={handleSubmit} className="space-y-4">
        {hasSubmitted && !currentValidation.valid && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs font-bold text-[#991B1B]">
            <AlertCircle className="w-4 h-4 text-[#C52B36] shrink-0 mt-0.5" />
            <div>
              <div className="font-extrabold">
                {isAr
                  ? `يوجد ${currentValidation.errors.length} حقول تحتاج إلى مراجعة وتصحيح:`
                  : `${currentValidation.errors.length} field(s) require attention:`}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div>
            <label className="block text-xs font-extrabold text-[#123B70] mb-1">
              {isAr ? 'رقم المزاد *' : 'Auction Number *'}
            </label>
            <input
              type="text"
              value={auctionNumber}
              onChange={(e) => setAuctionNumber(e.target.value.toUpperCase())}
              onBlur={() => markTouched('auctionNumber')}
              placeholder="AUC-001"
              aria-invalid={Boolean(errAuction)}
              className={`w-full px-3 py-2 text-sm font-mono font-bold rounded-lg border focus:outline-none transition-colors ${
                errAuction
                  ? 'border-[#C52B36] bg-red-50/70 focus:ring-2 focus:ring-[#C52B36]/25'
                  : 'border-slate-300 bg-white focus:border-[#175A9C] focus:ring-2 focus:ring-[#175A9C]/15'
              }`}
            />
            {errAuction && (
              <p className="mt-1 text-[11px] font-bold text-[#C52B36] leading-snug">
                {errAuction}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-extrabold text-[#123B70] mb-1">
              {isAr ? 'مدة عرض المزاد (عربي) *' : 'Duration (Arabic) *'}
            </label>
            <input
              type="text"
              value={durationAr}
              onChange={(e) => setDurationAr(e.target.value)}
              onBlur={() => markTouched('durationAr')}
              aria-invalid={Boolean(errDuration)}
              className={`w-full px-3 py-2 text-sm font-bold rounded-lg border focus:outline-none transition-colors ${
                errDuration
                  ? 'border-[#C52B36] bg-red-50/70 focus:ring-2 focus:ring-[#C52B36]/25'
                  : 'border-slate-300 bg-white focus:border-[#175A9C] focus:ring-2 focus:ring-[#175A9C]/15'
              }`}
            />
            {errDuration && (
              <p className="mt-1 text-[11px] font-bold text-[#C52B36] leading-snug">
                {errDuration}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-extrabold text-[#123B70] mb-1">
              {isAr ? 'مدة العرض (إنجليزي)' : 'Duration (English)'}
            </label>
            <input
              type="text"
              value={durationEn}
              onChange={(e) => setDurationEn(e.target.value)}
              className="w-full px-3 py-2 text-sm font-bold border border-slate-300 rounded-lg focus:outline-none focus:border-[#175A9C] focus:ring-2 focus:ring-[#175A9C]/15"
            />
          </div>
        </div>

        {/* Numeric Inputs & Live Auto-Calculated Preview */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 bg-[#F4F7FB] p-3.5 rounded-xl border border-[#CBD5E1]">
          <div>
            <label className="block text-xs font-extrabold text-[#123B70] mb-1">
              {isAr ? 'عدد المركبات المدرجة *' : 'Listed Vehicles *'}
            </label>
            <input
              type="number"
              min={1}
              step={1}
              value={listedInput}
              onChange={(e) => setListedInput(e.target.value)}
              onBlur={() => markTouched('listedVehicles')}
              aria-invalid={Boolean(errListed)}
              className={`w-full px-3 py-2 text-base font-mono font-black rounded-lg border focus:outline-none transition-colors ${
                errListed
                  ? 'border-[#C52B36] bg-red-50/70 focus:ring-2 focus:ring-[#C52B36]/25'
                  : 'border-slate-300 bg-white focus:border-[#175A9C]'
              }`}
            />
            {errListed && (
              <p className="mt-1 text-[11px] font-bold text-[#C52B36] leading-snug">
                {errListed}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-extrabold text-[#16843B] mb-1">
              {isAr ? 'عدد المركبات المبيعة *' : 'Sold Vehicles *'}
            </label>
            <input
              type="number"
              min={0}
              step={1}
              value={soldInput}
              onChange={(e) => setSoldInput(e.target.value)}
              onBlur={() => markTouched('soldVehicles')}
              aria-invalid={Boolean(errSold)}
              className={`w-full px-3 py-2 text-base font-mono font-black rounded-lg border focus:outline-none transition-colors ${
                errSold
                  ? 'border-[#C52B36] bg-red-50/70 focus:ring-2 focus:ring-[#C52B36]/25'
                  : 'border-slate-300 bg-white focus:border-[#16843B]'
              }`}
            />
            {errSold && (
              <p className="mt-1 text-[11px] font-bold text-[#C52B36] leading-snug">
                {errSold}
              </p>
            )}
          </div>

          <div className="flex flex-col justify-center bg-white rounded-lg border border-slate-200 px-3 py-2 text-center">
            <span className="text-[11px] font-bold text-slate-500">
              {isAr ? 'غير المبيعة (حساب تلقائي)' : 'Unsold (Auto-Calculated)'}
            </span>
            <div className="text-lg font-mono font-black text-[#C52B36] tabular-nums">
              {unsoldPreview}{' '}
              <span className="text-xs font-bold text-[#16843B]">
                ({isAr ? 'نسبة البيع:' : 'Sale:'} {saleRatePreview}%)
              </span>
            </div>
          </div>
        </div>

        {/* Qualitative Fields */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-extrabold text-[#123B70] mb-1">
              {isAr ? 'الملاحظات التشغيلية' : 'Operational Notes'}
            </label>
            <input
              type="text"
              value={isAr ? notesAr : notesEn}
              onChange={(e) => {
                if (isAr) setNotesAr(e.target.value);
                else setNotesEn(e.target.value);
              }}
              className="w-full px-3 py-2 text-sm font-semibold border border-slate-300 rounded-lg focus:outline-none focus:border-[#175A9C]"
            />
          </div>

          <div>
            <label className="block text-xs font-extrabold text-[#C52B36] mb-1">
              {isAr ? 'التحديات المرصودة' : 'Operational Challenges'}
            </label>
            <input
              type="text"
              value={isAr ? challengesAr : challengesEn}
              onChange={(e) => {
                if (isAr) setChallengesAr(e.target.value);
                else setChallengesEn(e.target.value);
              }}
              className="w-full px-3 py-2 text-sm font-semibold border border-slate-300 rounded-lg focus:outline-none focus:border-[#175A9C]"
            />
          </div>

          <div>
            <label className="block text-xs font-extrabold text-[#16843B] mb-1">
              {isAr
                ? 'التوصيات والإجراءات التحسينية'
                : 'Recommendations & Improvement Actions'}
            </label>
            <input
              type="text"
              value={isAr ? recommendationsAr : recommendationsEn}
              onChange={(e) => {
                if (isAr) setRecommendationsAr(e.target.value);
                else setRecommendationsEn(e.target.value);
              }}
              className="w-full px-3 py-2 text-sm font-semibold border border-slate-300 rounded-lg focus:outline-none focus:border-[#175A9C]"
            />
          </div>
        </div>

        <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-200">
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
          >
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-1.5 px-5 py-2 text-xs font-extrabold text-white bg-[#123B70] hover:bg-[#175A9C] rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-60"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            <span>
              {mode === 'add'
                ? isAr
                  ? 'إضافة المزاد وحفظ البيانات'
                  : 'Add Auction & Save'
                : isAr
                ? 'حفظ التعديلات'
                : 'Save Changes'}
            </span>
          </button>
        </div>
      </form>
    </AppDialog>
  );
};

interface DeleteConfirmModalProps {
  record: AuctionRecord | null;
  lang: Language;
  onCancel: () => void;
  onConfirm: (record: AuctionRecord) => void | Promise<void>;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  record,
  lang,
  onCancel,
  onConfirm,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setIsDeleting(false);
  }, [record?.id]);

  if (!record) return null;
  const isAr = lang === 'ar';
  const monthLabel = getMonthName(record.month, lang);

  const handleConfirm = async () => {
    if (isDeleting) return;
    try {
      setIsDeleting(true);
      await onConfirm(record);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <ConfirmationDialog
      isOpen={Boolean(record)}
      onCancel={onCancel}
      onConfirm={handleConfirm}
      lang={lang}
      destructive={true}
      isLoading={isDeleting}
      zIndexClass="z-[60]"
      title={isAr ? 'تأكيد حذف سجل المزاد' : 'Confirm Auction Deletion'}
      message={
        isAr
          ? `هل أنت متأكد من حذف المزاد (${record.auctionNumber})؟ سيتم تحديث كافة المؤشرات والرسوم البيانية لشهر ${monthLabel} ${record.year} تلقائياً.`
          : `Are you sure you want to permanently delete auction (${record.auctionNumber}) from ${monthLabel} ${record.year}?`
      }
      cancelText={isAr ? 'إلغاء وتراجع' : 'Cancel'}
      confirmText={isAr ? 'تأكيد الحذف' : 'Confirm Delete'}
      impactMeta={{
        operationName: isAr ? 'حذف سجل مزاد' : 'Delete Auction Record',
        periodLabel: `${monthLabel} ${record.year}`,
        affectedCountLabel: isAr
          ? `1 سجل (${record.auctionNumber} · ${record.listedVehicles} مدرجة / ${record.soldVehicles} مبيعة)`
          : `1 record (${record.auctionNumber} · ${record.listedVehicles} listed / ${record.soldVehicles} sold)`,
        impactDescription: isAr
          ? `سيتم إزالة هذا السجل من أرشيف ${monthLabel} ${record.year} وإعادة احتساب إجمالي المركبات ونسب البيع دون التأثير على بقية الأشهر.`
          : `Removes this record from ${monthLabel} ${record.year} and recalculates monthly KPIs without affecting other months.`,
        reversibilityLabel: isAr
          ? 'إجراء نهائي: لا يمكن التراجع عن الحذف بعد التأكيد.'
          : 'Permanent action: Cannot be undone once confirmed.',
      }}
    />
  );
};

interface UnsavedPeriodSwitchModalProps {
  pendingPeriod: ReportingPeriod | null;
  lang: Language;
  onCancel: () => void;
  onDiscardAndSwitch: (period: ReportingPeriod) => void;
}

export const UnsavedPeriodSwitchModal: React.FC<
  UnsavedPeriodSwitchModalProps
> = ({ pendingPeriod, lang, onCancel, onDiscardAndSwitch }) => {
  if (!pendingPeriod) return null;
  const isAr = lang === 'ar';
  const targetMonthName = getMonthName(pendingPeriod.month, lang);

  return (
    <WarningDialog
      isOpen={Boolean(pendingPeriod)}
      onClose={onCancel}
      onProceed={() => onDiscardAndSwitch(pendingPeriod)}
      lang={lang}
      zIndexClass="z-[60]"
      title={
        isAr
          ? 'تنبيه: تعديلات قيد التحرير غير محفوظة'
          : 'Warning: Unsaved Inline Edits'
      }
      message={
        isAr
          ? `لديك تعديلات مفتوحة قيد التحرير في الجدول الحالي. هل ترغب في البقاء لحفظها أولاً، أم تجاهل التغييرات والانتقال إلى شهر ${targetMonthName} ${pendingPeriod.year}؟`
          : `You have unsaved inline edits in the table. Return to save them first, or discard changes and switch to ${targetMonthName} ${pendingPeriod.year}?`
      }
      secondaryText={isAr ? 'العودة وحفظ التعديلات' : 'Stay & Save First'}
      primaryText={isAr ? 'تجاهل والانتقال للشهر' : 'Discard & Switch'}
      impactMeta={{
        operationName: isAr ? 'الانتقال إلى شهر آخر' : 'Switch Reporting Period',
        periodLabel: `${targetMonthName} ${pendingPeriod.year}`,
        impactDescription: isAr
          ? 'في حال المتابعة سيتم إلغاء القيم قيد التحرير في الصف الحالي دون حفظها.'
          : 'Proceeding will discard unsaved edits in the currently active table row.',
      }}
    />
  );
};

interface SettingsModalProps {
  isOpen: boolean;
  thresholds: PerformanceThresholds;
  firebaseConfig: FirebaseConnectionConfig | null;
  firebaseConnected: boolean;
  lang: Language;
  onClose: () => void;
  onSaveThresholds: (t: PerformanceThresholds) => void;
  onSaveFirebase: (cfg: FirebaseConnectionConfig | null) => void;
  onResetDefaults: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  thresholds,
  firebaseConfig,
  firebaseConnected,
  lang,
  onClose,
  onSaveThresholds,
  onSaveFirebase,
  onResetDefaults,
}) => {
  const isAr = lang === 'ar';
  const { showError, confirmAction } = useNotification();

  const [excellentMin, setExcellentMin] = useState(
    String(thresholds.excellentMin)
  );
  const [goodMin, setGoodMin] = useState(String(thresholds.goodMin));
  const [needsImprovementMin, setNeedsImprovementMin] = useState(
    String(thresholds.needsImprovementMin)
  );
  const [useDetailedFourTierLabels, setUseDetailedFourTierLabels] = useState(
    thresholds.useDetailedFourTierLabels
  );

  const [apiKey, setApiKey] = useState(firebaseConfig?.apiKey || '');
  const [projectId, setProjectId] = useState(firebaseConfig?.projectId || '');
  const [authDomain, setAuthDomain] = useState(
    firebaseConfig?.authDomain || ''
  );

  useEffect(() => {
    if (!isOpen) return;
    setExcellentMin(String(thresholds.excellentMin));
    setGoodMin(String(thresholds.goodMin));
    setNeedsImprovementMin(String(thresholds.needsImprovementMin));
    setUseDetailedFourTierLabels(thresholds.useDetailedFourTierLabels);
    setApiKey(firebaseConfig?.apiKey || '');
    setProjectId(firebaseConfig?.projectId || '');
    setAuthDomain(firebaseConfig?.authDomain || '');
  }, [isOpen, thresholds, firebaseConfig]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    const parsedThresholds: PerformanceThresholds = {
      excellentMin: Number(excellentMin),
      goodMin: Number(goodMin),
      needsImprovementMin: Number(needsImprovementMin),
      useDetailedFourTierLabels,
    };

    const validation = validatePerformanceThresholds(parsedThresholds, lang);
    const errors = [...validation.summaryMessages];

    const hasPartialFirebase =
      (apiKey.trim() && !projectId.trim()) ||
      (!apiKey.trim() && projectId.trim());
    if (hasPartialFirebase) {
      errors.push(
        isAr
          ? 'للربط مع Firebase Firestore، يرجى إدخال كل من apiKey و projectId معاً (أو تركهما فارغين للعمل بالوضع المحلي).'
          : 'To configure Firebase Firestore, provide both apiKey and projectId (or leave both blank).'
      );
    }

    if (errors.length > 0) {
      showError({
        title: isAr ? 'تعذر حفظ إعدادات النظام' : 'Invalid Settings Values',
        message: isAr
          ? 'يرجى مراجعة القيم التالية قبل الحفظ:'
          : 'Please review the following settings values:',
        details: errors,
        confirmText: isAr ? 'العودة للتصحيح' : 'Return & Fix',
      });
      return;
    }

    onSaveThresholds(parsedThresholds);
    if (apiKey.trim() && projectId.trim()) {
      onSaveFirebase({
        apiKey: apiKey.trim(),
        projectId: projectId.trim(),
        authDomain:
          authDomain.trim() || `${projectId.trim()}.firebaseapp.com`,
      });
    } else {
      onSaveFirebase(null);
    }
    onClose();
  };

  const handleRequestSensitiveReset = async () => {
    const confirmed = await confirmAction({
      title: isAr
        ? 'تأكيد استعادة بيانات نوفمبر 2026 المرجعية'
        : 'Confirm Restore November 2026 Reference Data',
      message: isAr
        ? 'سيتم استبدال السجلات الحالية لشهر نوفمبر 2026 بالمزادات المرجعية الخمسة (AUC-001 إلى AUC-005) وإعادة ضبط حدود تقييم الأداء إلى القيم الافتراضية.'
        : 'This will restore November 2026 to the 5 migrated reference auctions (AUC-001 to AUC-005) and reset rating thresholds.',
      destructive: true,
      confirmText: isAr ? 'تأكيد الاستعادة' : 'Confirm Restore',
      cancelText: isAr ? 'إلغاء' : 'Cancel',
      impactMeta: {
        operationName: isAr
          ? 'استعادة بيانات شهر نوفمبر 2026 المرجعية'
          : 'Restore November 2026 Reference Data',
        periodLabel: isAr ? 'نوفمبر 2026 (2026-11)' : 'November 2026 (2026-11)',
        affectedCountLabel: isAr
          ? 'شهر نوفمبر 2026 فقط (5 سجلات مرجعية)'
          : 'November 2026 only (5 reference records)',
        impactDescription: isAr
          ? 'سيتم فقدان أي تعديلات غير محفوظة أو سجلات مضافة يدوياً في نوفمبر 2026، بينما تبقى بيانات كافة الأشهر والسنوات الأخرى محفوظة دون أي مساس.'
          : 'Replaces current November 2026 records and resets thresholds while preserving all other months and years untouched.',
        reversibilityLabel: isAr
          ? 'تنبيه: ستفقد التعديلات الحالية في شهر نوفمبر 2026 ما لم تصدر نسخة احتياطية قبل ذلك.'
          : 'Notice: Current November 2026 modifications will be overwritten.',
      },
      onConfirm: () => {
        onResetDefaults();
        onClose();
      },
    });
    return confirmed;
  };

  return (
    <AppDialog
      isOpen={isOpen}
      onClose={onClose}
      title={
        isAr
          ? 'إعدادات النظام وحدود التقييم والربط السحابي'
          : 'System Settings, Rating Thresholds & Cloud Sync'
      }
      variant="navy"
      icon={<SlidersHorizontal className="w-4 h-4 text-[#D6A348]" />}
      lang={lang}
      maxWidthClass="max-w-xl"
      closeOnBackdrop={false}
    >
      <form noValidate onSubmit={handleSave} className="space-y-5">
        {/* Performance Thresholds Section */}
        <div className="space-y-3">
          <h4 className="text-sm font-extrabold text-[#123B70] flex items-center gap-1.5">
            <SlidersHorizontal className="w-4 h-4" />
            <span>
              {isAr
                ? 'حدود تقييم أداء المزادات (نسبة البيع %)'
                : 'Performance Evaluation Thresholds (Sale Rate %)'}
            </span>
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#F4F7FB] p-3.5 rounded-xl border border-[#CBD5E1]">
            <div>
              <label className="block text-[11px] font-extrabold text-[#006100] mb-1">
                {isAr ? 'ممتاز (≥ %)' : 'Excellent (≥ %)'}
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={excellentMin}
                onChange={(e) => setExcellentMin(e.target.value)}
                className="w-full px-2.5 py-1.5 text-sm font-mono font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#175A9C]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-extrabold text-[#16843B] mb-1">
                {isAr ? 'أداء جيد (≥ %)' : 'Good (≥ %)'}
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={goodMin}
                onChange={(e) => setGoodMin(e.target.value)}
                className="w-full px-2.5 py-1.5 text-sm font-mono font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#175A9C]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-extrabold text-[#926000] mb-1">
                {isAr ? 'يحتاج إلى تحسين (≥ %)' : 'Needs Improv. (≥ %)'}
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={needsImprovementMin}
                onChange={(e) => setNeedsImprovementMin(e.target.value)}
                className="w-full px-2.5 py-1.5 text-sm font-mono font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#175A9C]"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={useDetailedFourTierLabels}
              onChange={(e) => setUseDetailedFourTierLabels(e.target.checked)}
              className="rounded border-slate-300 text-[#123B70]"
            />
            <span>
              {isAr
                ? 'تفعيل شارة "ممتاز" منفصلة عن "أداء جيد" (إلغاء التحديد يحافظ على نص الصورة المرجعية "أداء جيد" للمزادات ≥ 75%)'
                : 'Show distinct "Excellent" badge above "Good Performance"'}
            </span>
          </label>
        </div>

        {/* Firebase Firestore Connection Section */}
        <div className="space-y-2.5 pt-3 border-t border-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-extrabold text-[#123B70] flex items-center gap-1.5">
              <Database className="w-4 h-4" />
              <span>
                {isAr
                  ? 'إعدادات الربط السحابي (Firebase Firestore)'
                  : 'Firebase Firestore Cloud Sync (Optional)'}
              </span>
            </h4>
            <span
              className={`text-[11px] font-extrabold px-2 py-0.5 rounded-md ${
                firebaseConnected
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {firebaseConnected
                ? isAr
                  ? 'متصل بـ Firestore'
                  : 'Firestore Connected'
                : isAr
                ? 'أرشفة محلية دائمة نشطة (LocalStorage)'
                : 'Local Archiving Active'}
            </span>
          </div>

          <p className="text-[11.5px] font-semibold text-slate-500">
            {isAr
              ? 'تُحفظ سجلات كل شهر وسنة بصورة مستقلة ودائمة في المتصفح، وعند الربط مع Firestore تُحفظ تلقائياً ضمن المسار auctionReports/{YYYY-MM}/auctions:'
              : 'Each month and year is archived independently in LocalStorage and under auctionReports/{YYYY-MM}/auctions in Firestore:'}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Firebase apiKey"
              className="px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-[#175A9C]"
            />
            <input
              type="text"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              placeholder="Firebase projectId"
              className="px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-[#175A9C]"
            />
          </div>
        </div>

        {/* Reset Reference Month Data */}
        <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleRequestSensitiveReset}
            className="flex items-center gap-1.5 text-xs font-bold text-[#C52B36] hover:text-[#991B1B] hover:underline cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>
              {isAr
                ? 'استعادة بيانات نوفمبر 2026 المنقولة (دون المساس بالأشهر الأخرى)'
                : 'Restore Nov 2026 Migrated Data (Preserves other months)'}
            </span>
          </button>

          <div className="flex items-center gap-2 ms-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              {isAr ? 'إغلاق' : 'Close'}
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-extrabold text-white bg-[#123B70] hover:bg-[#175A9C] rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{isAr ? 'حفظ الإعدادات' : 'Save Settings'}</span>
            </button>
          </div>
        </div>
      </form>
    </AppDialog>
  );
};

/* ============================================================================
   MIGRATION, BACKUP & ZEROING APPROVAL MODAL
   ============================================================================ */

interface MigrationApprovalModalProps {
  isOpen: boolean;
  summary: MigrationSummaryReport;
  lang: Language;
  onClose: () => void;
  onApproveMigrationAndZero: (
    conflictMode: 'replace' | 'merge'
  ) => void | Promise<void>;
  onRestoreBackup: () => void | Promise<void>;
}

export const MigrationApprovalModal: React.FC<MigrationApprovalModalProps> = ({
  isOpen,
  summary,
  lang,
  onClose,
  onApproveMigrationAndZero,
  onRestoreBackup,
}) => {
  const isAr = lang === 'ar';
  const { confirmAction } = useNotification();
  const [conflictMode, setConflictMode] = useState<'replace' | 'merge'>('replace');
  const [showTestSuite, setShowTestSuite] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const testResults: VerificationTestResult[] =
    runMigrationAndDateVerificationSuite();
  const passedCount = testResults.filter((t) => t.passed).length;

  const handleConfirmMigration = async () => {
    if (isProcessing) return;
    await confirmAction({
      title: isAr
        ? 'تأكيد تنفيذ الترحيل وتصفير الأشهر الأخرى'
        : 'Confirm Migration & Period Zeroing',
      message: isAr
        ? 'أنت على وشك اعتماد ترحيل مزادات أكتوبر 2026 إلى نوفمبر 2026 وتصفير سجلات أكتوبر وكافة الأشهر والسنوات الأخرى.'
        : 'You are about to approve copying October 2026 auctions into November 2026 and zeroing October and all other periods.',
      destructive: true,
      confirmText: isAr ? 'تأكيد الترحيل والتصفير' : 'Confirm Migration & Zeroing',
      cancelText: isAr ? 'إلغاء' : 'Cancel',
      impactMeta: {
        operationName: isAr
          ? 'ترحيل بيانات أكتوبر إلى نوفمبر وتصفير بقية الأشهر'
          : 'Migrate Oct -> Nov & Zero Other Months',
        periodLabel: isAr
          ? `الوجهة المحفوظة: نوفمبر 2026 · الأشهر المصفّرة: ${summary.periodsToZero.length} فترة`
          : `Target: Nov 2026 · Zeroed periods: ${summary.periodsToZero.length}`,
        affectedCountLabel: isAr
          ? `${summary.stagedNovemberRecords.length} مزادات (${summary.totalListedToMigrate.toLocaleString('en-US')} مركبة)`
          : `${summary.stagedNovemberRecords.length} auctions (${summary.totalListedToMigrate.toLocaleString('en-US')} vehicles)`,
        impactDescription: isAr
          ? 'سيتم تثبيت بيانات نوفمبر 2026 وتصفير جميع الأشهر والسنوات الأخرى مع الإبقاء على النسخة الاحتياطية الكاملة قابلة للاستعادة.'
          : 'Finalizes November 2026 migrated data and resets all other periods while retaining the full restorable backup.',
        reversibilityLabel: isAr
          ? 'قابل للاستعادة عبر زر "استعادة النسخة الاحتياطية الكاملة" في هذه النافذة.'
          : 'Reversible via the Full Backup Restore option in this dialog.',
      },
      onConfirm: async () => {
        try {
          setIsProcessing(true);
          await onApproveMigrationAndZero(conflictMode);
        } finally {
          setIsProcessing(false);
        }
      },
    });
  };

  const handleConfirmRestoreBackup = async () => {
    if (isProcessing) return;
    await confirmAction({
      title: isAr
        ? 'تأكيد استعادة النسخة الاحتياطية الكاملة'
        : 'Confirm Full Pre-Migration Backup Restore',
      message: isAr
        ? 'سيتم استعادة جميع الأشهر والسنوات كما كانت قبل الترحيل (بما في ذلك استعادة بيانات أكتوبر 2026 الأصلية).'
        : 'Restores all months and years as they existed prior to migration, including original October 2026 data.',
      destructive: false,
      confirmText: isAr ? 'تأكيد الاستعادة' : 'Confirm Restore',
      cancelText: isAr ? 'إلغاء' : 'Cancel',
      impactMeta: {
        operationName: isAr
          ? 'استعادة النسخة الاحتياطية الكاملة'
          : 'Restore Complete Backup',
        periodLabel: isAr ? 'أكتوبر 2026 وكافة الأشهر' : 'October 2026 & All Months',
        impactDescription: isAr
          ? 'تُستبدل البيانات الحالية بلقطة النسخة الاحتياطية المحفوظة مسبقاً.'
          : 'Replaces current workspace archives with the stored pre-migration snapshot.',
      },
      onConfirm: async () => {
        try {
          setIsProcessing(true);
          await onRestoreBackup();
        } finally {
          setIsProcessing(false);
        }
      },
    });
  };

  return (
    <AppDialog
      isOpen={isOpen}
      onClose={onClose}
      title={
        isAr
          ? 'ترحيل بيانات أكتوبر 2026 إلى نوفمبر 2026 وتصفير بقية الأشهر'
          : 'October 2026 to November 2026 Data Migration & Zeroing'
      }
      subtitle={
        isAr
          ? 'نظام حماية البيانات والنسخ الاحتياطي والتحقق المسبق قبل التصفير'
          : 'Data Protection, Restorable Backup & Pre-Zeroing Verification'
      }
      variant="navy"
      icon={<ShieldCheck className="w-5 h-5 text-[#D6A348]" />}
      lang={lang}
      maxWidthClass="max-w-3xl"
      closeOnBackdrop={false}
      isLoading={isProcessing}
    >
      <div className="space-y-4">
        {/* 1. Status Banner */}
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
            summary.migrationState === 'completed'
              ? 'bg-[#ECFDF3] border-[#ABEFC6] text-[#13652C]'
              : 'bg-[#FEF9C3] border-[#FDE047] text-[#784A00]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Check className="w-5 h-5 shrink-0" />
            <div className="text-xs sm:text-sm font-extrabold">
              {summary.migrationState === 'completed'
                ? isAr
                  ? 'حالة الترحيل: مكتمل ومعتمد — نوفمبر 2026 يحتوي على جميع البيانات المنقولة، وتم تصفير أكتوبر وبقية الأشهر.'
                  : 'Migration Status: Completed & Approved — Nov 2026 holds all migrated data and other months are zeroed.'
                : isAr
                ? 'حالة الترحيل: تم إنشاء النسخة الاحتياطية ونسخ بيانات أكتوبر إلى نوفمبر بنجاح — بانتظار موافقتك لتصفير أكتوبر وبقية الأشهر.'
                : 'Migration Status: Backup created & Nov 2026 copy staged — Awaiting your approval to zero October and other months.'}
            </div>
          </div>
        </div>

        {/* 2. Source vs Destination Verification Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-[#F4F7FB] border border-[#CBD5E1] rounded-xl p-3">
            <div className="text-[11px] font-bold text-[#64748B]">
              {isAr
                ? 'المصدر الأصلي (محفوظ بالنسخة الاحتياطية)'
                : 'Original Source (Backed Up)'}
            </div>
            <div className="text-sm font-black text-[#123B70] mt-0.5">
              {isAr ? 'أكتوبر 2026 (2026-10)' : 'October 2026 (2026-10)'}
            </div>
            <div className="text-xs font-extrabold text-[#14243D] mt-1">
              {summary.sourceRecords.length} {isAr ? 'مزادات' : 'Auctions'} ·{' '}
              {summary.totalListedToMigrate.toLocaleString('en-US')}{' '}
              {isAr ? 'مركبة' : 'Vehicles'}
            </div>
          </div>

          <div className="bg-[#ECFDF3] border border-[#ABEFC6] rounded-xl p-3">
            <div className="text-[11px] font-bold text-[#13652C]">
              {isAr
                ? 'الوجهة المعتمدة (الشهر الحالي)'
                : 'Target Period (Current Month)'}
            </div>
            <div className="text-sm font-black text-[#16843B] mt-0.5">
              {isAr ? 'نوفمبر 2026 (2026-11)' : 'November 2026 (2026-11)'}
            </div>
            <div className="text-xs font-extrabold text-[#14243D] mt-1">
              {summary.stagedNovemberRecords.length}{' '}
              {isAr ? 'مزادات مطابقة 100%' : 'Identical Auctions'} ·{' '}
              {summary.overallSaleRateToMigrate.toFixed(1)}%
            </div>
          </div>

          <div className="bg-[#FEF3F2] border border-[#FECDCA] rounded-xl p-3">
            <div className="text-[11px] font-bold text-[#B4232C]">
              {isAr ? 'الأشهر المشمولة بالتصفير' : 'Months to Zero'}
            </div>
            <div className="text-sm font-black text-[#C52B36] mt-0.5">
              {isAr
                ? 'أكتوبر 2026 + جميع الأشهر الأخرى'
                : 'Oct 2026 + All Other Months'}
            </div>
            <div className="text-xs font-extrabold text-[#14243D] mt-1">
              {isAr
                ? 'تصفير السجلات (0 مزادات، 0%) مع بقاء الأشهر متاحة'
                : 'Reset to 0 auctions (0%) while keeping months ready'}
            </div>
          </div>
        </div>

        {/* 3. Detailed Record Parity Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-[#123B70] text-white px-3.5 py-2 text-xs font-extrabold flex items-center justify-between">
            <span>
              {isAr
                ? 'جدول التحقق من تطابق السجلات المنقولة إلى نوفمبر 2026 (AUC-001 إلى AUC-005)'
                : 'Migrated Records Parity Verification (November 2026)'}
            </span>
            <span className="text-[#D6A348]">
              {summary.parityVerified
                ? isAr
                  ? '✓ تطابق 100% مؤكد'
                  : '✓ 100% Parity Verified'
                : isAr
                ? 'تنبيه اختلاف'
                : 'Mismatch Warning'}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-center text-xs font-bold border-collapse">
              <thead>
                <tr className="bg-slate-100 text-[#123B70] border-b border-slate-200">
                  <th className="py-1.5 px-2">{isAr ? 'رقم المزاد' : 'Auction'}</th>
                  <th className="py-1.5 px-2">{isAr ? 'المدة' : 'Duration'}</th>
                  <th className="py-1.5 px-2">{isAr ? 'المدرجة' : 'Listed'}</th>
                  <th className="py-1.5 px-2">{isAr ? 'المبيعة' : 'Sold'}</th>
                  <th className="py-1.5 px-2">{isAr ? 'غير المبيعة' : 'Unsold'}</th>
                  <th className="py-1.5 px-2">{isAr ? 'نسبة البيع' : 'Sale %'}</th>
                  <th className="py-1.5 px-2">
                    {isAr ? 'الملاحظات والتحديات والتوصيات' : 'Notes & Actions'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {summary.stagedNovemberRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50">
                    <td className="py-1.5 px-2 font-en font-black text-[#123B70]">
                      {rec.auctionNumber}
                    </td>
                    <td className="py-1.5 px-2">
                      {isAr ? rec.durationAr : rec.durationEn}
                    </td>
                    <td className="py-1.5 px-2 tabular-nums">
                      {rec.listedVehicles}
                    </td>
                    <td className="py-1.5 px-2 tabular-nums text-[#16843B]">
                      {rec.soldVehicles}
                    </td>
                    <td className="py-1.5 px-2 tabular-nums text-[#C52B36]">
                      {rec.unsoldVehicles}
                    </td>
                    <td className="py-1.5 px-2 tabular-nums font-black text-[#16843B]">
                      {rec.saleRate.toFixed(1)}%
                    </td>
                    <td className="py-1.5 px-2 text-right text-[11px] text-slate-600">
                      {isAr ? rec.notesAr : rec.notesEn}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. Conflict Resolution Option if November had custom records */}
        {summary.hasNovemberConflict && (
          <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl space-y-2">
            <div className="text-xs font-extrabold text-amber-900">
              {isAr
                ? 'تنبيه: يحتوي شهر نوفمبر 2026 على سجلات مسبقة مختلفة. يرجى تحديد طريقة التعامل معها:'
                : 'Notice: November 2026 contains existing custom records. Choose how to proceed:'}
            </div>
            <div className="flex items-center gap-4 text-xs font-bold">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="conflictMode"
                  checked={conflictMode === 'replace'}
                  onChange={() => setConflictMode('replace')}
                />
                <span>
                  {isAr
                    ? 'اعتماد بيانات أكتوبر المنقولة فقط في نوفمبر'
                    : 'Use migrated October data only'}
                </span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="conflictMode"
                  checked={conflictMode === 'merge'}
                  onChange={() => setConflictMode('merge')}
                />
                <span>
                  {isAr
                    ? 'دمج السجلات غير المتكررة مع البيانات المنقولة'
                    : 'Merge non-duplicate records'}
                </span>
              </label>
            </div>
          </div>
        )}

        {/* 5. Toggleable 15-Point Automated Verification & Date Simulation Report */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowTestSuite(!showTestSuite)}
            className="w-full px-3.5 py-2 bg-[#F8FAFC] hover:bg-slate-100 text-xs font-extrabold text-[#123B70] flex items-center justify-between cursor-pointer"
          >
            <span>
              {isAr
                ? `تقرير الاختبارات الإلزامية ومحاكاة التواريخ بتوقيت الإمارات (${passedCount}/${testResults.length} ناجح)`
                : `Mandatory 15-Point Verification & UAE Date Simulation (${passedCount}/${testResults.length} Passed)`}
            </span>
            <span className="text-[#16843B]">
              {showTestSuite
                ? isAr
                  ? 'إخفاء التفاصيل ▲'
                  : 'Hide Details ▲'
                : isAr
                ? 'عرض الاختبارات الـ 15 ▼'
                : 'Show 15 Tests ▼'}
            </span>
          </button>
          {showTestSuite && (
            <div className="p-3 bg-white divide-y divide-slate-100 max-h-[210px] overflow-y-auto text-xs">
              {testResults.map((t) => (
                <div
                  key={t.id}
                  className="py-1.5 flex items-center justify-between gap-2"
                >
                  <div className="font-extrabold text-[#14243D]">
                    <span className="text-[#16843B] me-1.5">✓</span>
                    {t.titleAr}
                  </div>
                  <div className="text-[11px] font-bold text-[#64748B]">
                    {t.detailAr}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 6. Action Buttons */}
        <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleConfirmRestoreBackup}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-extrabold text-[#123B70] bg-[#EEF3F9] hover:bg-[#DCE6F2] border border-[#BCC8D6] rounded-xl cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>
              {isAr
                ? 'استعادة النسخة الاحتياطية الكاملة (مع أكتوبر الأصلي)'
                : 'Restore Full Backup (incl. Original Oct)'}
            </span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isProcessing}
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer disabled:opacity-50"
            >
              {isAr ? 'إغلاق' : 'Close'}
            </button>
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleConfirmMigration}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-extrabold text-white bg-[#16843B] hover:bg-[#126E30] rounded-xl shadow-xs cursor-pointer disabled:opacity-60"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>
                {summary.migrationState === 'completed'
                  ? isAr
                    ? 'إعادة تأكيد الترحيل وتصفير الأشهر الأخرى'
                    : 'Re-Confirm Migration & Zero Other Months'
                  : isAr
                  ? 'الموافقة على الترحيل وتصفير أكتوبر وبقية الأشهر'
                  : 'Approve Migration & Zero Oct + Other Months'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </AppDialog>
  );
};
