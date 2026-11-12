import React from 'react';
import {
  CalendarRange,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { Language, ReportingPeriod } from '../types/auction';
import {
  ARABIC_MONTHS,
  ENGLISH_MONTHS,
  formatPeriodKey,
  getCurrentUaePeriod,
  getMonthName,
} from '../services/storageService';

interface ReportingPeriodBarProps {
  selectedPeriod: ReportingPeriod;
  yearsWithData: number[];
  countsByPeriodKey: Record<string, number>;
  lang: Language;
  migrationState?: 'pending_approval' | 'completed';
  onSelectPeriod: (year: number, month: number) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onReturnToCurrentMonth: () => void;
  onOpenMigrationModal?: () => void;
}

export const ReportingPeriodBar: React.FC<ReportingPeriodBarProps> = ({
  selectedPeriod,
  yearsWithData,
  countsByPeriodKey,
  lang,
  migrationState,
  onSelectPeriod,
  onPrevMonth,
  onNextMonth,
  onReturnToCurrentMonth,
  onOpenMigrationModal,
}) => {
  const isAr = lang === 'ar';
  const { year, month } = selectedPeriod;
  const monthName = getMonthName(month, lang);
  const uaeNow = getCurrentUaePeriod();
  const isCurrentUaeMonth =
    year === uaeNow.year && month === uaeNow.month;

  // Build available years list (2023..2030 + any year in yearsWithData or currently selected)
  const baseYears = [2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030];
  const allYears = Array.from(
    new Set([...baseYears, ...yearsWithData, year])
  ).sort((a, b) => a - b);

  const currentPeriodCount =
    countsByPeriodKey[formatPeriodKey(year, month)] || 0;

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="my-2 bg-white border border-[#BCC8D6] rounded-[12px] px-3 py-1.5 shadow-[0_1px_4px_rgba(18,59,112,0.06)] flex flex-wrap items-center justify-between gap-2"
    >
      {/* Right Section: Title & Dynamic Selected Period Label */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div
          style={{
            background: 'linear-gradient(180deg, #165B9D 0%, #123B70 100%)',
          }}
          className="text-white px-3 py-1 rounded-lg flex items-center gap-1.5 text-xs font-extrabold shadow-2xs whitespace-nowrap"
        >
          <CalendarRange className="w-3.5 h-3.5 text-[#D5A03D] shrink-0" />
          <span>{isAr ? 'الفترة الزمنية للتقرير' : 'Reporting Period'}</span>
        </div>

        {/* Dynamic Period Heading */}
        <div className="flex items-center gap-2 bg-[#EEF3F9] border border-[#CBD5E1] px-3 py-1 rounded-lg">
          <span className="text-[13px] sm:text-[14px] font-black text-[#123B70] whitespace-nowrap">
            {isAr
              ? `تقرير مزادات شهر ${monthName} ${year}`
              : `Auction Report — ${monthName} ${year}`}
          </span>
          <span
            className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full tabular-nums whitespace-nowrap ${
              currentPeriodCount > 0
                ? 'bg-[#D7F0D8] text-[#13652C] border border-[#9CD6A0]'
                : 'bg-slate-200 text-slate-600'
            }`}
          >
            {isAr
              ? `${currentPeriodCount} ${
                  currentPeriodCount === 1 ? 'مزاد' : 'مزادات'
                }`
              : `${currentPeriodCount} ${
                  currentPeriodCount === 1 ? 'Auction' : 'Auctions'
                }`}
          </span>
          {isCurrentUaeMonth && (
            <span className="text-[10.5px] font-extrabold text-[#165B9D] whitespace-nowrap">
              {isAr ? '· الشهر الحالي (توقيت الإمارات)' : '· Current Month (UAE)'}
            </span>
          )}
        </div>
      </div>

      {/* Left Section: Month Selector, Year Selector & Navigation Controls */}
      <div className="no-print flex flex-wrap items-center gap-1.5">
        {/* Previous Month Button */}
        <button
          type="button"
          onClick={onPrevMonth}
          title={isAr ? 'الشهر السابق' : 'Previous Month'}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-extrabold text-[#123B70] bg-[#F4F7FB] hover:bg-[#E2EBF5] border border-[#BCC8D6] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
        >
          {isAr ? (
            <ChevronRight className="w-3.5 h-3.5" />
          ) : (
            <ChevronLeft className="w-3.5 h-3.5" />
          )}
          <span>{isAr ? 'الشهر السابق' : 'Prev Month'}</span>
        </button>

        {/* Month Selector Dropdown */}
        <div className="flex items-center gap-1 bg-[#F8FAFC] border border-[#94A3B8] rounded-lg px-2 py-0.5">
          <label
            htmlFor="saaed-month-select"
            className="text-[11px] font-bold text-slate-500 whitespace-nowrap"
          >
            {isAr ? 'الشهر:' : 'Month:'}
          </label>
          <select
            id="saaed-month-select"
            value={month}
            onChange={(e) => onSelectPeriod(year, Number(e.target.value))}
            className="bg-transparent text-xs sm:text-[13px] font-black text-[#0F294A] focus:outline-none cursor-pointer pe-1"
          >
            {(isAr ? ARABIC_MONTHS : ENGLISH_MONTHS).map((mLabel, idx) => {
              const mNum = idx + 1;
              const pKey = formatPeriodKey(year, mNum);
              const cnt = countsByPeriodKey[pKey] || 0;
              return (
                <option key={mNum} value={mNum}>
                  {mLabel} {cnt > 0 ? `(${cnt})` : ''}
                </option>
              );
            })}
          </select>
        </div>

        {/* Year Selector Dropdown */}
        <div className="flex items-center gap-1 bg-[#F8FAFC] border border-[#94A3B8] rounded-lg px-2 py-0.5">
          <label
            htmlFor="saaed-year-select"
            className="text-[11px] font-bold text-slate-500 whitespace-nowrap"
          >
            {isAr ? 'السنة:' : 'Year:'}
          </label>
          <select
            id="saaed-year-select"
            value={year}
            onChange={(e) => onSelectPeriod(Number(e.target.value), month)}
            className="bg-transparent text-xs sm:text-[13px] font-black font-en tabular-nums text-[#0F294A] focus:outline-none cursor-pointer pe-1"
          >
            {allYears.map((y) => {
              const hasData = yearsWithData.includes(y);
              return (
                <option key={y} value={y}>
                  {y} {hasData ? '•' : ''}
                </option>
              );
            })}
          </select>
        </div>

        {/* Next Month Button */}
        <button
          type="button"
          onClick={onNextMonth}
          title={isAr ? 'الشهر التالي' : 'Next Month'}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-extrabold text-[#123B70] bg-[#F4F7FB] hover:bg-[#E2EBF5] border border-[#BCC8D6] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
        >
          <span>{isAr ? 'الشهر التالي' : 'Next Month'}</span>
          {isAr ? (
            <ChevronLeft className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Go to Current Month Button */}
        <button
          type="button"
          onClick={onReturnToCurrentMonth}
          title={
            isAr
              ? 'الانتقال إلى الشهر الحالي وفق توقيت الإمارات (Asia/Dubai)'
              : 'Go to Current Month (Asia/Dubai)'
          }
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-extrabold text-white bg-[#165B9D] hover:bg-[#123B70] rounded-lg shadow-2xs transition-colors cursor-pointer whitespace-nowrap"
        >
          <RotateCcw className="w-3 h-3" />
          <span>{isAr ? 'الانتقال إلى الشهر الحالي' : 'Current Month'}</span>
        </button>

        {/* Data Migration & Backup Verification Button */}
        {onOpenMigrationModal && (
          <button
            type="button"
            onClick={onOpenMigrationModal}
            title={
              isAr
                ? 'ملخص ترحيل بيانات أكتوبر إلى نوفمبر وتصفير بقية الأشهر والنسخة الاحتياطية'
                : 'Oct -> Nov Migration Summary, Zeroing Approval & Backup'
            }
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-extrabold rounded-lg shadow-2xs transition-colors cursor-pointer whitespace-nowrap ${
              migrationState === 'pending_approval'
                ? 'bg-[#D5A03D] hover:bg-[#C28E2C] text-[#0A1E3C]'
                : 'bg-[#ECFDF3] hover:bg-[#D7F0D8] text-[#13652C] border border-[#9CD6A0]'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>
              {migrationState === 'pending_approval'
                ? isAr
                  ? 'اعتماد الترحيل وتصفير الأشهر'
                  : 'Approve Migration & Zeroing'
                : isAr
                ? 'سجل الترحيل والنسخة الاحتياطية'
                : 'Migration & Backup Verified'}
            </span>
          </button>
        )}
      </div>
    </div>
  );
};
