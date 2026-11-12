import React, { useState, useEffect } from 'react';
import {
  Calendar,
  FileText,
  AlertTriangle,
  Lightbulb,
  Calculator,
  Plus,
  Search,
  Edit3,
  Trash2,
  ArrowUpDown,
  Gavel,
  Check,
  X,
} from 'lucide-react';
import {
  AuctionRecord,
  ComputedAuctionMetrics,
  Language,
  ReportingPeriod,
  ReportMetadata,
} from '../types/auction';
import { getMonthName } from '../services/storageService';
import {
  GoldenGavelIcon,
  NavyCarIcon,
  CarSoldIcon,
  CarUnsoldIcon,
  PieChartKpiIcon,
  ExcelSheetIcon,
} from './CustomIcons';
import { ReportingPeriodBar } from './ReportingPeriodBar';

interface AuctionDataReportProps {
  auctions: AuctionRecord[];
  metrics: ComputedAuctionMetrics;
  metadata: ReportMetadata;
  selectedPeriod: ReportingPeriod;
  yearsWithData: number[];
  countsByPeriodKey: Record<string, number>;
  lang: Language;
  pixelPerfectMode: boolean;
  onSelectPeriod: (year: number, month: number) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onReturnToCurrentMonth: () => void;
  onUpdateMetadata: (meta: ReportMetadata) => void;
  onOpenAddModal: () => void;
  onOpenEditModal: (record: AuctionRecord) => void;
  onDeleteAuction: (record: AuctionRecord) => void;
  onInlineSaveAuction: (record: AuctionRecord) => { ok: boolean; error?: string };
  onInlineDirtyChange?: (isDirty: boolean) => void;
  onSwitchToSheet2?: () => void;
  migrationState?: 'pending_approval' | 'completed';
  onOpenMigrationModal?: () => void;
}

type SortField =
  | 'index'
  | 'auctionNumber'
  | 'listedVehicles'
  | 'soldVehicles'
  | 'unsoldVehicles'
  | 'saleRate';

export const AuctionDataReport: React.FC<AuctionDataReportProps> = ({
  auctions,
  metrics,
  metadata,
  selectedPeriod,
  yearsWithData,
  countsByPeriodKey,
  lang,
  pixelPerfectMode,
  onSelectPeriod,
  onPrevMonth,
  onNextMonth,
  onReturnToCurrentMonth,
  onUpdateMetadata,
  onOpenAddModal,
  onOpenEditModal,
  onDeleteAuction,
  onInlineSaveAuction,
  onInlineDirtyChange,
  onSwitchToSheet2,
  migrationState,
  onOpenMigrationModal,
}) => {
  const isAr = lang === 'ar';
  const assetBase = import.meta.env.BASE_URL || './';
  const monthNameAr = getMonthName(selectedPeriod.month, 'ar');
  const monthNameEn = getMonthName(selectedPeriod.month, 'en');
  const currentMonthLabel = isAr ? monthNameAr : monthNameEn;

  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('index');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [editingDateField, setEditingDateField] = useState<
    'reportDate' | 'periodStart' | 'periodEnd' | null
  >(null);
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [inlineDraft, setInlineDraft] = useState<AuctionRecord | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);

  // Reset inline edit state when selectedPeriod changes
  useEffect(() => {
    setInlineEditId(null);
    setInlineDraft(null);
    setInlineError(null);
    onInlineDirtyChange?.(false);
  }, [selectedPeriod.year, selectedPeriod.month]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const filteredAuctions = auctions
    .map((item, idx) => ({ item, originalIndex: idx + 1 }))
    .filter(({ item }) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        item.auctionNumber.toLowerCase().includes(q) ||
        item.durationAr.toLowerCase().includes(q) ||
        item.durationEn.toLowerCase().includes(q) ||
        item.notesAr.toLowerCase().includes(q) ||
        item.notesEn.toLowerCase().includes(q) ||
        item.challengesAr.toLowerCase().includes(q) ||
        item.challengesEn.toLowerCase().includes(q) ||
        item.recommendationsAr.toLowerCase().includes(q) ||
        item.recommendationsEn.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortField === 'index') cmp = a.originalIndex - b.originalIndex;
      else if (sortField === 'auctionNumber')
        cmp = a.item.auctionNumber.localeCompare(b.item.auctionNumber);
      else if (sortField === 'listedVehicles')
        cmp = a.item.listedVehicles - b.item.listedVehicles;
      else if (sortField === 'soldVehicles')
        cmp = a.item.soldVehicles - b.item.soldVehicles;
      else if (sortField === 'unsoldVehicles')
        cmp = a.item.unsoldVehicles - b.item.unsoldVehicles;
      else if (sortField === 'saleRate') cmp = a.item.saleRate - b.item.saleRate;
      return sortAsc ? cmp : -cmp;
    });

  const startInlineEdit = (rec: AuctionRecord) => {
    setInlineEditId(rec.id);
    setInlineDraft({ ...rec });
    setInlineError(null);
    onInlineDirtyChange?.(true);
  };

  const cancelInlineEdit = () => {
    setInlineEditId(null);
    setInlineDraft(null);
    setInlineError(null);
    onInlineDirtyChange?.(false);
  };

  const saveInlineEdit = () => {
    if (!inlineDraft) return;
    const res = onInlineSaveAuction(inlineDraft);
    if (!res.ok) {
      setInlineError(res.error || (isAr ? 'بيانات غير صالحة' : 'Invalid data'));
      return;
    }
    setInlineEditId(null);
    setInlineDraft(null);
    setInlineError(null);
    onInlineDirtyChange?.(false);
  };

  return (
    <section
      id="sheet1-report-container"
      dir={isAr ? 'rtl' : 'ltr'}
      className="print-sheet w-full bg-[#F4F7FB] rounded-[18px] border border-[#BCC8D6] shadow-[0_4px_20px_rgba(18,59,112,0.08)] overflow-hidden p-2.5 sm:p-3.5 transition-all"
    >
      {/* 1. HEADER BANNER & METADATA BAR (Exact Reference Geometry Preserved) */}
      <div
        dir="ltr"
        className="relative w-full rounded-t-[14px] overflow-hidden bg-white border border-[#CBD5E1] shadow-xs"
      >
        <div className="flex flex-col lg:flex-row items-stretch w-full min-h-[126px]">
          {/* Left Panoramic Auction Yard & Gavel Photo */}
          <div className="relative lg:w-[49.2%] w-full h-[110px] sm:h-[126px] shrink-0 overflow-hidden bg-[#123B70]">
            <img
              src={`${assetBase}assets/header_top_photo.png`}
              alt="SAAED Vehicle Auction Yard"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-right select-none"
            />
          </div>

          {/* Right Header Stack: Top Corporate Blue Banner + SAAED Logo, Bottom Date Bar */}
          <div className="flex-1 flex flex-col justify-between bg-white">
            {/* Top Row (86px): Blue Title Banner + White Logo Box */}
            <div className="flex items-stretch h-[86px] w-full">
              {/* Corporate Blue Title Center */}
              <div
                dir="rtl"
                className="relative flex-1 flex flex-col items-center justify-center px-3 text-center overflow-hidden"
                style={{
                  background:
                    'linear-gradient(180deg, #165B9D 0%, #123B70 62%, #0D2D56 100%)',
                }}
              >
                <h1 className="text-[22px] sm:text-[28px] font-black text-white leading-tight tracking-tight drop-shadow-xs">
                  {isAr ? 'تقرير بيانات المزادات' : 'Vehicle Auction Data Report'}
                </h1>
                <p className="text-[13px] sm:text-[16px] font-bold text-white/95 font-en tracking-wide leading-tight mt-0.5">
                  {isAr
                    ? `Vehicle Auction Data Report — ${monthNameAr} ${selectedPeriod.year}`
                    : `تقرير مزادات شهر ${monthNameAr} ${selectedPeriod.year}`}
                </p>

                {/* Curved Diagonal Left/Right SVG Accents */}
                <svg
                  viewBox="0 0 40 86"
                  preserveAspectRatio="none"
                  className="absolute right-0 top-0 h-full w-7 pointer-events-none"
                >
                  <path d="M40 0 L0 86 L40 86 Z" fill="#FFFFFF" />
                </svg>
              </div>

              {/* Official SAAED Logo Box (Far Right) */}
              <div className="w-[165px] sm:w-[225px] bg-white flex items-center justify-center px-3 py-1.5 shrink-0">
                <img
                  src={`${assetBase}assets/saaed_logo.png`}
                  alt="SAAED Logo - ساعد"
                  referrerPolicy="no-referrer"
                  className="max-h-[74px] w-auto object-contain select-none"
                />
              </div>
            </div>

            {/* Bottom Row (40px): Report Date & Period Strip */}
            <div
              dir={isAr ? 'rtl' : 'ltr'}
              className="min-h-[40px] bg-[#EEF3F9] border-t border-[#D5DFEC] px-2.5 py-1 flex flex-wrap items-center justify-between gap-2"
            >
              {/* Report Preparation Date Pill */}
              <div className="flex items-center gap-2 bg-white border border-[#CBD5E1] rounded-full px-3.5 py-0.5 shadow-2xs text-[12px] sm:text-[13px] font-bold text-[#0F294A]">
                <Calendar className="w-4 h-4 text-[#123B70] shrink-0" />
                <span>
                  {isAr ? 'تاريخ إعداد التقرير :' : 'Report Date :'}
                </span>
                {editingDateField === 'reportDate' ? (
                  <input
                    type="date"
                    value={metadata.reportDate}
                    onChange={(e) =>
                      onUpdateMetadata({ ...metadata, reportDate: e.target.value })
                    }
                    onBlur={() => setEditingDateField(null)}
                    autoFocus
                    className="bg-slate-50 border border-[#165B9D] rounded px-1.5 py-0 text-xs font-mono tabular-nums text-[#123B70] focus:outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingDateField('reportDate')}
                    title={isAr ? 'انقر لتعديل تاريخ التقرير' : 'Click to edit report date'}
                    className="font-mono tabular-nums font-bold text-[#0F294A] hover:text-[#165B9D] cursor-pointer transition-colors"
                  >
                    {metadata.reportDate} :
                  </button>
                )}
              </div>

              {/* Covered Period Pill */}
              <div className="flex items-center gap-1.5 bg-white border border-[#CBD5E1] rounded-full px-3.5 py-0.5 shadow-2xs text-[12px] sm:text-[13px] font-bold text-[#0F294A]">
                <Calendar className="w-4 h-4 text-[#123B70] shrink-0" />
                <span>
                  {isAr ? 'الفترة المشمولة بالتقرير : من' : 'Report Period : From'}
                </span>
                {editingDateField === 'periodStart' ? (
                  <input
                    type="date"
                    value={metadata.periodStart}
                    onChange={(e) =>
                      onUpdateMetadata({ ...metadata, periodStart: e.target.value })
                    }
                    onBlur={() => setEditingDateField(null)}
                    autoFocus
                    className="bg-slate-50 border border-[#165B9D] rounded px-1.5 py-0 text-xs font-mono tabular-nums text-[#123B70] focus:outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingDateField('periodStart')}
                    title={isAr ? 'انقر لتعديل تاريخ البداية' : 'Click to edit start date'}
                    className="font-mono tabular-nums font-bold text-[#0F294A] hover:text-[#165B9D] cursor-pointer transition-colors"
                  >
                    {metadata.periodStart}
                  </button>
                )}
                <span>{isAr ? 'إلى' : 'to'}</span>
                {editingDateField === 'periodEnd' ? (
                  <input
                    type="date"
                    value={metadata.periodEnd}
                    onChange={(e) =>
                      onUpdateMetadata({ ...metadata, periodEnd: e.target.value })
                    }
                    onBlur={() => setEditingDateField(null)}
                    autoFocus
                    className="bg-slate-50 border border-[#165B9D] rounded px-1.5 py-0 text-xs font-mono tabular-nums text-[#123B70] focus:outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingDateField('periodEnd')}
                    title={isAr ? 'انقر لتعديل تاريخ النهاية' : 'Click to edit end date'}
                    className="font-mono tabular-nums font-bold text-[#0F294A] hover:text-[#165B9D] cursor-pointer transition-colors"
                  >
                    {metadata.periodEnd} :
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 1.B REPORTING PERIOD SELECTOR BAR (Below Main Header, Above KPI Cards) */}
      <ReportingPeriodBar
        selectedPeriod={selectedPeriod}
        yearsWithData={yearsWithData}
        countsByPeriodKey={countsByPeriodKey}
        lang={lang}
        migrationState={migrationState}
        onSelectPeriod={onSelectPeriod}
        onPrevMonth={onPrevMonth}
        onNextMonth={onNextMonth}
        onReturnToCurrentMonth={onReturnToCurrentMonth}
        onOpenMigrationModal={onOpenMigrationModal}
      />

      {/* 2. SIX KPI CARDS ROW */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5 my-2.5">
        {/* Card 1: Total Auctions */}
        <div className="bg-white border border-[#BCC8D6] rounded-[14px] px-3 py-2 shadow-[0_2px_5px_rgba(18,59,112,0.06)] flex items-center justify-between">
          <div className="flex-1 text-center">
            <div className="text-[12.5px] sm:text-[13.5px] font-extrabold text-[#0F294A] leading-snug whitespace-nowrap">
              {isAr ? 'إجمالي عدد المزادات' : 'Total Auctions'}
            </div>
            <div className="text-[24px] sm:text-[27px] font-black text-[#8F242C] tabular-nums leading-tight mt-0.5">
              {metrics.totalAuctions.toLocaleString('en-US')}
            </div>
          </div>
          <GoldenGavelIcon className="w-10 h-10 sm:w-11 sm:h-11 shrink-0" />
        </div>

        {/* Card 2: Total Listed Vehicles */}
        <div className="bg-white border border-[#BCC8D6] rounded-[14px] px-3 py-2 shadow-[0_2px_5px_rgba(18,59,112,0.06)] flex items-center justify-between">
          <div className="flex-1 text-center">
            <div className="text-[12.5px] sm:text-[13.5px] font-extrabold text-[#0F294A] leading-snug whitespace-nowrap">
              {isAr ? 'إجمالي المركبات المدرجة' : 'Total Listed Vehicles'}
            </div>
            <div className="text-[24px] sm:text-[27px] font-black text-[#8F242C] tabular-nums leading-tight mt-0.5">
              {metrics.totalListed.toLocaleString('en-US')}
            </div>
          </div>
          <NavyCarIcon className="w-10 h-10 sm:w-11 sm:h-11 shrink-0" />
        </div>

        {/* Card 3: Total Sold Vehicles */}
        <div className="bg-white border border-[#BCC8D6] rounded-[14px] px-3 py-2 shadow-[0_2px_5px_rgba(18,59,112,0.06)] flex items-center justify-between">
          <div className="flex-1 text-center">
            <div className="text-[12.5px] sm:text-[13.5px] font-extrabold text-[#0F294A] leading-snug whitespace-nowrap">
              {isAr ? 'إجمالي المركبات المبيعة' : 'Total Sold Vehicles'}
            </div>
            <div className="text-[24px] sm:text-[27px] font-black text-[#8F242C] tabular-nums leading-tight mt-0.5">
              {metrics.totalSold.toLocaleString('en-US')}
            </div>
          </div>
          <CarSoldIcon className="w-11 h-10 sm:w-12 sm:h-11 shrink-0" />
        </div>

        {/* Card 4: Total Unsold Vehicles */}
        <div className="bg-white border border-[#BCC8D6] rounded-[14px] px-3 py-2 shadow-[0_2px_5px_rgba(18,59,112,0.06)] flex items-center justify-between">
          <div className="flex-1 text-center">
            <div className="text-[12.5px] sm:text-[13.5px] font-extrabold text-[#0F294A] leading-snug whitespace-nowrap">
              {isAr ? 'إجمالي المركبات غير المبيعة' : 'Total Unsold Vehicles'}
            </div>
            <div className="text-[24px] sm:text-[27px] font-black text-[#8F242C] tabular-nums leading-tight mt-0.5">
              {metrics.totalUnsold.toLocaleString('en-US')}
            </div>
          </div>
          <CarUnsoldIcon className="w-11 h-10 sm:w-12 sm:h-11 shrink-0" />
        </div>

        {/* Card 5: Overall Sale Rate */}
        <div className="bg-white border border-[#BCC8D6] rounded-[14px] px-3 py-2 shadow-[0_2px_5px_rgba(18,59,112,0.06)] flex items-center justify-between">
          <div className="flex-1 text-center">
            <div className="text-[12.5px] sm:text-[13.5px] font-extrabold text-[#0F294A] leading-snug whitespace-nowrap">
              {isAr ? 'نسبة البيع الإجمالية' : 'Overall Sale Rate'}
            </div>
            <div className="text-[24px] sm:text-[27px] font-black text-[#16843A] tabular-nums leading-tight mt-0.5">
              {metrics.overallSaleRate.toFixed(1)}%
            </div>
          </div>
          <PieChartKpiIcon className="w-9 h-9 sm:w-10 sm:h-10 shrink-0" />
        </div>

        {/* Card 6: Unsold Rate */}
        <div className="bg-white border border-[#BCC8D6] rounded-[14px] px-3 py-2 shadow-[0_2px_5px_rgba(18,59,112,0.06)] flex items-center justify-between">
          <div className="flex-1 text-center">
            <div className="text-[12.5px] sm:text-[13.5px] font-extrabold text-[#0F294A] leading-snug whitespace-nowrap">
              {isAr ? 'نسبة عدم البيع' : 'Unsold Rate'}
            </div>
            <div className="text-[24px] sm:text-[27px] font-black text-[#8F242C] tabular-nums leading-tight mt-0.5">
              {metrics.overallUnsoldRate.toFixed(1)}%
            </div>
          </div>
          <PieChartKpiIcon className="w-9 h-9 sm:w-10 sm:h-10 shrink-0" />
        </div>
      </div>

      {/* OPTIONAL INTERACTIVE SEARCH & QUICK ACTION BAR (Hidden in Pixel-Perfect Mode & Print) */}
      {!pixelPerfectMode && (
        <div className="no-print mb-2.5 flex flex-wrap items-center justify-between gap-2 bg-white/90 border border-[#CBD5E1] rounded-xl px-3 py-1.5">
          <div className="flex items-center gap-2 flex-1 min-w-[220px]">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  isAr
                    ? `بحث في مزادات شهر ${currentMonthLabel} ${selectedPeriod.year}...`
                    : `Search auctions in ${currentMonthLabel} ${selectedPeriod.year}...`
                }
                className="w-full ps-9 pe-3 py-1 text-xs font-semibold bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg focus:outline-none focus:border-[#165B9D]"
              />
            </div>
            <span className="text-[11px] font-semibold text-slate-500 hidden sm:inline">
              {isAr
                ? 'تلميح: انقر مرتين على أي صف للتعديل السريع المباشر'
                : 'Tip: Double-click any row for quick inline editing'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenAddModal}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-white bg-[#16843A] hover:bg-[#126E30] rounded-lg shadow-2xs transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>
                {isAr
                  ? `إضافة مزاد جديد (${currentMonthLabel} ${selectedPeriod.year})`
                  : `Add Auction (${currentMonthLabel} ${selectedPeriod.year})`}
              </span>
            </button>
          </div>
        </div>
      )}

      {inlineError && (
        <div className="no-print mb-2 px-3 py-1.5 bg-red-50 border border-red-300 rounded-lg text-xs font-bold text-red-700 flex items-center justify-between">
          <span>{inlineError}</span>
          <button
            type="button"
            onClick={() => setInlineError(null)}
            className="text-red-500 hover:text-red-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3. MAIN AUCTION DATA TABLE */}
      <div className="w-full overflow-x-auto rounded-[10px] border border-[#8FA3B8] shadow-xs bg-white">
        <table className="w-full border-collapse text-right min-w-[980px]">
          <thead>
            <tr
              style={{
                background:
                  'linear-gradient(180deg, #165B9D 0%, #123B70 65%, #0E315E 100%)',
              }}
              className="text-white text-[13px] sm:text-[14px] font-extrabold select-none"
            >
              {/* 1. م */}
              <th
                onClick={() => handleSort('index')}
                className="py-2 px-2 border border-[#4978A8] text-center w-[3.8%] cursor-pointer hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>{isAr ? 'م' : '#'}</span>
                </div>
              </th>

              {/* 2. رقم المزاد */}
              <th
                onClick={() => handleSort('auctionNumber')}
                className="py-2 px-2.5 border border-[#4978A8] text-center w-[9%] cursor-pointer hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                  <span>{isAr ? 'رقم المزاد' : 'Auction No.'}</span>
                  <Gavel className="w-4 h-4 text-white/90 shrink-0" />
                </div>
              </th>

              {/* 3. مدة عرض المزاد */}
              <th className="py-2 px-2.5 border border-[#4978A8] text-center w-[11%]">
                <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                  <span>{isAr ? 'مدة عرض المزاد' : 'Auction Duration'}</span>
                  <Calendar className="w-4 h-4 text-white/90 shrink-0" />
                </div>
              </th>

              {/* 4. عدد المركبات المدرجة */}
              <th
                onClick={() => handleSort('listedVehicles')}
                className="py-1.5 px-2 border border-[#4978A8] text-center w-[9%] cursor-pointer hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <div className="leading-tight">
                    <div>{isAr ? 'عدد المركبات' : 'Listed'}</div>
                    <div>{isAr ? 'المدرجة' : 'Vehicles'}</div>
                  </div>
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white shrink-0">
                    <path
                      d="M5 11L6.5 6.5C7 5.5 8 5 9 5H15C16 5 17 5.5 17.5 6.5L19 11M5 11H19M5 11V17H7V19H9V17H15V19H17V17H19V11"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      fill="none"
                    />
                  </svg>
                </div>
              </th>

              {/* 5. عدد المركبات المبيعة */}
              <th
                onClick={() => handleSort('soldVehicles')}
                className="py-1.5 px-2 border border-[#4978A8] text-center w-[9%] cursor-pointer hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <div className="leading-tight">
                    <div>{isAr ? 'عدد المركبات' : 'Sold'}</div>
                    <div>{isAr ? 'المبيعة' : 'Vehicles'}</div>
                  </div>
                  <svg
                    viewBox="0 0 24 24"
                    className="w-5 h-5 text-white shrink-0"
                    fill="none"
                  >
                    <path
                      d="M4 12L5.5 7.5C6 6.5 7 6 8 6H14C15 6 16 6.5 16.5 7.5L18 12V17H4V12Z"
                      stroke="currentColor"
                      strokeWidth="1.7"
                    />
                    <circle
                      cx="18"
                      cy="17"
                      r="4.5"
                      fill="#16843A"
                      stroke="white"
                      strokeWidth="1.2"
                    />
                    <path
                      d="M16.2 17L17.5 18.3L20 15.8"
                      stroke="white"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </th>

              {/* 6. عدد المركبات غير المبيعة */}
              <th
                onClick={() => handleSort('unsoldVehicles')}
                className="py-1.5 px-2 border border-[#4978A8] text-center w-[9%] cursor-pointer hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <div className="leading-tight">
                    <div>{isAr ? 'عدد المركبات' : 'Unsold'}</div>
                    <div>{isAr ? 'غير المبيعة' : 'Vehicles'}</div>
                  </div>
                  <svg
                    viewBox="0 0 24 24"
                    className="w-5 h-5 text-white shrink-0"
                    fill="none"
                  >
                    <path
                      d="M4 12L5.5 7.5C6 6.5 7 6 8 6H14C15 6 16 6.5 16.5 7.5L18 12V17H4V12Z"
                      stroke="currentColor"
                      strokeWidth="1.7"
                    />
                    <circle
                      cx="18"
                      cy="17"
                      r="4.5"
                      fill="#D9383A"
                      stroke="white"
                      strokeWidth="1.2"
                    />
                    <path
                      d="M16.5 15.5L19.5 18.5M19.5 15.5L16.5 18.5"
                      stroke="white"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </th>

              {/* 7. الملاحظات */}
              <th className="py-2 px-3 border border-[#4978A8] text-center w-[16%]">
                <div className="flex items-center justify-center gap-1.5">
                  <span>{isAr ? 'الملاحظات' : 'Operational Notes'}</span>
                  <FileText className="w-4 h-4 text-white/90 shrink-0" />
                </div>
              </th>

              {/* 8. التحديات */}
              <th className="py-2 px-3 border border-[#4978A8] text-center w-[16%]">
                <div className="flex items-center justify-center gap-1.5">
                  <span>{isAr ? 'التحديات' : 'Challenges'}</span>
                  <AlertTriangle className="w-4 h-4 text-[#FACC15] shrink-0" />
                </div>
              </th>

              {/* 9. التوصيات */}
              <th className="py-2 px-3 border border-[#4978A8] text-center w-[17.2%]">
                <div className="flex items-center justify-center gap-1.5">
                  <span>{isAr ? 'التوصيات' : 'Recommendations'}</span>
                  <Lightbulb className="w-4 h-4 text-[#FDE047] shrink-0" />
                </div>
              </th>

              {/* Optional Management Column when not in Pixel-Perfect mode */}
              {!pixelPerfectMode && (
                <th className="no-print py-2 px-2 border border-[#4978A8] text-center w-[70px]">
                  <span className="text-xs">{isAr ? 'إجراء' : 'Actions'}</span>
                </th>
              )}
            </tr>
          </thead>

          <tbody className="text-[13.5px] sm:text-[14.5px] font-bold text-[#0F172A]">
            {auctions.length === 0 ? (
              <tr>
                <td
                  colSpan={pixelPerfectMode ? 9 : 10}
                  className="py-8 px-4 text-center bg-[#F8FAFC]"
                >
                  <div className="flex flex-col items-center justify-center gap-3">
                    <p className="text-base font-black text-[#123B70]">
                      {isAr
                        ? `لا توجد مزادات مسجلة لشهر ${monthNameAr} ${selectedPeriod.year}.`
                        : `No auctions recorded for ${monthNameEn} ${selectedPeriod.year}.`}
                    </p>
                    <button
                      type="button"
                      onClick={onOpenAddModal}
                      className="no-print inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-extrabold text-white bg-[#16843A] hover:bg-[#126E30] rounded-xl shadow-xs transition-colors cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>
                        {isAr
                          ? 'إضافة أول مزاد لهذا الشهر'
                          : 'Add First Auction for This Month'}
                      </span>
                    </button>
                  </div>
                </td>
              </tr>
            ) : filteredAuctions.length === 0 ? (
              <tr>
                <td
                  colSpan={pixelPerfectMode ? 9 : 10}
                  className="py-6 text-center text-slate-500 font-semibold"
                >
                  {isAr
                    ? 'لا توجد مزادات مطابقة للبحث الحالي.'
                    : 'No auction records match your current search.'}
                </td>
              </tr>
            ) : (
              filteredAuctions.map(({ item, originalIndex }, idx) => {
                const isEditing = inlineEditId === item.id && inlineDraft;
                const rowBg = idx % 2 === 0 ? 'bg-[#FFFFFF]' : 'bg-[#E9EFF7]';

                if (isEditing && inlineDraft) {
                  const previewUnsold = Math.max(
                    0,
                    (Number(inlineDraft.listedVehicles) || 0) -
                      (Number(inlineDraft.soldVehicles) || 0)
                  );
                  return (
                    <tr
                      key={item.id}
                      className="bg-amber-50/90 border-b border-[#B8C4D4] text-xs"
                    >
                      <td className="py-1.5 px-2 border border-[#B8C4D4] text-center font-black tabular-nums">
                        {originalIndex}
                      </td>
                      <td className="py-1.5 px-1.5 border border-[#B8C4D4] text-center">
                        <input
                          type="text"
                          value={inlineDraft.auctionNumber}
                          onChange={(e) =>
                            setInlineDraft({
                              ...inlineDraft,
                              auctionNumber: e.target.value.toUpperCase(),
                            })
                          }
                          className="w-full text-center font-mono font-bold bg-white border border-[#165B9D] rounded px-1 py-0.5"
                        />
                      </td>
                      <td className="py-1.5 px-1.5 border border-[#B8C4D4] text-center">
                        <input
                          type="text"
                          value={isAr ? inlineDraft.durationAr : inlineDraft.durationEn}
                          onChange={(e) =>
                            setInlineDraft({
                              ...inlineDraft,
                              [isAr ? 'durationAr' : 'durationEn']: e.target.value,
                            })
                          }
                          className="w-full text-center bg-white border border-[#165B9D] rounded px-1 py-0.5"
                        />
                      </td>
                      <td className="py-1.5 px-1.5 border border-[#B8C4D4] text-center">
                        <input
                          type="number"
                          min={1}
                          value={inlineDraft.listedVehicles}
                          onChange={(e) =>
                            setInlineDraft({
                              ...inlineDraft,
                              listedVehicles: Number(e.target.value),
                            })
                          }
                          className="w-20 text-center font-mono font-bold bg-white border border-[#165B9D] rounded px-1 py-0.5"
                        />
                      </td>
                      <td className="py-1.5 px-1.5 border border-[#B8C4D4] text-center">
                        <input
                          type="number"
                          min={0}
                          max={inlineDraft.listedVehicles}
                          value={inlineDraft.soldVehicles}
                          onChange={(e) =>
                            setInlineDraft({
                              ...inlineDraft,
                              soldVehicles: Number(e.target.value),
                            })
                          }
                          className="w-20 text-center font-mono font-bold bg-white border border-[#165B9D] rounded px-1 py-0.5"
                        />
                      </td>
                      <td className="py-1.5 px-2 border border-[#B8C4D4] text-center font-mono font-extrabold text-[#123B70]">
                        {previewUnsold}
                      </td>
                      <td className="py-1.5 px-1.5 border border-[#B8C4D4]">
                        <input
                          type="text"
                          value={isAr ? inlineDraft.notesAr : inlineDraft.notesEn}
                          onChange={(e) =>
                            setInlineDraft({
                              ...inlineDraft,
                              [isAr ? 'notesAr' : 'notesEn']: e.target.value,
                            })
                          }
                          className="w-full bg-white border border-[#165B9D] rounded px-1.5 py-0.5"
                        />
                      </td>
                      <td className="py-1.5 px-1.5 border border-[#B8C4D4]">
                        <input
                          type="text"
                          value={
                            isAr ? inlineDraft.challengesAr : inlineDraft.challengesEn
                          }
                          onChange={(e) =>
                            setInlineDraft({
                              ...inlineDraft,
                              [isAr ? 'challengesAr' : 'challengesEn']: e.target.value,
                            })
                          }
                          className="w-full bg-white border border-[#165B9D] rounded px-1.5 py-0.5"
                        />
                      </td>
                      <td className="py-1.5 px-1.5 border border-[#B8C4D4]">
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={
                              isAr
                                ? inlineDraft.recommendationsAr
                                : inlineDraft.recommendationsEn
                            }
                            onChange={(e) =>
                              setInlineDraft({
                                ...inlineDraft,
                                [isAr ? 'recommendationsAr' : 'recommendationsEn']:
                                  e.target.value,
                              })
                            }
                            className="w-full bg-white border border-[#165B9D] rounded px-1.5 py-0.5"
                          />
                          {pixelPerfectMode && (
                            <>
                              <button
                                type="button"
                                onClick={saveInlineEdit}
                                className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={cancelInlineEdit}
                                className="p-1 bg-slate-400 text-white rounded hover:bg-slate-500"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                      {!pixelPerfectMode && (
                        <td className="no-print py-1.5 px-1.5 border border-[#B8C4D4] text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={saveInlineEdit}
                              title={isAr ? 'حفظ' : 'Save'}
                              className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={cancelInlineEdit}
                              title={isAr ? 'إلغاء' : 'Cancel'}
                              className="p-1 bg-slate-400 text-white rounded hover:bg-slate-500 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                }

                return (
                  <tr
                    key={item.id}
                    onDoubleClick={() => startInlineEdit(item)}
                    className={`${rowBg} hover:bg-[#DCE7F5] transition-colors border-b border-[#B8C4D4]`}
                  >
                    <td className="py-1.5 px-2 border border-[#B8C4D4] text-center font-black tabular-nums text-[#0F172A]">
                      {originalIndex}
                    </td>
                    <td className="py-1.5 px-2.5 border border-[#B8C4D4] text-center font-extrabold font-en tabular-nums text-[#0F172A]">
                      {item.auctionNumber}
                    </td>
                    <td className="py-1.5 px-2.5 border border-[#B8C4D4] text-center font-bold text-[#0F172A] whitespace-nowrap">
                      {isAr ? item.durationAr : item.durationEn}
                    </td>
                    <td className="py-1.5 px-2 border border-[#B8C4D4] text-center font-extrabold tabular-nums text-[15px] text-[#0F172A]">
                      {item.listedVehicles.toLocaleString('en-US')}
                    </td>
                    <td className="py-1.5 px-2 border border-[#B8C4D4] text-center font-extrabold tabular-nums text-[15px] text-[#0F172A]">
                      {item.soldVehicles.toLocaleString('en-US')}
                    </td>
                    <td className="py-1.5 px-2 border border-[#B8C4D4] text-center font-extrabold tabular-nums text-[15px] text-[#0F172A]">
                      {item.unsoldVehicles.toLocaleString('en-US')}
                    </td>
                    <td className="py-1.5 px-3 border border-[#B8C4D4] text-center font-bold text-[#0F172A]">
                      {isAr ? item.notesAr : item.notesEn}
                    </td>
                    <td className="py-1.5 px-3 border border-[#B8C4D4] text-center font-bold text-[#0F172A]">
                      {isAr ? item.challengesAr : item.challengesEn}
                    </td>
                    <td className="py-1.5 px-3 border border-[#B8C4D4] text-center font-bold text-[#0F172A]">
                      {isAr ? item.recommendationsAr : item.recommendationsEn}
                    </td>
                    {!pixelPerfectMode && (
                      <td className="no-print py-1 px-1.5 border border-[#B8C4D4] text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => onOpenEditModal(item)}
                            title={isAr ? 'تعديل المزاد' : 'Edit Auction'}
                            className="p-1 text-[#165B9D] hover:bg-blue-100 rounded transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteAuction(item)}
                            title={isAr ? 'حذف المزاد' : 'Delete Auction'}
                            className="p-1 text-[#B4232C] hover:bg-red-100 rounded transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>

          {/* TOTALS FOOTER ROW (Gold + Corporate Navy exactly matching Reference) */}
          <tfoot>
            <tr className="text-[15px] sm:text-[16px] font-black select-none">
              <td
                colSpan={3}
                style={{
                  background:
                    'linear-gradient(180deg, #164C88 0%, #0F3462 100%)',
                }}
                className="py-2 px-4 border border-[#3B6998] text-white text-center"
              >
                <div className="flex items-center justify-center gap-2">
                  <span>{isAr ? 'الإجمالي' : 'Total'}</span>
                  <Calculator className="w-4 h-4 text-white/90" />
                </div>
              </td>
              <td
                style={{
                  background:
                    'linear-gradient(180deg, #E8CA7D 0%, #D5A03D 100%)',
                }}
                className="py-2 px-2 border border-[#B88828] text-center text-[#0F172A] tabular-nums text-[17px]"
              >
                {metrics.totalListed.toLocaleString('en-US')}
              </td>
              <td
                style={{
                  background:
                    'linear-gradient(180deg, #E8CA7D 0%, #D5A03D 100%)',
                }}
                className="py-2 px-2 border border-[#B88828] text-center text-[#0F172A] tabular-nums text-[17px]"
              >
                {metrics.totalSold.toLocaleString('en-US')}
              </td>
              <td
                style={{
                  background:
                    'linear-gradient(180deg, #E8CA7D 0%, #D5A03D 100%)',
                }}
                className="py-2 px-2 border border-[#B88828] text-center text-[#0F172A] tabular-nums text-[17px]"
              >
                {metrics.totalUnsold.toLocaleString('en-US')}
              </td>
              <td
                style={{
                  background:
                    'linear-gradient(180deg, #164C88 0%, #0F3462 100%)',
                }}
                className="py-2 px-3 border border-[#3B6998] text-center text-white"
              >
                —
              </td>
              <td
                style={{
                  background:
                    'linear-gradient(180deg, #164C88 0%, #0F3462 100%)',
                }}
                className="py-2 px-3 border border-[#3B6998] text-center text-white"
              >
                —
              </td>
              <td
                colSpan={pixelPerfectMode ? 1 : 2}
                style={{
                  background:
                    'linear-gradient(180deg, #164C88 0%, #0F3462 100%)',
                }}
                className="py-2 px-3 border border-[#3B6998] text-center text-white"
              >
                —
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 4. BOTTOM LEFT SHEET BADGE (Exact match to reference bottom-left corner) */}
      <div dir="ltr" className="mt-2 flex items-center justify-between">
        <button
          type="button"
          onClick={onSwitchToSheet2}
          title={
            isAr
              ? 'الشيت الأول : تقرير بيانات المزاد (انقر للتنقل)'
              : 'Sheet 1: Auction Data Report'
          }
          className="inline-flex items-center gap-0 rounded-full overflow-hidden shadow-xs cursor-pointer group"
        >
          <div className="bg-white p-0.5 flex items-center justify-center">
            <ExcelSheetIcon className="w-6 h-6" />
          </div>
          <div
            style={{
              background: 'linear-gradient(90deg, #0E2F5A 0%, #164E8A 100%)',
            }}
            className="text-white text-[12.5px] font-extrabold px-4 py-1 rounded-e-full group-hover:brightness-110 transition-all"
          >
            {isAr
              ? 'الشيت الأول : تقرير بيانات المزاد'
              : 'Sheet 1 : Auction Data Report'}
          </div>
        </button>

        {!pixelPerfectMode && (
          <div className="no-print flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>
              {isAr
                ? 'انقر على عناوين الأعمدة للفرز التلقائي'
                : 'Click column headers to sort'}
            </span>
          </div>
        )}
      </div>
    </section>
  );
};
