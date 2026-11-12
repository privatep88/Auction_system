import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  AlertCircle,
  Trash2,
  SlidersHorizontal,
  Database,
  RotateCcw,
} from 'lucide-react';
import {
  AuctionRecord,
  FirebaseConnectionConfig,
  Language,
  PerformanceThresholds,
} from '../types/auction';

interface AuctionFormModalProps {
  isOpen: boolean;
  mode: 'add' | 'edit';
  initialRecord: AuctionRecord | null;
  existingAuctions: AuctionRecord[];
  lang: Language;
  onClose: () => void;
  onSave: (record: AuctionRecord) => void;
}

export const AuctionFormModal: React.FC<AuctionFormModalProps> = ({
  isOpen,
  mode,
  initialRecord,
  existingAuctions,
  lang,
  onClose,
  onSave,
}) => {
  const isAr = lang === 'ar';

  const [auctionNumber, setAuctionNumber] = useState('');
  const [durationAr, setDurationAr] = useState('أسبوع (7 أيام)');
  const [durationEn, setDurationEn] = useState('1 Week (7 Days)');
  const [listedVehicles, setListedVehicles] = useState<number>(250);
  const [soldVehicles, setSoldVehicles] = useState<number>(200);
  const [notesAr, setNotesAr] = useState('');
  const [notesEn, setNotesEn] = useState('');
  const [challengesAr, setChallengesAr] = useState('');
  const [challengesEn, setChallengesEn] = useState('');
  const [recommendationsAr, setRecommendationsAr] = useState('');
  const [recommendationsEn, setRecommendationsEn] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (mode === 'edit' && initialRecord) {
      setAuctionNumber(initialRecord.auctionNumber);
      setDurationAr(initialRecord.durationAr);
      setDurationEn(initialRecord.durationEn);
      setListedVehicles(initialRecord.listedVehicles);
      setSoldVehicles(initialRecord.soldVehicles);
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
      setListedVehicles(250);
      setSoldVehicles(210);
      setNotesAr('إقبال جيد على فئة المركبات المعروضة.');
      setNotesEn('Good demand on listed vehicle categories.');
      setChallengesAr('ضغط على ساحة المعاينة.');
      setChallengesEn('High traffic in inspection yard.');
      setRecommendationsAr('تعزيز الترويج وتنظيم المعاينة.');
      setRecommendationsEn('Enhance marketing and organize inspection.');
    }
  }, [isOpen, mode, initialRecord, existingAuctions.length]);

  if (!isOpen) return null;

  const safeListed = Math.max(0, Number(listedVehicles) || 0);
  const safeSold = Math.max(0, Number(soldVehicles) || 0);
  const unsoldPreview = Math.max(0, safeListed - safeSold);
  const saleRatePreview =
    safeListed > 0 ? ((safeSold / safeListed) * 100).toFixed(1) : '0.0';
  const unsoldRatePreview =
    safeListed > 0 ? ((unsoldPreview / safeListed) * 100).toFixed(1) : '0.0';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = auctionNumber.trim().toUpperCase();
    if (!cleanCode) {
      setError(
        isAr ? 'يرجى إدخال رقم المزاد.' : 'Please enter an auction number.'
      );
      return;
    }

    const isDuplicate = existingAuctions.some(
      (a) =>
        a.auctionNumber.toUpperCase() === cleanCode &&
        (mode === 'add' || a.id !== initialRecord?.id)
    );
    if (isDuplicate) {
      setError(
        isAr
          ? `رقم المزاد (${cleanCode}) مسجل مسبقاً. يمنع تكرار أرقام المزادات.`
          : `Auction number (${cleanCode}) already exists. Duplicate auction numbers are not allowed.`
      );
      return;
    }

    if (safeListed <= 0) {
      setError(
        isAr
          ? 'يجب أن يكون عدد المركبات المدرجة أكبر من صفر.'
          : 'Listed vehicles must be greater than zero.'
      );
      return;
    }

    if (safeSold > safeListed) {
      setError(
        isAr
          ? 'خطأ في التحقق: لا يمكن أن يكون عدد المركبات المبيعة أكبر من عدد المركبات المدرجة!'
          : 'Validation error: Sold vehicles cannot exceed listed vehicles!'
      );
      return;
    }

    const now = new Date().toISOString();
    const record: AuctionRecord = {
      id:
        mode === 'edit' && initialRecord
          ? initialRecord.id
          : `auc-${Date.now()}`,
      auctionNumber: cleanCode,
      durationAr: durationAr.trim() || 'أسبوع (7 أيام)',
      durationEn: durationEn.trim() || durationAr.trim() || '1 Week (7 Days)',
      listedVehicles: safeListed,
      soldVehicles: safeSold,
      unsoldVehicles: unsoldPreview,
      saleRate: Number(saleRatePreview),
      unsoldRate: Number(unsoldRatePreview),
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

    onSave(record);
  };

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-white rounded-2xl border border-[#BCC8D6] shadow-2xl w-full max-w-2xl overflow-hidden">
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(90deg, #123B70 0%, #165B9D 100%)',
          }}
          className="px-5 py-3.5 text-white flex items-center justify-between"
        >
          <h3 className="text-base sm:text-lg font-extrabold">
            {mode === 'add'
              ? isAr
                ? 'إضافة سجل مزاد جديد'
                : 'Add New Auction Record'
              : isAr
              ? `تعديل بيانات المزاد (${initialRecord?.auctionNumber})`
              : `Edit Auction Record (${initialRecord?.auctionNumber})`}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-300 rounded-xl flex items-center gap-2 text-xs sm:text-sm font-bold text-[#B4232C]">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
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
                placeholder="AUC-006"
                required
                className="w-full px-3 py-2 text-sm font-mono font-bold border border-slate-300 rounded-lg focus:outline-none focus:border-[#165B9D]"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-[#123B70] mb-1">
                {isAr ? 'مدة عرض المزاد (عربي) *' : 'Duration (Arabic) *'}
              </label>
              <input
                type="text"
                value={durationAr}
                onChange={(e) => setDurationAr(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm font-bold border border-slate-300 rounded-lg focus:outline-none focus:border-[#165B9D]"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-[#123B70] mb-1">
                {isAr ? 'مدة العرض (إنجليزي)' : 'Duration (English)'}
              </label>
              <input
                type="text"
                value={durationEn}
                onChange={(e) => setDurationEn(e.target.value)}
                className="w-full px-3 py-2 text-sm font-bold border border-slate-300 rounded-lg focus:outline-none focus:border-[#165B9D]"
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
                value={listedVehicles}
                onChange={(e) => setListedVehicles(Number(e.target.value))}
                required
                className="w-full px-3 py-2 text-base font-mono font-black bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#165B9D]"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-[#16843A] mb-1">
                {isAr ? 'عدد المركبات المبيعة *' : 'Sold Vehicles *'}
              </label>
              <input
                type="number"
                min={0}
                value={soldVehicles}
                onChange={(e) => setSoldVehicles(Number(e.target.value))}
                required
                className="w-full px-3 py-2 text-base font-mono font-black bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#16843A]"
              />
            </div>

            <div className="flex flex-col justify-center bg-white rounded-lg border border-slate-200 px-3 py-2 text-center">
              <span className="text-[11px] font-bold text-slate-500">
                {isAr
                  ? 'غير المبيعة (حساب تلقائي)'
                  : 'Unsold (Auto-Calculated)'}
              </span>
              <div className="text-lg font-mono font-black text-[#922C35] tabular-nums">
                {unsoldPreview}{' '}
                <span className="text-xs font-bold text-[#16843A]">
                  ({isAr ? 'نسبة البيع:' : 'Sale:'} {saleRatePreview}%)
                </span>
              </div>
            </div>
          </div>

          {/* Qualitative Fields */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-extrabold text-[#123B70] mb-1">
                {isAr ? 'الملاحظات التشغيلية *' : 'Operational Notes *'}
              </label>
              <input
                type="text"
                value={isAr ? notesAr : notesEn}
                onChange={(e) => {
                  if (isAr) setNotesAr(e.target.value);
                  else setNotesEn(e.target.value);
                }}
                required
                className="w-full px-3 py-2 text-sm font-semibold border border-slate-300 rounded-lg focus:outline-none focus:border-[#165B9D]"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-[#922C35] mb-1">
                {isAr ? 'التحديات المرصودة *' : 'Operational Challenges *'}
              </label>
              <input
                type="text"
                value={isAr ? challengesAr : challengesEn}
                onChange={(e) => {
                  if (isAr) setChallengesAr(e.target.value);
                  else setChallengesEn(e.target.value);
                }}
                required
                className="w-full px-3 py-2 text-sm font-semibold border border-slate-300 rounded-lg focus:outline-none focus:border-[#165B9D]"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-[#16843A] mb-1">
                {isAr
                  ? 'التوصيات والإجراءات التحسينية *'
                  : 'Recommendations & Improvement Actions *'}
              </label>
              <input
                type="text"
                value={isAr ? recommendationsAr : recommendationsEn}
                onChange={(e) => {
                  if (isAr) setRecommendationsAr(e.target.value);
                  else setRecommendationsEn(e.target.value);
                }}
                required
                className="w-full px-3 py-2 text-sm font-semibold border border-slate-300 rounded-lg focus:outline-none focus:border-[#165B9D]"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-extrabold text-white bg-[#123B70] hover:bg-[#165B9D] rounded-lg shadow-sm cursor-pointer"
            >
              <Check className="w-4 h-4" />
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
      </div>
    </div>
  );
};

interface DeleteConfirmModalProps {
  record: AuctionRecord | null;
  lang: Language;
  onCancel: () => void;
  onConfirm: (record: AuctionRecord) => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  record,
  lang,
  onCancel,
  onConfirm,
}) => {
  if (!record) return null;
  const isAr = lang === 'ar';

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-2xl border border-red-200 shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-[#922C35] px-5 py-3 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trash2 className="w-5 h-5" />
            <h3 className="text-base font-extrabold">
              {isAr ? 'تأكيد حذف سجل المزاد' : 'Confirm Auction Deletion'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-white/80 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm font-bold text-slate-700 leading-relaxed">
            {isAr
              ? `هل أنت متأكد من رغبتك في حذف المزاد رقم (${record.auctionNumber})؟ سيتم تحديث جميع المؤشرات والرسوم البيانية تلقائياً.`
              : `Are you sure you want to delete auction (${record.auctionNumber})? All KPIs and executive charts will update automatically.`}
          </p>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              {isAr ? 'تراجع' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={() => onConfirm(record)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-extrabold text-white bg-[#B4232C] hover:bg-red-800 rounded-lg shadow-sm cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>{isAr ? 'تأكيد الحذف النهائي' : 'Confirm Delete'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
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
  const [excellentMin, setExcellentMin] = useState(thresholds.excellentMin);
  const [goodMin, setGoodMin] = useState(thresholds.goodMin);
  const [needsImprovementMin, setNeedsImprovementMin] = useState(
    thresholds.needsImprovementMin
  );
  const [useDetailedFourTierLabels, setUseDetailedFourTierLabels] = useState(
    thresholds.useDetailedFourTierLabels
  );

  const [apiKey, setApiKey] = useState(firebaseConfig?.apiKey || '');
  const [projectId, setProjectId] = useState(firebaseConfig?.projectId || '');
  const [authDomain, setAuthDomain] = useState(
    firebaseConfig?.authDomain || ''
  );
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setExcellentMin(thresholds.excellentMin);
    setGoodMin(thresholds.goodMin);
    setNeedsImprovementMin(thresholds.needsImprovementMin);
    setUseDetailedFourTierLabels(thresholds.useDetailedFourTierLabels);
    setApiKey(firebaseConfig?.apiKey || '');
    setProjectId(firebaseConfig?.projectId || '');
    setAuthDomain(firebaseConfig?.authDomain || '');
    setConfirmReset(false);
  }, [isOpen, thresholds, firebaseConfig]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveThresholds({
      excellentMin: Number(excellentMin) || 85,
      goodMin: Number(goodMin) || 75,
      needsImprovementMin: Number(needsImprovementMin) || 60,
      useDetailedFourTierLabels,
    });
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

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-white rounded-2xl border border-[#BCC8D6] shadow-2xl w-full max-w-xl overflow-hidden">
        <div
          style={{
            background: 'linear-gradient(90deg, #123B70 0%, #165B9D 100%)',
          }}
          className="px-5 py-3.5 text-white flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5" />
            <h3 className="text-base font-extrabold">
              {isAr
                ? 'إعدادات النظام وحدود التقييم والربط السحابي'
                : 'System Settings, Rating Thresholds & Cloud Sync'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-5">
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

            <div className="grid grid-cols-3 gap-3 bg-[#F4F7FB] p-3 rounded-xl border border-[#CBD5E1]">
              <div>
                <label className="block text-[11px] font-extrabold text-[#006100] mb-1">
                  {isAr ? 'ممتاز (≥ %)' : 'Excellent (≥ %)'}
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={excellentMin}
                  onChange={(e) => setExcellentMin(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-sm font-mono font-bold bg-white border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-[#16843A] mb-1">
                  {isAr ? 'أداء جيد (≥ %)' : 'Good (≥ %)'}
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={goodMin}
                  onChange={(e) => setGoodMin(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-sm font-mono font-bold bg-white border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-[#926000] mb-1">
                  {isAr ? 'يحتاج إلى تحسين (≥ %)' : 'Needs Improv. (≥ %)'}
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={needsImprovementMin}
                  onChange={(e) =>
                    setNeedsImprovementMin(Number(e.target.value))
                  }
                  className="w-full px-2.5 py-1.5 text-sm font-mono font-bold bg-white border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={useDetailedFourTierLabels}
                onChange={(e) =>
                  setUseDetailedFourTierLabels(e.target.checked)
                }
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
            <div className="flex items-center justify-between">
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
                  ? 'تخزين محلي نشط (LocalStorage)'
                  : 'Local Persistence Active'}
              </span>
            </div>

            <p className="text-[11.5px] font-semibold text-slate-500">
              {isAr
                ? 'يحفظ النظام جميع التعديلات تلقائياً في المتصفح (LocalStorage). لربط النظام بقاعدة بيانات Firebase Firestore سحابية، أدخل بيانات المشروع أدناه:'
                : 'Data is automatically persisted in LocalStorage. Enter your Firebase project credentials below to enable live Firestore cloud sync:'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Firebase apiKey"
                className="px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-lg"
              />
              <input
                type="text"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                placeholder="Firebase projectId"
                className="px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          {/* Reset to Default Reference Data */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
            {!confirmReset ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="flex items-center gap-1.5 text-xs font-bold text-[#922C35] hover:underline cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>
                  {isAr
                    ? 'استعادة بيانات الصورة المرجعية الافتراضية (5 مزادات)'
                    : 'Reset to Reference Default Data (5 Auctions)'}
                </span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-red-700">
                  {isAr ? 'تأكيد الاستعادة؟' : 'Confirm reset?'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onResetDefaults();
                    onClose();
                  }}
                  className="px-2.5 py-1 text-xs font-extrabold bg-red-600 text-white rounded-md cursor-pointer"
                >
                  {isAr ? 'نعم، استعد' : 'Yes, Reset'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="px-2.5 py-1 text-xs font-bold bg-slate-200 text-slate-700 rounded-md cursor-pointer"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                {isAr ? 'إغلاق' : 'Close'}
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-5 py-2 text-xs font-extrabold text-white bg-[#123B70] hover:bg-[#165B9D] rounded-lg shadow-sm cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{isAr ? 'حفظ الإعدادات' : 'Save Settings'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
