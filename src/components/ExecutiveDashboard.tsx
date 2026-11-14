import React, { useState } from 'react';
import {
  ClipboardList,
  ClipboardCheck,
  AlertTriangle,
  Lightbulb,
  SlidersHorizontal,
  Plus,
  PieChart,
  BarChart3,
  TrendingUp,
  Gavel,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  FileCheck2,
  CalendarDays,
  ArrowUpDown,
} from 'lucide-react';
import {
  AuctionRecord,
  ComputedAuctionMetrics,
  Language,
  PerformanceThresholds,
  ReportingPeriod,
} from '../types/auction';
import {
  evaluateAuctionPerformance,
  getMonthName,
} from '../services/storageService';
import {
  compareAuctionDates,
  formatAuctionDateDisplay,
} from '../utils/auctionDateUtils';
import {
  GoldenGavelIcon,
  NavyCarIcon,
  CarSoldIcon,
  CarUnsoldIcon,
  GoldenTargetIcon,
  AscendingBarsIcon,
  ExcelSheetIcon,
} from './CustomIcons';
import { ReportingPeriodBar } from './ReportingPeriodBar';

interface ExecutiveDashboardProps {
  auctions: AuctionRecord[];
  metrics: ComputedAuctionMetrics;
  thresholds: PerformanceThresholds;
  selectedPeriod: ReportingPeriod;
  yearsWithData: number[];
  countsByPeriodKey: Record<string, number>;
  showStandalonePeriodBar?: boolean;
  lang: Language;
  pixelPerfectMode: boolean;
  onSelectPeriod: (year: number, month: number) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onReturnToCurrentMonth: () => void;
  onOpenAddModal: () => void;
  onOpenThresholdModal: () => void;
  onSwitchToSheet1?: () => void;
  migrationState?: 'pending_approval' | 'completed';
  onOpenMigrationModal?: () => void;
}

export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({
  auctions,
  metrics,
  thresholds,
  selectedPeriod,
  yearsWithData,
  countsByPeriodKey,
  showStandalonePeriodBar = false,
  lang,
  pixelPerfectMode,
  onSelectPeriod,
  onPrevMonth,
  onNextMonth,
  onReturnToCurrentMonth,
  onOpenAddModal,
  onOpenThresholdModal,
  onSwitchToSheet1,
  migrationState,
  onOpenMigrationModal,
}) => {
  const isAr = lang === 'ar';
  const assetBase = import.meta.env.BASE_URL || './';
  const monthNameAr = getMonthName(selectedPeriod.month, 'ar');
  const monthNameEn = getMonthName(selectedPeriod.month, 'en');

  const [hoveredAuctionId, setHoveredAuctionId] = useState<string | null>(null);
  const [compDateSort, setCompDateSort] = useState<'none' | 'asc' | 'desc'>(
    'none'
  );

  // Sorted descending by saleRate for Horizontal Bar Chart (Card 4)
  const sortedBySaleRate = [...auctions].sort(
    (a, b) => b.saleRate - a.saleRate
  );

  // Comparative Table rows (supports optional chronological sort by auctionDate)
  const comparativeAuctions =
    compDateSort === 'none'
      ? auctions
      : [...auctions].sort((a, b) =>
          compareAuctionDates(a.auctionDate, b.auctionDate, compDateSort === 'asc')
        );

  // Dynamic Y-axis max for Clustered Bar Chart (Card 3 - minimum 350 to match reference)
  const maxListedValue = Math.max(
    300,
    ...auctions.map((a) => a.listedVehicles)
  );
  const yAxisMax = Math.max(350, Math.ceil((maxListedValue + 20) / 50) * 50);
  const yTicks = [
    0,
    Math.round(yAxisMax * (1 / 7)),
    Math.round(yAxisMax * (2 / 7)),
    Math.round(yAxisMax * (3 / 7)),
    Math.round(yAxisMax * (4 / 7)),
    Math.round(yAxisMax * (5 / 7)),
    Math.round(yAxisMax * (6 / 7)),
    yAxisMax,
  ];
  const standardTicks =
    yAxisMax === 350 ? [0, 50, 100, 150, 200, 250, 300, 350] : yTicks;

  // Doughnut Chart Geometry (Card 2)
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const hasVehicles = metrics.totalListed > 0;
  const soldFraction = hasVehicles
    ? Math.min(1, Math.max(0, metrics.overallSaleRate / 100))
    : 0;
  const unsoldFraction = hasVehicles ? Math.max(0, 1 - soldFraction) : 0;
  const soldStroke = soldFraction * circumference;
  const unsoldStroke = unsoldFraction * circumference;

  // Dynamic SVG width for Clustered Bar Chart when many auctions exist
  const barChartSvgWidth = Math.max(390, auctions.length * 76 + 50);

  return (
    <section
      id="sheet2-dashboard-container"
      dir={isAr ? 'rtl' : 'ltr'}
      className="print-sheet w-full bg-[#F4F7FB] rounded-[18px] border border-[#BCC8D6] shadow-[0_4px_20px_rgba(18,59,112,0.08)] overflow-hidden p-2.5 sm:p-3.5 transition-all"
    >
      {/* =====================================================================
          1. EXECUTIVE DASHBOARD HEADER BANNER (UNTOUCHED)
         ===================================================================== */}
      <div
        dir="ltr"
        className="relative w-full rounded-t-[14px] overflow-hidden bg-white border border-[#CBD5E1] shadow-xs"
      >
        <div className="flex flex-col lg:flex-row items-stretch w-full min-h-[96px]">
          {/* Left Panoramic Auction Yard & Gavel Photo */}
          <div className="relative lg:w-[40.5%] w-full h-[92px] sm:h-[96px] shrink-0 overflow-hidden bg-[#123B70]">
            <img
              src={`${assetBase}assets/header_bottom_photo.png`}
              alt="SAAED Executive Auction Yard"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-right select-none"
            />
          </div>

          {/* Center Corporate Blue Title Banner */}
          <div
            dir="rtl"
            className="relative flex-1 flex flex-col items-center justify-center px-3 py-2 text-center overflow-hidden"
            style={{
              background:
                'linear-gradient(180deg, #165B9D 0%, #123B70 62%, #0D2D56 100%)',
            }}
          >
            <h2 className="text-[20px] sm:text-[26px] font-black text-white leading-tight tracking-tight drop-shadow-xs">
              {isAr
                ? 'لوحة التحليل التنفيذي لأداء المزادات'
                : 'Executive Auction Performance Dashboard'}
            </h2>
            <p className="text-[13px] sm:text-[16px] font-bold text-white/95 font-en tracking-wide leading-tight mt-0.5">
              {isAr
                ? `Executive Auction Performance Dashboard — ${monthNameAr} ${selectedPeriod.year}`
                : `تقرير مزادات شهر ${monthNameAr} ${selectedPeriod.year}`}
            </p>

            {/* Diagonal Right Transition */}
            <svg
              viewBox="0 0 42 96"
              preserveAspectRatio="none"
              className="absolute right-0 top-0 h-full w-8 pointer-events-none"
            >
              <path d="M42 0 L0 96 L42 96 Z" fill="#FFFFFF" />
            </svg>
          </div>

          {/* Right Official SAAED Logo Box */}
          <div className="w-[165px] sm:w-[225px] bg-white flex items-center justify-center px-3 py-1.5 shrink-0">
            <img
              src={`${assetBase}assets/saaed_logo.png`}
              alt="SAAED Logo - ساعد"
              referrerPolicy="no-referrer"
              className="max-h-[74px] w-auto object-contain select-none"
            />
          </div>
        </div>
      </div>

      {/* Show ReportingPeriodBar here when viewing Sheet 2 standalone */}
      {showStandalonePeriodBar && (
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
      )}

      {/* =====================================================================
          2. SIX KPI CARDS ROW (UNTOUCHED)
         ===================================================================== */}
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

        {/* Card 5: Sale Success Rate */}
        <div className="bg-white border border-[#BCC8D6] rounded-[14px] px-3 py-2 shadow-[0_2px_5px_rgba(18,59,112,0.06)] flex items-center justify-between">
          <div className="flex-1 text-center">
            <div className="text-[12.5px] sm:text-[13.5px] font-extrabold text-[#0F294A] leading-snug whitespace-nowrap">
              {isAr ? 'نسبة نجاح البيع' : 'Sale Success Rate'}
            </div>
            <div className="text-[24px] sm:text-[27px] font-black text-[#16843A] tabular-nums leading-tight mt-0.5">
              {metrics.overallSaleRate.toFixed(1)}%
            </div>
          </div>
          <GoldenTargetIcon className="w-10 h-10 sm:w-11 sm:h-11 shrink-0" />
        </div>

        {/* Card 6: Average Sales Per Auction */}
        <div className="bg-white border border-[#BCC8D6] rounded-[14px] px-3 py-1.5 shadow-[0_2px_5px_rgba(18,59,112,0.06)] flex items-center justify-between">
          <div className="flex-1 text-center">
            <div className="text-[12px] sm:text-[13px] font-extrabold text-[#0F294A] leading-tight whitespace-nowrap">
              {isAr ? 'متوسط المبيعات لكل مزاد' : 'Avg Sold / Auction'}
            </div>
            <div className="text-[22px] sm:text-[24px] font-black text-[#0F294A] tabular-nums leading-none mt-0.5">
              {metrics.avgSoldPerAuction.toLocaleString('en-US')}
            </div>
            <div className="text-[11px] font-extrabold text-[#0F294A] leading-tight">
              {isAr ? 'مركبة / مزاد' : 'Vehicles / Auction'}
            </div>
          </div>
          <AscendingBarsIcon className="w-9 h-9 sm:w-10 sm:h-10 shrink-0" />
        </div>
      </div>

      {/* =====================================================================
          3. ROW 1 — QUANTITATIVE ANALYSIS (4 PREMIUM CARDS)
             Card 1: الملخص التنفيذي لنتائج المزادات
             Card 2: توزيع نتائج المزادات
             Card 3: مقارنة أداء المزادات
             Card 4: نسبة نجاح البيع حسب المزاد
         ===================================================================== */}
      <div
        dir="ltr"
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[23fr_23fr_27fr_27fr] gap-3.5 items-stretch"
      >
        {/* -------------------------------------------------------------------
            CARD 1: الملخص التنفيذي لنتائج المزادات (Executive Summary Card)
           ------------------------------------------------------------------- */}
        <div
          dir={isAr ? 'rtl' : 'ltr'}
          className="bg-white border border-[#D5DFEC] rounded-[16px] shadow-[0_4px_14px_rgba(18,59,112,0.06)] overflow-hidden flex flex-col justify-between"
        >
          <div>
            {/* Navy Gradient Header */}
            <div
              style={{
                background:
                  'linear-gradient(135deg, #175A9C 0%, #123B70 100%)',
              }}
              className="px-4 py-2.5 text-white flex items-center justify-between border-b border-[#0E2F5A]"
            >
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                  <ClipboardList className="w-4 h-4 text-[#D6A348]" />
                </span>
                <h3 className="text-[14px] sm:text-[14.5px] font-extrabold tracking-tight whitespace-nowrap">
                  {isAr
                    ? 'الملخص التنفيذي لنتائج المزادات'
                    : 'Executive Auction Summary'}
                </h3>
              </div>
              <span className="text-[11px] font-bold text-white/80 whitespace-nowrap">
                {monthNameAr} {selectedPeriod.year}
              </span>
            </div>

            {/* Structured Metrics List with Dividers */}
            <div className="px-4 py-2.5 divide-y divide-slate-100">
              <div className="py-1.5 flex items-center justify-between gap-2">
                <span className="text-[12.5px] font-bold text-[#64748B]">
                  {isAr ? 'عدد المزادات' : 'Total Auctions'}
                </span>
                <span className="text-[16px] font-black text-[#123B70] tabular-nums">
                  {metrics.totalAuctions.toLocaleString('en-US')}
                </span>
              </div>

              <div className="py-1.5 flex items-center justify-between gap-2">
                <span className="text-[12.5px] font-bold text-[#64748B]">
                  {isAr ? 'إجمالي المركبات المعروضة' : 'Total Listed Vehicles'}
                </span>
                <span className="text-[16px] font-black text-[#14243D] tabular-nums">
                  {metrics.totalListed.toLocaleString('en-US')}
                </span>
              </div>

              <div className="py-1.5 flex items-center justify-between gap-2">
                <span className="text-[12.5px] font-bold text-[#64748B]">
                  {isAr ? 'إجمالي المركبات المبيعة' : 'Total Sold Vehicles'}
                </span>
                <span className="text-[16px] font-black text-[#16843B] tabular-nums">
                  {metrics.totalSold.toLocaleString('en-US')}
                </span>
              </div>

              <div className="py-1.5 flex items-center justify-between gap-2">
                <span className="text-[12.5px] font-bold text-[#64748B]">
                  {isAr
                    ? 'إجمالي المركبات غير المبيعة'
                    : 'Total Unsold Vehicles'}
                </span>
                <span className="text-[16px] font-black text-[#C52B36] tabular-nums">
                  {metrics.totalUnsold.toLocaleString('en-US')}
                </span>
              </div>

              <div className="py-1.5 flex items-center justify-between gap-2">
                <span className="text-[12.5px] font-extrabold text-[#14243D]">
                  {isAr ? 'النسبة الإجمالية للبيع' : 'Overall Sale Rate'}
                </span>
                <span className="text-[17px] font-black text-[#16843B] tabular-nums">
                  {metrics.overallSaleRate.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* Highlighted Highest & Lowest Sale Auction Sub-Cards */}
          <div className="px-3.5 pb-3 pt-1 space-y-2">
            {metrics.highestSaleAuction ? (
              <div className="bg-[#ECFDF3] border border-[#ABEFC6] rounded-[11px] px-3 py-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-6 h-6 rounded-md bg-[#16843B] text-white flex items-center justify-center shrink-0">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </span>
                  <span className="text-[12px] font-extrabold text-[#14243D] whitespace-nowrap">
                    {isAr ? 'أعلى نسبة بيع' : 'Highest Sale'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="auction-id font-en text-[12px] font-black px-2 py-0.5 rounded-md bg-white text-[#123B70] border border-[#86EFAC] shadow-2xs">
                    {metrics.highestSaleAuction.auctionNumber}
                  </span>
                  <span
                    dir="ltr"
                    className="text-[13px] font-black text-[#16843B] tabular-nums whitespace-nowrap"
                  >
                    {metrics.highestSaleAuction.saleRate.toFixed(1)}%
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-[11px] px-3 py-2 text-center text-[11.5px] font-bold text-[#64748B]">
                {isAr
                  ? `لا توجد بيانات لشهر ${monthNameAr} ${selectedPeriod.year}`
                  : `No data for ${monthNameEn} ${selectedPeriod.year}`}
              </div>
            )}

            {metrics.lowestSaleAuction && (
              <div className="bg-[#FEF3F2] border border-[#FECDCA] rounded-[11px] px-3 py-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-6 h-6 rounded-md bg-[#C52B36] text-white flex items-center justify-center shrink-0">
                    <ArrowDownRight className="w-3.5 h-3.5" />
                  </span>
                  <span className="text-[12px] font-extrabold text-[#14243D] whitespace-nowrap">
                    {isAr ? 'أقل نسبة بيع' : 'Lowest Sale'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="auction-id font-en text-[12px] font-black px-2 py-0.5 rounded-md bg-white text-[#123B70] border border-[#FCA5A5] shadow-2xs">
                    {metrics.lowestSaleAuction.auctionNumber}
                  </span>
                  <span
                    dir="ltr"
                    className="text-[13px] font-black text-[#C52B36] tabular-nums whitespace-nowrap"
                  >
                    {metrics.lowestSaleAuction.saleRate.toFixed(1)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* -------------------------------------------------------------------
            CARD 2: توزيع نتائج المزادات (Doughnut Chart Card)
           ------------------------------------------------------------------- */}
        <div
          dir={isAr ? 'rtl' : 'ltr'}
          className="bg-white border border-[#D5DFEC] rounded-[16px] shadow-[0_4px_14px_rgba(18,59,112,0.06)] overflow-hidden flex flex-col justify-between"
        >
          {/* Header */}
          <div
            style={{
              background: 'linear-gradient(135deg, #175A9C 0%, #123B70 100%)',
            }}
            className="px-4 py-2.5 text-white flex items-center justify-between border-b border-[#0E2F5A]"
          >
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                <PieChart className="w-4 h-4 text-[#D6A348]" />
              </span>
              <h3 className="text-[14px] sm:text-[14.5px] font-extrabold tracking-tight whitespace-nowrap">
                {isAr ? 'توزيع نتائج المزادات' : 'Auction Results Distribution'}
              </h3>
            </div>
          </div>

          {/* Doughnut Chart & Legend */}
          <div
            dir="ltr"
            className="flex items-center justify-around gap-3 px-3.5 py-3 my-auto"
          >
            {/* Balanced Doughnut SVG with spacious viewBox so nothing ever clips */}
            <div className="relative w-[144px] h-[144px] shrink-0 flex items-center justify-center">
              <svg viewBox="0 0 140 140" className="w-full h-full">
                {!hasVehicles ? (
                  <circle
                    cx="70"
                    cy="70"
                    r={radius}
                    fill="transparent"
                    stroke="#E2E8F0"
                    strokeWidth="24"
                  />
                ) : (
                  <>
                    {/* Sold Arc (Executive Blue #175A9C) */}
                    <circle
                      cx="70"
                      cy="70"
                      r={radius}
                      fill="transparent"
                      stroke="#175A9C"
                      strokeWidth="24"
                      strokeDasharray={`${soldStroke} ${circumference}`}
                      transform="rotate(-90 70 70)"
                    />
                    {/* Unsold Arc (Danger Red #C52B36) */}
                    <circle
                      cx="70"
                      cy="70"
                      r={radius}
                      fill="transparent"
                      stroke="#C52B36"
                      strokeWidth="24"
                      strokeDasharray={`${unsoldStroke} ${circumference}`}
                      strokeDashoffset={-soldStroke}
                      transform="rotate(-90 70 70)"
                    />
                    {/* Percentage Labels inside ring */}
                    {metrics.overallUnsoldRate >= 8 && (
                      <text
                        x="45"
                        y="29"
                        textAnchor="middle"
                        fill="#FFFFFF"
                        fontSize="10"
                        fontWeight="800"
                        className="font-en"
                      >
                        {metrics.overallUnsoldRate.toFixed(1)}%
                      </text>
                    )}
                    {metrics.overallSaleRate >= 20 && (
                      <text
                        x="78"
                        y="122"
                        textAnchor="middle"
                        fill="#FFFFFF"
                        fontSize="10.5"
                        fontWeight="800"
                        className="font-en"
                      >
                        {metrics.overallSaleRate.toFixed(1)}%
                      </text>
                    )}
                  </>
                )}
              </svg>
              {/* Center Hole Total Vehicles */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                <span className="text-[19px] font-black text-[#14243D] tabular-nums leading-none">
                  {metrics.totalListed.toLocaleString('en-US')}
                </span>
                <span className="text-[12px] font-extrabold text-[#64748B] mt-1">
                  {isAr ? 'مركبة مدرجة' : 'Vehicles'}
                </span>
              </div>
            </div>

            {/* Structured Legend */}
            <div dir={isAr ? 'rtl' : 'ltr'} className="space-y-3 flex-1 min-w-0">
              <div className="p-2 rounded-xl bg-[#F4F7FB] border border-[#E2E8F0]">
                <div className="flex items-center gap-1.5 text-[12px] font-extrabold text-[#14243D]">
                  <span className="w-3 h-3 rounded-[3px] bg-[#175A9C] shrink-0" />
                  <span className="truncate">
                    {isAr ? 'المركبات المبيعة' : 'Sold Vehicles'}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-1 mt-1 ps-4">
                  <span className="text-[15px] font-black tabular-nums text-[#14243D]">
                    {metrics.totalSold.toLocaleString('en-US')}
                  </span>
                  <span
                    dir="ltr"
                    className="text-[12px] font-black tabular-nums text-[#175A9C]"
                  >
                    ({metrics.overallSaleRate.toFixed(1)}%)
                  </span>
                </div>
              </div>

              <div className="p-2 rounded-xl bg-[#FEF3F2]/70 border border-[#FECDCA]">
                <div className="flex items-center gap-1.5 text-[12px] font-extrabold text-[#14243D]">
                  <span className="w-3 h-3 rounded-[3px] bg-[#C52B36] shrink-0" />
                  <span className="truncate">
                    {isAr ? 'المركبات غير المبيعة' : 'Unsold Vehicles'}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-1 mt-1 ps-4">
                  <span className="text-[15px] font-black tabular-nums text-[#C52B36]">
                    {metrics.totalUnsold.toLocaleString('en-US')}
                  </span>
                  <span
                    dir="ltr"
                    className="text-[12px] font-black tabular-nums text-[#C52B36]"
                  >
                    ({metrics.overallUnsoldRate.toFixed(1)}%)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Overall Sale Rate Progress Strip */}
          <div className="px-4 pb-3 pt-1.5 border-t border-slate-100 bg-[#F8FAFC]">
            <div className="flex items-center justify-between text-[11.5px] font-extrabold mb-1">
              <span className="text-[#64748B]">
                {isAr ? 'مؤشر نسبة البيع الإجمالية' : 'Overall Sale Rate Index'}
              </span>
              <span
                dir="ltr"
                className="text-[#16843B] font-black tabular-nums"
              >
                {metrics.overallSaleRate.toFixed(1)}%
              </span>
            </div>
            <div
              dir="ltr"
              className="w-full h-2.5 bg-[#E2E8F0] rounded-full overflow-hidden flex"
            >
              <div
                style={{ width: `${Math.min(100, metrics.overallSaleRate)}%` }}
                className="h-full bg-gradient-to-r from-[#175A9C] to-[#16843B] transition-all duration-300"
              />
              <div
                style={{
                  width: `${Math.min(100, metrics.overallUnsoldRate)}%`,
                }}
                className="h-full bg-[#C52B36] transition-all duration-300"
              />
            </div>
          </div>
        </div>

        {/* -------------------------------------------------------------------
            CARD 3: مقارنة أداء المزادات (Clustered Bar Chart Card)
           ------------------------------------------------------------------- */}
        <div
          dir={isAr ? 'rtl' : 'ltr'}
          className="bg-white border border-[#D5DFEC] rounded-[16px] shadow-[0_4px_14px_rgba(18,59,112,0.06)] overflow-hidden flex flex-col justify-between"
        >
          {/* Header */}
          <div
            style={{
              background: 'linear-gradient(135deg, #175A9C 0%, #123B70 100%)',
            }}
            className="px-4 py-2.5 text-white flex items-center justify-between border-b border-[#0E2F5A]"
          >
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                <BarChart3 className="w-4 h-4 text-[#D6A348]" />
              </span>
              <h3 className="text-[14px] sm:text-[14.5px] font-extrabold tracking-tight whitespace-nowrap">
                {isAr ? 'مقارنة أداء المزادات' : 'Auction Performance Comparison'}
              </h3>
            </div>
          </div>

          {/* Clustered Column Chart Body */}
          <div
            dir="ltr"
            className="w-full flex-1 flex flex-col justify-center px-3 pt-3 pb-1 overflow-x-auto"
          >
            <svg
              viewBox={`0 0 ${barChartSvgWidth} 165`}
              className="w-full h-auto min-w-[340px] overflow-visible"
            >
              <defs>
                <linearGradient id="barNavyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2467B2" />
                  <stop offset="100%" stopColor="#123B70" />
                </linearGradient>
                <linearGradient id="barGreenGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22A04B" />
                  <stop offset="100%" stopColor="#16843B" />
                </linearGradient>
                <linearGradient id="barRedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#E03E49" />
                  <stop offset="100%" stopColor="#C52B36" />
                </linearGradient>
              </defs>

              {/* Horizontal Grid Lines & Y-Axis Labels */}
              {standardTicks.map((tick) => {
                const y = 134 - (tick / yAxisMax) * 116;
                return (
                  <g key={tick}>
                    <line
                      x1="36"
                      y1={y}
                      x2={barChartSvgWidth - 10}
                      y2={y}
                      stroke="#E2E8F0"
                      strokeDasharray={tick === 0 ? undefined : '3 3'}
                      strokeWidth="1"
                    />
                    <text
                      x="30"
                      y={y + 3.5}
                      textAnchor="end"
                      fill="#64748B"
                      fontSize="10"
                      fontWeight="700"
                      className="font-en tabular-nums"
                    >
                      {tick}
                    </text>
                  </g>
                );
              })}

              {auctions.length === 0 ? (
                <text
                  x={barChartSvgWidth / 2}
                  y="80"
                  textAnchor="middle"
                  fill="#64748B"
                  fontSize="12"
                  fontWeight="800"
                >
                  {isAr
                    ? `لا توجد مزادات مسجلة لشهر ${monthNameAr} ${selectedPeriod.year}`
                    : `No auctions recorded for ${monthNameEn} ${selectedPeriod.year}`}
                </text>
              ) : (
                auctions.map((auc, i) => {
                  const count = Math.max(1, auctions.length);
                  const usableWidth = barChartSvgWidth - 48;
                  const slotWidth = usableWidth / count;
                  const groupCenter = 38 + slotWidth * i + slotWidth / 2;
                  const barWidth = Math.min(14, Math.max(8, slotWidth * 0.22));

                  const listedH = (auc.listedVehicles / yAxisMax) * 116;
                  const soldH = (auc.soldVehicles / yAxisMax) * 116;
                  const unsoldH = (auc.unsoldVehicles / yAxisMax) * 116;
                  const isHovered = hoveredAuctionId === auc.id;

                  return (
                    <g
                      key={auc.id}
                      onMouseEnter={() => setHoveredAuctionId(auc.id)}
                      onMouseLeave={() => setHoveredAuctionId(null)}
                      className="cursor-pointer"
                    >
                      {/* Hover highlight column background */}
                      {isHovered && (
                        <rect
                          x={groupCenter - barWidth * 2}
                          y="14"
                          width={barWidth * 4}
                          height="120"
                          fill="#F1F5F9"
                          rx="4"
                        />
                      )}

                      {/* Listed Bar (Navy Gradient) */}
                      <rect
                        x={groupCenter - barWidth * 1.5 - 2}
                        y={134 - listedH}
                        width={barWidth}
                        height={Math.max(1.5, listedH)}
                        fill="url(#barNavyGrad)"
                        rx="2.5"
                      >
                        <title>{`${auc.auctionNumber} — ${
                          isAr ? 'المركبات المدرجة' : 'Listed'
                        }: ${auc.listedVehicles}`}</title>
                      </rect>

                      {/* Sold Bar (Green Gradient) */}
                      <rect
                        x={groupCenter - barWidth * 0.5}
                        y={134 - soldH}
                        width={barWidth}
                        height={Math.max(1.5, soldH)}
                        fill="url(#barGreenGrad)"
                        rx="2.5"
                      >
                        <title>{`${auc.auctionNumber} — ${
                          isAr ? 'المركبات المبيعة' : 'Sold'
                        }: ${auc.soldVehicles} (${auc.saleRate.toFixed(1)}%)`}</title>
                      </rect>

                      {/* Unsold Bar (Red Gradient) */}
                      <rect
                        x={groupCenter + barWidth * 0.5 + 2}
                        y={134 - unsoldH}
                        width={barWidth}
                        height={Math.max(1.5, unsoldH)}
                        fill="url(#barRedGrad)"
                        rx="2.5"
                      >
                        <title>{`${auc.auctionNumber} — ${
                          isAr ? 'المركبات غير المبيعة' : 'Unsold'
                        }: ${auc.unsoldVehicles} (${auc.unsoldRate.toFixed(1)}%)`}</title>
                      </rect>

                      {/* X-Axis Auction Code (Always single-line) */}
                      <text
                        x={groupCenter}
                        y="151"
                        textAnchor="middle"
                        fill="#14243D"
                        fontSize="10"
                        fontWeight="800"
                        className="font-en"
                      >
                        {auc.auctionNumber}
                      </text>

                      {/* Interactive SVG Tooltip on Hover */}
                      {isHovered && (
                        <g
                          transform={`translate(${Math.min(
                            barChartSvgWidth - 115,
                            Math.max(40, groupCenter - 52)
                          )}, 6)`}
                        >
                          <rect
                            x="0"
                            y="0"
                            width="104"
                            height="40"
                            rx="6"
                            fill="#14243D"
                            opacity="0.95"
                          />
                          <text
                            x="52"
                            y="13"
                            textAnchor="middle"
                            fill="#D6A348"
                            fontSize="9.5"
                            fontWeight="800"
                            className="font-en"
                          >
                            {auc.auctionNumber} ({auc.saleRate.toFixed(1)}%)
                          </text>
                          <text
                            x="52"
                            y="25"
                            textAnchor="middle"
                            fill="#FFFFFF"
                            fontSize="8.5"
                            fontWeight="700"
                            className="font-en"
                          >
                            {`Listed: ${auc.listedVehicles} | Sold: ${auc.soldVehicles}`}
                          </text>
                          <text
                            x="52"
                            y="35"
                            textAnchor="middle"
                            fill="#FCA5A5"
                            fontSize="8.5"
                            fontWeight="700"
                            className="font-en"
                          >
                            {`Unsold: ${auc.unsoldVehicles}`}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })
              )}

              {/* Baseline */}
              <line
                x1="36"
                y1="134"
                x2={barChartSvgWidth - 10}
                y2="134"
                stroke="#94A3B8"
                strokeWidth="1.2"
              />
            </svg>
          </div>

          {/* Bottom Legend */}
          <div
            dir={isAr ? 'rtl' : 'ltr'}
            className="px-3 py-2 border-t border-slate-100 bg-[#F8FAFC] flex items-center justify-center gap-4 text-[11.5px] font-extrabold text-[#14243D]"
          >
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-[3px] bg-[#123B70]" />
              <span>{isAr ? 'المركبات المدرجة' : 'Listed'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-[3px] bg-[#16843B]" />
              <span>{isAr ? 'المركبات المبيعة' : 'Sold'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-[3px] bg-[#C52B36]" />
              <span>{isAr ? 'غير المبيعة' : 'Unsold'}</span>
            </div>
          </div>
        </div>

        {/* -------------------------------------------------------------------
            CARD 4: نسبة نجاح البيع حسب المزاد (Horizontal Bar Chart Card)
           ------------------------------------------------------------------- */}
        <div
          dir={isAr ? 'rtl' : 'ltr'}
          className="bg-white border border-[#D5DFEC] rounded-[16px] shadow-[0_4px_14px_rgba(18,59,112,0.06)] overflow-hidden flex flex-col justify-between"
        >
          {/* Header */}
          <div
            style={{
              background: 'linear-gradient(135deg, #175A9C 0%, #123B70 100%)',
            }}
            className="px-4 py-2.5 text-white flex items-center justify-between border-b border-[#0E2F5A]"
          >
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4 text-[#D6A348]" />
              </span>
              <h3 className="text-[14px] sm:text-[14.5px] font-extrabold tracking-tight whitespace-nowrap">
                {isAr
                  ? 'نسبة نجاح البيع حسب المزاد'
                  : 'Sale Success Rate by Auction'}
              </h3>
            </div>
          </div>

          {/* Horizontal Bars Container (LTR orientation for bars, zero line-break on AUC-001) */}
          <div
            dir="ltr"
            className="flex-1 flex flex-col justify-center space-y-2.5 px-3.5 py-3 max-h-[220px] overflow-y-auto"
          >
            {sortedBySaleRate.length === 0 ? (
              <div className="text-center text-xs font-bold text-[#64748B] py-6">
                {isAr
                  ? `لا توجد مزادات مسجلة لشهر ${monthNameAr} ${selectedPeriod.year}`
                  : `No auctions recorded for ${monthNameEn} ${selectedPeriod.year}`}
              </div>
            ) : (
              sortedBySaleRate.map((auc, idx) => {
                const barGradients = [
                  'linear-gradient(90deg, #16843B 0%, #22A04B 100%)',
                  'linear-gradient(90deg, #198D3F 0%, #29A852 100%)',
                  'linear-gradient(90deg, #1E9645 0%, #34B25D 100%)',
                  'linear-gradient(90deg, #2D9F4E 0%, #48BC69 100%)',
                  'linear-gradient(90deg, #3DA858 0%, #5CC476 100%)',
                ];
                const barBg =
                  barGradients[Math.min(idx, barGradients.length - 1)];

                return (
                  <div
                    key={auc.id}
                    className="flex items-center gap-2.5 text-[12px] font-extrabold"
                  >
                    {/* Unbreakable Single-Line Auction Code */}
                    <span className="auction-id w-[66px] justify-end font-en font-black text-[#14243D] text-[12px] shrink-0">
                      {auc.auctionNumber}
                    </span>

                    {/* Bar Track */}
                    <div className="flex-1 h-[18px] bg-[#F1F5F9] rounded-md relative flex items-center overflow-hidden border border-slate-200/70">
                      <div
                        style={{
                          width: `${Math.min(100, Math.max(4, auc.saleRate))}%`,
                          background: barBg,
                        }}
                        className="h-full rounded-e-md transition-all duration-300"
                      />
                    </div>

                    {/* Percentage Value Beside Bar */}
                    <span className="auction-id w-[46px] justify-start font-en text-[12px] font-black tabular-nums text-[#16843B] shrink-0">
                      {auc.saleRate.toFixed(1)}%
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* Horizontal Axis Scale 0% .. 100% */}
          <div
            dir="ltr"
            className="ps-[78px] pe-[58px] py-2 border-t border-slate-100 bg-[#F8FAFC] flex items-center justify-between text-[10.5px] font-extrabold font-en text-[#64748B] tabular-nums"
          >
            <span>0%</span>
            <span>20%</span>
            <span>40%</span>
            <span>60%</span>
            <span>80%</span>
            <span>100%</span>
          </div>
        </div>
      </div>

      {/* =====================================================================
          4. ROW 2A — VEHICLE AUCTIONS PHOTO CARD + WIDE COMPARATIVE TABLE
             Card 5: بطاقة صور مزادات المركبات
             Card 6: التحليل المقارن لأداء المزادات (Wide Desktop View without Horizontal Scroll)
         ===================================================================== */}
      <div
        dir="ltr"
        className="grid grid-cols-1 xl:grid-cols-12 gap-3.5 mt-3.5 items-stretch"
      >
        {/* -------------------------------------------------------------------
            CARD 5: بطاقة صور مزادات المركبات (Vehicle Auctions Showcase Card)
           ------------------------------------------------------------------- */}
        <div className="xl:col-span-4 flex flex-col justify-between gap-2">
          <div className="relative flex-1 min-h-[210px] rounded-[16px] overflow-hidden border border-[#D5DFEC] bg-[#123B70] shadow-[0_4px_14px_rgba(18,59,112,0.08)] group">
            <img
              src={`${assetBase}assets/auction_yard_showcase.jpg`}
              onError={(e) => {
                e.currentTarget.src = `${assetBase}assets/dashboard_cars_photo.png`;
              }}
              alt="مزادات المركبات | Vehicle Auctions"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-center select-none group-hover:scale-[1.02] transition-transform duration-500"
            />

            {/* Measured Navy Scrim Overlay over Bottom */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0D2B52]/95 via-[#123B70]/35 to-transparent pointer-events-none" />

            {/* Top Period Badge */}
            <div
              dir="rtl"
              className="absolute top-3 right-3 bg-[#123B70]/85 backdrop-blur-xs border border-white/20 text-white px-3 py-1 rounded-lg text-[11px] font-extrabold flex items-center gap-1.5 shadow-sm"
            >
              <Gavel className="w-3.5 h-3.5 text-[#D6A348] shrink-0" />
              <span>
                {isAr
                  ? `ساحات مزادات ساعد — ${monthNameAr} ${selectedPeriod.year}`
                  : `SAAED Auction Yards — ${monthNameEn} ${selectedPeriod.year}`}
              </span>
            </div>

            {/* Bottom Caption Bar inside Card */}
            <div
              dir="rtl"
              className="absolute bottom-0 inset-x-0 p-3.5 flex items-end justify-between gap-2 text-white"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-[#D6A348]/25 border border-[#D6A348]/50 flex items-center justify-center shrink-0">
                    <Gavel className="w-4 h-4 text-[#D6A348]" />
                  </span>
                  <h4 className="text-[14.5px] font-black tracking-tight text-white">
                    مزادات المركبات | Vehicle Auctions
                  </h4>
                </div>
                <p className="text-[11.5px] font-bold text-white/85 mt-1">
                  {isAr
                    ? `إجمالي المعروض: ${metrics.totalListed.toLocaleString('en-US')} مركبة عبر ${metrics.totalAuctions} مزادات معتمدة`
                    : `Total Listed: ${metrics.totalListed.toLocaleString('en-US')} vehicles across ${metrics.totalAuctions} auctions`}
                </p>
              </div>
            </div>
          </div>

          {/* Sheet 2 Navigation Button (Preserved) */}
          <button
            type="button"
            onClick={onSwitchToSheet1}
            title={
              isAr
                ? 'الشيت الثاني : التحليل التنفيذي للمزادات (انقر للتنقل)'
                : 'Sheet 2: Executive Auction Analysis'
            }
            className="inline-flex items-center gap-0 rounded-full overflow-hidden shadow-xs cursor-pointer group self-start"
          >
            <div className="bg-white p-0.5 flex items-center justify-center">
              <ExcelSheetIcon className="w-6 h-6" />
            </div>
            <div
              style={{
                background: 'linear-gradient(90deg, #0E2F5A 0%, #164E8A 100%)',
              }}
              className="text-white text-[12px] font-extrabold px-3.5 py-1 rounded-e-full group-hover:brightness-110 transition-all whitespace-nowrap"
            >
              {isAr
                ? 'الشيت الثاني : التحليل التنفيذي للمزادات'
                : 'Sheet 2 : Executive Auction Analysis'}
            </div>
          </button>
        </div>

        {/* -------------------------------------------------------------------
            CARD 6: التحليل المقارن لأداء المزادات (Wide Comparative Analysis Table)
           ------------------------------------------------------------------- */}
        <div
          dir={isAr ? 'rtl' : 'ltr'}
          className="xl:col-span-8 bg-white border border-[#D5DFEC] rounded-[16px] shadow-[0_4px_14px_rgba(18,59,112,0.06)] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div
            style={{
              background: 'linear-gradient(135deg, #175A9C 0%, #123B70 100%)',
            }}
            className="px-4 py-2.5 text-white flex items-center justify-between border-b border-[#0E2F5A]"
          >
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                <FileCheck2 className="w-4 h-4 text-[#D6A348]" />
              </span>
              <h3 className="text-[14.5px] font-extrabold whitespace-nowrap">
                {isAr
                  ? 'التحليل المقارن لأداء المزادات'
                  : 'Comparative Auction Performance Analysis'}
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-block text-[11.5px] font-bold text-white/85">
                {isAr
                  ? `الفترة: ${monthNameAr} ${selectedPeriod.year}`
                  : `Period: ${monthNameEn} ${selectedPeriod.year}`}
              </span>
              {!pixelPerfectMode && (
                <button
                  type="button"
                  onClick={onOpenThresholdModal}
                  title={
                    isAr
                      ? 'تعديل حدود تقييم الأداء'
                      : 'Customize Performance Thresholds'
                  }
                  className="no-print p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Full-Width Responsive Table Container (No Horizontal Scrollbar Needed on Desktop) */}
          <div className="overflow-x-auto flex-1">
            <table className="w-full border-collapse text-center text-[12.5px] font-bold">
              <thead>
                <tr className="bg-[#123B70] text-white font-extrabold border-b border-[#175A9C]">
                  <th className="py-2.5 px-3 border-e border-[#24528A] whitespace-nowrap">
                    {isAr ? 'رقم المزاد' : 'Auction ID'}
                  </th>
                  <th
                    onClick={() =>
                      setCompDateSort((prev) =>
                        prev === 'none'
                          ? 'asc'
                          : prev === 'asc'
                          ? 'desc'
                          : 'none'
                      )
                    }
                    title={
                      isAr
                        ? 'انقر للترتيب الزمني حسب تاريخ المزاد'
                        : 'Click to sort chronologically by auction date'
                    }
                    className="py-2.5 px-2.5 border-e border-[#24528A] whitespace-nowrap cursor-pointer hover:bg-white/10 transition-colors select-none"
                  >
                    <div className="inline-flex items-center justify-center gap-1">
                      <CalendarDays className="w-3.5 h-3.5 text-[#D6A348] shrink-0" />
                      <span>{isAr ? 'تاريخ المزاد' : 'Auction Date'}</span>
                      <ArrowUpDown className="w-3 h-3 text-white/75 shrink-0" />
                    </div>
                  </th>
                  <th className="py-2.5 px-2.5 border-e border-[#24528A] whitespace-nowrap">
                    {isAr ? 'المركبات المدرجة' : 'Listed Vehicles'}
                  </th>
                  <th className="py-2.5 px-2.5 border-e border-[#24528A] whitespace-nowrap">
                    {isAr ? 'المركبات المبيعة' : 'Sold Vehicles'}
                  </th>
                  <th className="py-2.5 px-2.5 border-e border-[#24528A] whitespace-nowrap">
                    {isAr ? 'المركبات غير المبيعة' : 'Unsold Vehicles'}
                  </th>
                  <th className="py-2.5 px-2.5 border-e border-[#24528A] whitespace-nowrap">
                    {isAr ? 'نسبة البيع' : 'Sale Rate'}
                  </th>
                  <th className="py-2.5 px-2.5 border-e border-[#24528A] whitespace-nowrap">
                    {isAr ? 'نسبة عدم البيع' : 'Unsold Rate'}
                  </th>
                  <th className="py-2.5 px-3 whitespace-nowrap">
                    {isAr ? 'تقييم الأداء' : 'Performance Evaluation'}
                  </th>
                </tr>
              </thead>
              <tbody className="text-[#14243D] divide-y divide-slate-200">
                {comparativeAuctions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-8 px-4 text-center text-[#64748B] font-bold"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <span>
                          {isAr
                            ? `لا توجد مزادات مسجلة لشهر ${monthNameAr} ${selectedPeriod.year}.`
                            : `No auctions recorded for ${monthNameEn} ${selectedPeriod.year}.`}
                        </span>
                        <button
                          type="button"
                          onClick={onOpenAddModal}
                          className="no-print inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-extrabold text-white bg-[#16843B] hover:bg-[#126E30] rounded-lg cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>
                            {isAr
                              ? 'إضافة أول مزاد لهذا الشهر'
                              : 'Add First Auction'}
                          </span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  comparativeAuctions.map((auc, i) => {
                    const badge = evaluateAuctionPerformance(
                      auc.saleRate,
                      thresholds,
                      lang
                    );
                    return (
                      <tr
                        key={auc.id}
                        className={
                          i % 2 === 0
                            ? 'bg-white hover:bg-[#F4F7FB] transition-colors'
                            : 'bg-[#F8FAFC] hover:bg-[#EEF3F9] transition-colors'
                        }
                      >
                        <td className="py-2 px-3 border-e border-slate-200">
                          <span className="auction-id font-en font-black text-[#123B70] text-[12.5px] px-2 py-0.5 rounded-md bg-[#EEF3F9] border border-[#CBD5E1]">
                            {auc.auctionNumber}
                          </span>
                        </td>
                        <td className="py-2 px-2.5 border-e border-slate-200 whitespace-nowrap">
                          {auc.auctionDate ? (
                            <span className="font-en font-bold tabular-nums text-[12.5px] text-[#14243D]">
                              {formatAuctionDateDisplay(auc.auctionDate, lang)}
                            </span>
                          ) : (
                            <span className="text-slate-500 font-semibold text-[11.5px]">
                              {formatAuctionDateDisplay(undefined, lang)}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2.5 border-e border-slate-200 font-extrabold tabular-nums text-[13px] text-[#14243D]">
                          {auc.listedVehicles.toLocaleString('en-US')}
                        </td>
                        <td className="py-2 px-2.5 border-e border-slate-200 font-extrabold tabular-nums text-[13px] text-[#16843B]">
                          {auc.soldVehicles.toLocaleString('en-US')}
                        </td>
                        <td className="py-2 px-2.5 border-e border-slate-200 font-extrabold tabular-nums text-[13px] text-[#C52B36]">
                          {auc.unsoldVehicles.toLocaleString('en-US')}
                        </td>
                        <td className="py-2 px-2.5 border-e border-slate-200 font-black tabular-nums text-[13px] text-[#16843B]">
                          <span dir="ltr" className="inline-block">
                            {auc.saleRate.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-2 px-2.5 border-e border-slate-200 font-extrabold tabular-nums text-[13px] text-[#64748B]">
                          <span dir="ltr" className="inline-block">
                            {auc.unsoldRate.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-1.5 px-3">
                          <span
                            className={`inline-flex items-center justify-center px-3 py-0.5 rounded-full text-[11.5px] font-extrabold border ${badge.bgClass} ${badge.textClass} ${badge.borderClass} whitespace-nowrap`}
                          >
                            {badge.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* =====================================================================
          5. ROW 2B — THREE EXECUTIVE OPERATIONAL CARDS
             Card 7: أبرز الملاحظات التشغيلية
             Card 8: التحديات التشغيلية الرئيسية
             Card 9: التوصيات والإجراءات التحسينية
         ===================================================================== */}
      <div
        dir={isAr ? 'rtl' : 'ltr'}
        className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mt-3.5 items-stretch"
      >
        {/* -------------------------------------------------------------------
            CARD 7: أبرز الملاحظات التشغيلية (Key Operational Notes Card)
           ------------------------------------------------------------------- */}
        <div className="bg-white border border-[#D5DFEC] rounded-[16px] shadow-[0_4px_14px_rgba(18,59,112,0.06)] overflow-hidden flex flex-col">
          {/* Blue Gradient Header */}
          <div
            style={{
              background: 'linear-gradient(135deg, #175A9C 0%, #123B70 100%)',
            }}
            className="px-4 py-2.5 text-white flex items-center justify-between border-b border-[#0E2F5A]"
          >
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                <ClipboardCheck className="w-4 h-4 text-[#D6A348]" />
              </span>
              <h3 className="text-[14px] sm:text-[14.5px] font-extrabold whitespace-nowrap">
                {isAr ? 'أبرز الملاحظات التشغيلية' : 'Key Operational Notes'}
              </h3>
            </div>
            <span className="text-[11px] font-bold text-white/85 font-en tabular-nums">
              {auctions.length}
            </span>
          </div>

          {/* Subtle Visual Header Strip — Vehicle Inspection & Yard Management */}
          <div className="relative h-[68px] w-full overflow-hidden bg-[#123B70] border-b border-slate-200 shrink-0">
            <img
              src={`${assetBase}assets/operational_notes_inspection.jpg`}
              onError={(e) => {
                e.currentTarget.src = `${assetBase}assets/header_top_photo.png`;
              }}
              alt="فحص ومعاينة المركبات"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-center select-none"
            />
            <div className="absolute inset-0 bg-gradient-to-l from-[#123B70]/85 via-[#123B70]/50 to-transparent" />
            <div className="absolute inset-0 px-3.5 flex items-center justify-between text-white">
              <span className="text-[11.5px] font-extrabold tracking-wide drop-shadow-xs">
                {isAr
                  ? 'تقارير الفحص والمعاينة الميدانية للمركبات'
                  : 'Field Vehicle Inspection & Yard Reports'}
              </span>
            </div>
          </div>

          {/* Notes List with Independent Single-Line Auction ID Badges */}
          {auctions.length === 0 ? (
            <div className="p-6 text-center text-xs font-bold text-[#64748B] my-auto">
              {isAr
                ? `لا توجد ملاحظات مسجلة لشهر ${monthNameAr} ${selectedPeriod.year}`
                : `No notes for ${monthNameEn} ${selectedPeriod.year}`}
            </div>
          ) : (
            <ul className="p-3.5 divide-y divide-slate-100 flex-1">
              {auctions.map((auc) => (
                <li
                  key={auc.id}
                  className="py-2 first:pt-0.5 last:pb-0.5 flex items-start justify-between gap-2.5"
                >
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    <span className="w-2 h-2 rounded-full bg-[#175A9C] mt-1.5 shrink-0" />
                    <span className="text-[12.5px] font-bold text-[#14243D] leading-relaxed">
                      {isAr ? auc.notesAr : auc.notesEn}
                    </span>
                  </div>
                  <span className="auction-id font-en text-[11px] font-black px-2 py-0.5 rounded-md bg-[#F0F5FA] text-[#175A9C] border border-[#CBD5E1]">
                    {auc.auctionNumber}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* -------------------------------------------------------------------
            CARD 8: التحديات التشغيلية الرئيسية (Operational Challenges Card)
           ------------------------------------------------------------------- */}
        <div className="bg-white border border-[#D5DFEC] rounded-[16px] shadow-[0_4px_14px_rgba(18,59,112,0.06)] overflow-hidden flex flex-col">
          {/* Navy Header with Gold Warning Icon */}
          <div
            style={{
              background: 'linear-gradient(135deg, #123B70 0%, #0D2B52 100%)',
            }}
            className="px-4 py-2.5 text-white flex items-center justify-between border-b border-[#0E2F5A]"
          >
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-[#D6A348]" />
              </span>
              <h3 className="text-[14px] sm:text-[14.5px] font-extrabold whitespace-nowrap">
                {isAr
                  ? 'التحديات التشغيلية الرئيسية'
                  : 'Operational Challenges'}
              </h3>
            </div>
            <span className="text-[11px] font-bold text-white/85 font-en tabular-nums">
              {auctions.length}
            </span>
          </div>

          {/* Subtle Visual Header Strip — Vehicle Preparation & Storage Yards */}
          <div className="relative h-[68px] w-full overflow-hidden bg-[#123B70] border-b border-slate-200 shrink-0">
            <img
              src={`${assetBase}assets/operational_challenges_yard.jpg`}
              onError={(e) => {
                e.currentTarget.src = `${assetBase}assets/header_bottom_photo.png`;
              }}
              alt="تجهيز وصيانة المركبات للمزاد"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-center select-none"
            />
            <div className="absolute inset-0 bg-gradient-to-l from-[#123B70]/85 via-[#123B70]/50 to-transparent" />
            <div className="absolute inset-0 px-3.5 flex items-center justify-between text-white">
              <span className="text-[11.5px] font-extrabold tracking-wide drop-shadow-xs">
                {isAr
                  ? 'جاهزية ساحات الحجز والصيانة والتجهيز الفني'
                  : 'Yard Capacity, Maintenance & Pre-Auction Readiness'}
              </span>
            </div>
          </div>

          {/* Challenges List (Dark readable text + amber/red attention marker + independent .auction-id badge) */}
          {auctions.length === 0 ? (
            <div className="p-6 text-center text-xs font-bold text-[#64748B] my-auto">
              {isAr
                ? `لا توجد تحديات مسجلة لشهر ${monthNameAr} ${selectedPeriod.year}`
                : `No challenges for ${monthNameEn} ${selectedPeriod.year}`}
            </div>
          ) : (
            <ul className="p-3.5 divide-y divide-slate-100 flex-1">
              {auctions.map((auc) => (
                <li
                  key={auc.id}
                  className="py-2 first:pt-0.5 last:pb-0.5 flex items-start justify-between gap-2.5"
                >
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    <span className="w-2 h-2 rounded-full bg-[#D99A24] ring-3 ring-[#FEF3C7] mt-1.5 shrink-0" />
                    <span className="text-[12.5px] font-bold text-[#14243D] leading-relaxed">
                      {isAr ? auc.challengesAr : auc.challengesEn}
                    </span>
                  </div>
                  <span className="auction-id font-en text-[11px] font-black px-2 py-0.5 rounded-md bg-[#FEF3F2] text-[#C52B36] border border-[#FECDCA]">
                    {auc.auctionNumber}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* -------------------------------------------------------------------
            CARD 9: التوصيات والإجراءات التحسينية (Executive Recommendations Card)
           ------------------------------------------------------------------- */}
        <div className="bg-white border border-[#D5DFEC] rounded-[16px] shadow-[0_4px_14px_rgba(18,59,112,0.06)] overflow-hidden flex flex-col">
          {/* Gradient Blue Header with Gold Lightbulb Icon */}
          <div
            style={{
              background: 'linear-gradient(135deg, #2467B2 0%, #123B70 100%)',
            }}
            className="px-4 py-2.5 text-white flex items-center justify-between border-b border-[#0E2F5A]"
          >
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                <Lightbulb className="w-4 h-4 text-[#D6A348]" />
              </span>
              <h3 className="text-[14px] sm:text-[14.5px] font-extrabold whitespace-nowrap">
                {isAr
                  ? 'التوصيات والإجراءات التحسينية'
                  : 'Recommendations & Actions'}
              </h3>
            </div>
            <span className="text-[11px] font-bold text-white/85 font-en tabular-nums">
              {auctions.length}
            </span>
          </div>

          {/* Subtle Visual Header Strip — Operations Excellence & Yard Organization */}
          <div className="relative h-[68px] w-full overflow-hidden bg-[#123B70] border-b border-slate-200 shrink-0">
            <img
              src={`${assetBase}assets/recommendations_excellence.jpg`}
              onError={(e) => {
                e.currentTarget.src = `${assetBase}assets/dashboard_cars_photo.png`;
              }}
              alt="تنظيم ساحات المزادات وإدارة العمليات"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-center select-none"
            />
            <div className="absolute inset-0 bg-gradient-to-l from-[#123B70]/85 via-[#123B70]/50 to-transparent" />
            <div className="absolute inset-0 px-3.5 flex items-center justify-between text-white">
              <span className="text-[11.5px] font-extrabold tracking-wide drop-shadow-xs">
                {isAr
                  ? 'تطوير العمليات وتنظيم ساحات المزادات ورفع كفاءة البيع'
                  : 'Operations Optimization & Auction Yard Excellence'}
              </span>
            </div>
          </div>

          {/* Recommendations List with Subtle Green Check Icon & Unbreakable .auction-id Badge */}
          {auctions.length === 0 ? (
            <div className="p-6 text-center text-xs font-bold text-[#64748B] my-auto">
              {isAr
                ? `لا توجد توصيات مسجلة لشهر ${monthNameAr} ${selectedPeriod.year}`
                : `No recommendations for ${monthNameEn} ${selectedPeriod.year}`}
            </div>
          ) : (
            <ul className="p-3.5 divide-y divide-slate-100 flex-1">
              {auctions.map((auc) => (
                <li
                  key={auc.id}
                  className="py-2 first:pt-0.5 last:pb-0.5 flex items-start justify-between gap-2.5"
                >
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    <CheckCircle2 className="w-4 h-4 text-[#16843B] mt-0.5 shrink-0" />
                    <span className="text-[12.5px] font-bold text-[#14243D] leading-relaxed">
                      {isAr ? auc.recommendationsAr : auc.recommendationsEn}
                    </span>
                  </div>
                  <span className="auction-id font-en text-[11px] font-black px-2 py-0.5 rounded-md bg-[#ECFDF3] text-[#16843B] border border-[#ABEFC6]">
                    {auc.auctionNumber}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
};
