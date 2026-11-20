import React, { useMemo } from 'react';
import {
  ClipboardList,
  ClipboardCheck,
  AlertTriangle,
  Lightbulb,
  PieChart,
  BarChart3,
  TrendingUp,
  Gavel,
  ArrowUpRight,
  ArrowDownRight,
  FileCheck2,
  Calendar,
  Layers,
  ZoomIn,
  ZoomOut,
  Printer,
  FileDown,
  X,
  RotateCcw,
} from 'lucide-react';
import {
  AuctionRecord,
  ComputedAuctionMetrics,
  Language,
  PerformanceThresholds,
  ReportingPeriod,
  ReportMetadata,
} from '../types/auction';
import {
  evaluateAuctionPerformance,
  getMonthName,
} from '../services/storageService';
import { formatAuctionDateDisplay } from '../utils/auctionDateUtils';
import {
  GoldenGavelIcon,
  NavyCarIcon,
  CarSoldIcon,
  CarUnsoldIcon,
  GoldenTargetIcon,
  AscendingBarsIcon,
} from './CustomIcons';

export type PaperSizeOption = 'a4' | 'a3';

interface ExecutiveAuctionPrintReportProps {
  auctions: AuctionRecord[];
  metrics: ComputedAuctionMetrics;
  metadata: ReportMetadata;
  thresholds: PerformanceThresholds;
  selectedPeriod: ReportingPeriod;
  lang: Language;
  paperSize: PaperSizeOption;
  containerId?: string;
}

/**
 * Splits an array into chunks of `size`. If the array is empty, returns `[[]]`.
 */
function chunkArray<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return [[]];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export const ExecutiveAuctionPrintReport: React.FC<
  ExecutiveAuctionPrintReportProps
> = ({
  auctions,
  metrics,
  metadata,
  thresholds,
  selectedPeriod,
  lang,
  paperSize,
  containerId = 'saaed-official-report-pages',
}) => {
  const isAr = lang === 'ar';
  const assetBase = import.meta.env.BASE_URL || './';
  const monthNameAr = getMonthName(selectedPeriod.month, 'ar');
  const monthNameEn = getMonthName(selectedPeriod.month, 'en');
  const paddedMonth = String(selectedPeriod.month).padStart(2, '0');

  // Exact pixel dimensions at 96 DPI for 297x210mm (A4) or 420x297mm (A3)
  const pageWidthPx = paperSize === 'a3' ? 1587 : 1122;
  const pageHeightPx = paperSize === 'a3' ? 1122 : 794;

  // Smart pagination row limits based on paper size and text length
  const hasVeryLongText = auctions.some(
    (a) =>
      (a.notesAr?.length || 0) > 120 ||
      (a.challengesAr?.length || 0) > 120 ||
      (a.recommendationsAr?.length || 0) > 120
  );
  const dataTableRowsPerPage =
    paperSize === 'a3' ? (hasVeryLongText ? 8 : 11) : hasVeryLongText ? 5 : 7;
  const compTableRowsPerPage = paperSize === 'a3' ? 12 : 8;
  const opsItemsPerPage =
    paperSize === 'a3' ? (hasVeryLongText ? 7 : 10) : hasVeryLongText ? 5 : 6;

  const dataTableChunks = useMemo(
    () => chunkArray(auctions, dataTableRowsPerPage),
    [auctions, dataTableRowsPerPage]
  );

  // Determine whether Comparative Table + 3 Operational Cards fit on one page or split cleanly
  const splitOpsToSeparatePage =
    auctions.length > (paperSize === 'a3' ? 8 : 5) || hasVeryLongText;

  const compTableChunks = useMemo(
    () => chunkArray(auctions, compTableRowsPerPage),
    [auctions, compTableRowsPerPage]
  );

  const opsChunks = useMemo(
    () => chunkArray(auctions, opsItemsPerPage),
    [auctions, opsItemsPerPage]
  );

  // Total Pages calculation:
  // Page 1: Executive Summary & Distribution
  // Page 2: Visual Charts Comparison
  // Pages 3..N: Detailed Auction Data Table chunks
  // Next Pages: Comparative Analysis Table (+ Operational Cards if compact, or separate pages if large)
  const totalPages =
    2 +
    dataTableChunks.length +
    (splitOpsToSeparatePage
      ? compTableChunks.length + opsChunks.length
      : compTableChunks.length);

  // Sorted descending by saleRate for Horizontal Bar Chart
  const sortedBySaleRate = useMemo(
    () => [...auctions].sort((a, b) => b.saleRate - a.saleRate),
    [auctions]
  );

  // Dynamic Y-axis max for Clustered Bar Chart
  const maxListedValue = Math.max(
    300,
    ...auctions.map((a) => a.listedVehicles)
  );
  const yAxisMax = Math.max(350, Math.ceil((maxListedValue + 20) / 50) * 50);
  const standardTicks =
    yAxisMax === 350
      ? [0, 50, 100, 150, 200, 250, 300, 350]
      : [
          0,
          Math.round(yAxisMax * (1 / 7)),
          Math.round(yAxisMax * (2 / 7)),
          Math.round(yAxisMax * (3 / 7)),
          Math.round(yAxisMax * (4 / 7)),
          Math.round(yAxisMax * (5 / 7)),
          Math.round(yAxisMax * (6 / 7)),
          yAxisMax,
        ];

  // Doughnut Chart Geometry
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const hasVehicles = metrics.totalListed > 0;
  const soldFraction = hasVehicles
    ? Math.min(1, Math.max(0, metrics.overallSaleRate / 100))
    : 0;
  const unsoldFraction = hasVehicles ? Math.max(0, 1 - soldFraction) : 0;
  const soldStroke = soldFraction * circumference;
  const unsoldStroke = unsoldFraction * circumference;

  let runningPageNumber = 0;

  // Shared Compact Header for Pages 2..N (RTL 3-Column Grid: Right Logo | Center Title | Left Period & Page Badge)
  const renderCompactHeader = (
    sectionTitleAr: string,
    sectionTitleEn: string,
    pageNum: number
  ) => (
    <header className="pdf-compact-header overflow-hidden shrink-0">
      {/* Right Column: Official SAAED Logo */}
      <div className="bg-white flex items-center justify-center px-3 py-1.5 border-l border-[#CBD5E1]">
        <img
          src={`${assetBase}assets/saaed_logo.png`}
          alt="SAAED Logo"
          referrerPolicy="no-referrer"
          className="max-h-[42px] w-auto object-contain block"
        />
      </div>

      {/* Center Column: Section Title & Month Subtitle */}
      <div
        dir={isAr ? 'rtl' : 'ltr'}
        className="px-5 py-2 flex flex-col items-center justify-center text-center text-white"
        style={{
          background:
            'linear-gradient(90deg, #123B70 0%, #175A9C 50%, #123B70 100%)',
        }}
      >
        <h2
          style={{ lineHeight: 1.5, letterSpacing: '0px' }}
          className="text-[16px] font-extrabold text-white m-0"
        >
          {isAr ? sectionTitleAr : sectionTitleEn}
        </h2>
        <p
          style={{ lineHeight: 1.45, letterSpacing: '0px' }}
          className="text-[11.5px] font-bold text-[#E2BB70] m-0 mt-0.5"
        >
          {isAr
            ? `تقرير مزادات شهر ${monthNameAr} ${selectedPeriod.year}`
            : `Monthly Auction Report — ${monthNameEn} ${selectedPeriod.year}`}
        </p>
      </div>

      {/* Left Column: Period, Report Date & Page Badge */}
      <div
        dir="ltr"
        className="bg-[#123B70] text-white px-3.5 py-1.5 flex flex-col items-center justify-center border-r border-[#24528A] gap-1"
      >
        <div className="flex items-center justify-between w-full text-[11px] font-extrabold text-[#E2BB70] font-en">
          <span>{`${selectedPeriod.year}-${paddedMonth}`}</span>
          <span className="px-2 py-0.5 rounded bg-[#175A9C] text-white text-[10.5px]">
            {isAr
              ? `صفحة ${pageNum} من ${totalPages}`
              : `Page ${pageNum} of ${totalPages}`}
          </span>
        </div>
        <div className="text-[10.5px] font-bold text-[#E2E8F0] font-en w-full text-left">
          {`Date: ${metadata.reportDate}`}
        </div>
      </div>
    </header>
  );

  // Shared Corporate Footer for All Pages
  const renderPageFooter = (pageNum: number) => (
    <footer
      dir={isAr ? 'rtl' : 'ltr'}
      style={{ lineHeight: 1.5, letterSpacing: '0px' }}
      className="mt-auto pt-2 border-t border-[#CBD5E1] flex items-center justify-between text-[11px] font-extrabold text-[#123B70] shrink-0"
    >
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-[#D6A348] shrink-0" />
        <span>
          {isAr
            ? 'شركة ساعد للأنظمة المرورية (SAAED) — نظام التقرير التنفيذي لمزادات المركبات'
            : 'SAAED Traffic Systems — Vehicle Auction Executive Reporting System'}
        </span>
      </div>

      <div className="text-[#64748B] font-bold">
        {isAr
          ? `تقرير مزادات شهر ${monthNameAr} ${selectedPeriod.year} | تاريخ الإعداد: ${metadata.reportDate}`
          : `${monthNameEn} ${selectedPeriod.year} Auction Report | Prepared: ${metadata.reportDate}`}
      </div>

      {/* Designer & Author Credit */}
      <div className="flex items-center gap-1.5 text-[#123B70] font-black">
        <span className="w-1.5 h-1.5 rounded-full bg-[#D6A348] shrink-0" />
        <span>
          {isAr ? 'إعداد وتصميم: خالد الهاشمي' : 'Prepared & Designed by: Khalid Al Hashemi'}
        </span>
      </div>

      <div className="px-2.5 py-0.5 rounded-md bg-[#123B70] text-white text-[11px] font-black tabular-nums">
        {isAr
          ? `صفحة ${pageNum} من ${totalPages}`
          : `Page ${pageNum} of ${totalPages}`}
      </div>
    </footer>
  );

  return (
    <div
      id={containerId}
      dir={isAr ? 'rtl' : 'ltr'}
      className="report-document flex flex-col items-center gap-6 print:gap-0"
    >
      {/* ===================================================================
          PAGE 1: EXECUTIVE SUMMARY, KPIs & RESULTS DISTRIBUTION
         =================================================================== */}
      {(() => {
        runningPageNumber += 1;
        const pageNum = runningPageNumber;
        return (
          <div
            key={`page-${pageNum}`}
            style={{ width: `${pageWidthPx}px`, height: `${pageHeightPx}px` }}
            className="official-report-page bg-[#F4F7FB] text-[#14243D] p-5 flex flex-col justify-between box-border overflow-hidden border border-[#CBD5E1] shadow-lg print:shadow-none print:border-none"
          >
            {/* 1. DEDICATED OFFICIAL REPORT HEADER (.pdf-report-header)
                RTL 3-Column Layout:
                - Right (24%): SAAED Official Logo (.pdf-header-logo)
                - Center (1fr): Main Title h1 + Subtitle p (.pdf-header-title)
                - Left (34%): Original Vehicle Auction Yard & Gavel Photo (.pdf-header-image) */}
            <div className="shrink-0">
              <div className="w-full rounded-[14px] overflow-hidden bg-white border border-[#CBD5E1]">
                <header className="pdf-report-header">
                  {/* Right of Page: Official SAAED Logo (1 Element) */}
                  <div className="pdf-header-logo">
                    <img
                      src={`${assetBase}assets/saaed_logo.png`}
                      alt="SAAED Logo"
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  {/* Center of Page: Main Title (1 h1) + Subtitle (1 p) */}
                  <div className="pdf-header-title">
                    <h1>
                      {isAr
                        ? 'التقرير التنفيذي لمزادات المركبات'
                        : 'Vehicle Auction Executive Report'}
                    </h1>
                    <p>
                      {isAr
                        ? `تقرير مزادات شهر ${monthNameAr} ${selectedPeriod.year}`
                        : `Monthly Auction Report — ${monthNameEn} ${selectedPeriod.year}`}
                    </p>
                  </div>

                  {/* Left of Page: Original Vehicle Auction Yard & Gavel Photo (1 Element) */}
                  <div className="pdf-header-image">
                    <img
                      src={`${assetBase}assets/header_top_photo.png`}
                      alt="SAAED Vehicle Auction Yard"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </header>

                {/* Metadata Sub-Bar */}
                <div
                  dir={isAr ? 'rtl' : 'ltr'}
                  style={{ lineHeight: 1.5, letterSpacing: '0px' }}
                  className="bg-[#EEF3F9] border-t border-[#CBD5E1] px-4 py-1.5 flex items-center justify-between text-[12px] font-extrabold text-[#123B70]"
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-[#175A9C] shrink-0" />
                    <span>
                      {isAr
                        ? `الفترة المشمولة بالتقرير: شهر ${monthNameAr} ${selectedPeriod.year} — من ${metadata.periodStart} إلى ${metadata.periodEnd}`
                        : `Reporting Period: ${monthNameEn} ${selectedPeriod.year} (${metadata.periodStart} to ${metadata.periodEnd})`}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span>
                      {isAr
                        ? `تاريخ إعداد التقرير: ${metadata.reportDate}`
                        : `Report Prepared: ${metadata.reportDate}`}
                    </span>
                    <span className="px-2.5 py-0.5 rounded bg-[#123B70] text-white text-[11px] font-en">
                      {isAr
                        ? `صفحة ${pageNum} من ${totalPages}`
                        : `Page ${pageNum} of ${totalPages}`}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. SIX EXECUTIVE KPI CARDS (Spacious 3x2 Grid) */}
              <div className="grid grid-cols-3 gap-2.5 mt-2.5">
                <div className="bg-white border border-[#CBD5E1] rounded-[12px] px-4 py-2 flex items-center justify-between">
                  <div className="text-right flex-1">
                    <div
                      style={{ lineHeight: 1.45, letterSpacing: '0px' }}
                      className="text-[12.5px] font-extrabold text-[#123B70] whitespace-nowrap"
                    >
                      {isAr ? 'إجمالي عدد المزادات' : 'Total Auctions'}
                    </div>
                    <div className="text-[22px] font-black text-[#8F242C] font-en tabular-nums mt-0.5">
                      {metrics.totalAuctions.toLocaleString('en-US')}
                    </div>
                  </div>
                  <GoldenGavelIcon className="w-8 h-8 shrink-0" />
                </div>

                <div className="bg-white border border-[#CBD5E1] rounded-[12px] px-4 py-2 flex items-center justify-between">
                  <div className="text-right flex-1">
                    <div
                      style={{ lineHeight: 1.45, letterSpacing: '0px' }}
                      className="text-[12.5px] font-extrabold text-[#123B70] whitespace-nowrap"
                    >
                      {isAr ? 'إجمالي المركبات المدرجة' : 'Listed Vehicles'}
                    </div>
                    <div className="text-[22px] font-black text-[#123B70] font-en tabular-nums mt-0.5">
                      {metrics.totalListed.toLocaleString('en-US')}
                    </div>
                  </div>
                  <NavyCarIcon className="w-8 h-8 shrink-0" />
                </div>

                <div className="bg-white border border-[#CBD5E1] rounded-[12px] px-4 py-2 flex items-center justify-between">
                  <div className="text-right flex-1">
                    <div
                      style={{ lineHeight: 1.45, letterSpacing: '0px' }}
                      className="text-[12.5px] font-extrabold text-[#123B70] whitespace-nowrap"
                    >
                      {isAr ? 'إجمالي المركبات المبيعة' : 'Sold Vehicles'}
                    </div>
                    <div className="text-[22px] font-black text-[#16843B] font-en tabular-nums mt-0.5">
                      {metrics.totalSold.toLocaleString('en-US')}
                    </div>
                  </div>
                  <CarSoldIcon className="w-9 h-8 shrink-0" />
                </div>

                <div className="bg-white border border-[#CBD5E1] rounded-[12px] px-4 py-2 flex items-center justify-between">
                  <div className="text-right flex-1">
                    <div
                      style={{ lineHeight: 1.45, letterSpacing: '0px' }}
                      className="text-[12.5px] font-extrabold text-[#123B70] whitespace-nowrap"
                    >
                      {isAr ? 'إجمالي المركبات غير المبيعة' : 'Unsold Vehicles'}
                    </div>
                    <div className="text-[22px] font-black text-[#C52B36] font-en tabular-nums mt-0.5">
                      {metrics.totalUnsold.toLocaleString('en-US')}
                    </div>
                  </div>
                  <CarUnsoldIcon className="w-9 h-8 shrink-0" />
                </div>

                <div className="bg-white border border-[#CBD5E1] rounded-[12px] px-4 py-2 flex items-center justify-between">
                  <div className="text-right flex-1">
                    <div
                      style={{ lineHeight: 1.45, letterSpacing: '0px' }}
                      className="text-[12.5px] font-extrabold text-[#123B70] whitespace-nowrap"
                    >
                      {isAr ? 'نسبة نجاح البيع الإجمالية' : 'Sale Success Rate'}
                    </div>
                    <div
                      dir="ltr"
                      className="text-[22px] font-black text-[#16843B] font-en tabular-nums mt-0.5 text-right"
                    >
                      {metrics.overallSaleRate.toFixed(1)}%
                    </div>
                  </div>
                  <GoldenTargetIcon className="w-8 h-8 shrink-0" />
                </div>

                <div className="bg-white border border-[#CBD5E1] rounded-[12px] px-4 py-2 flex items-center justify-between">
                  <div className="text-right flex-1">
                    <div
                      style={{ lineHeight: 1.4, letterSpacing: '0px' }}
                      className="text-[12.5px] font-extrabold text-[#123B70] whitespace-nowrap"
                    >
                      {isAr ? 'متوسط المبيعات لكل مزاد' : 'Avg Sold / Auction'}
                    </div>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span className="text-[22px] font-black text-[#123B70] font-en tabular-nums">
                        {metrics.avgSoldPerAuction.toLocaleString('en-US')}
                      </span>
                      <span
                        style={{ lineHeight: 1.35, letterSpacing: '0px' }}
                        className="text-[11px] font-bold text-[#64748B]"
                      >
                        {isAr ? 'مركبة / مزاد' : 'Vehicles / Auction'}
                      </span>
                    </div>
                  </div>
                  <AscendingBarsIcon className="w-8 h-8 shrink-0" />
                </div>
              </div>
            </div>

            {/* 3. PAGE 1 MAIN BODY: EXECUTIVE SUMMARY + DOUGHNUT DISTRIBUTION + AUCTION YARD PHOTO */}
            <div className="grid grid-cols-12 gap-3.5 my-2.5 flex-1 items-stretch min-h-0">
              {/* Executive Summary Card (4 cols) */}
              <div className="col-span-4 bg-white border border-[#CBD5E1] rounded-[14px] overflow-hidden flex flex-col justify-between">
                <div>
                  <div
                    style={{
                      background:
                        'linear-gradient(135deg, #175A9C 0%, #123B70 100%)',
                    }}
                    className="px-4 py-2 text-white flex items-center gap-2"
                  >
                    <ClipboardList className="w-4 h-4 text-[#D6A348] shrink-0" />
                    <h3
                      style={{ lineHeight: 1.5, letterSpacing: '0px' }}
                      className="text-[14px] font-extrabold m-0"
                    >
                      {isAr
                        ? 'الملخص التنفيذي لنتائج المزادات'
                        : 'Executive Auction Summary'}
                    </h3>
                  </div>

                  <div className="px-4 py-2.5 divide-y divide-[#F1F5F9]">
                    <div className="py-1.5 flex items-center justify-between">
                      <span
                        style={{ lineHeight: 1.5, letterSpacing: '0px' }}
                        className="text-[12.5px] font-bold text-[#64748B]"
                      >
                        {isAr ? 'إجمالي عدد المزادات المنفذة' : 'Total Auctions'}
                      </span>
                      <span className="text-[16px] font-black text-[#123B70] font-en tabular-nums">
                        {metrics.totalAuctions}
                      </span>
                    </div>
                    <div className="py-1.5 flex items-center justify-between">
                      <span
                        style={{ lineHeight: 1.5, letterSpacing: '0px' }}
                        className="text-[12.5px] font-bold text-[#64748B]"
                      >
                        {isAr ? 'إجمالي المركبات المعروضة' : 'Total Listed'}
                      </span>
                      <span className="text-[16px] font-black text-[#14243D] font-en tabular-nums">
                        {metrics.totalListed.toLocaleString('en-US')}
                      </span>
                    </div>
                    <div className="py-1.5 flex items-center justify-between">
                      <span
                        style={{ lineHeight: 1.5, letterSpacing: '0px' }}
                        className="text-[12.5px] font-bold text-[#64748B]"
                      >
                        {isAr ? 'إجمالي المركبات المبيعة' : 'Total Sold'}
                      </span>
                      <span className="text-[16px] font-black text-[#16843B] font-en tabular-nums">
                        {metrics.totalSold.toLocaleString('en-US')}
                      </span>
                    </div>
                    <div className="py-1.5 flex items-center justify-between">
                      <span
                        style={{ lineHeight: 1.5, letterSpacing: '0px' }}
                        className="text-[12.5px] font-bold text-[#64748B]"
                      >
                        {isAr ? 'إجمالي المركبات غير المبيعة' : 'Total Unsold'}
                      </span>
                      <span className="text-[16px] font-black text-[#C52B36] font-en tabular-nums">
                        {metrics.totalUnsold.toLocaleString('en-US')}
                      </span>
                    </div>
                    <div className="py-1.5 flex items-center justify-between">
                      <span
                        style={{ lineHeight: 1.5, letterSpacing: '0px' }}
                        className="text-[13px] font-extrabold text-[#14243D]"
                      >
                        {isAr ? 'النسبة الإجمالية للبيع' : 'Overall Sale Rate'}
                      </span>
                      <span
                        dir="ltr"
                        className="text-[17px] font-black text-[#16843B] font-en tabular-nums"
                      >
                        {metrics.overallSaleRate.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Highest & Lowest Sale Highlight Boxes */}
                <div className="px-4 pb-3 space-y-2">
                  {metrics.highestSaleAuction && (
                    <div className="bg-[#ECFDF3] border border-[#ABEFC6] rounded-[10px] px-3 py-1.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-md bg-[#16843B] text-white flex items-center justify-center shrink-0">
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </span>
                        <span
                          style={{ lineHeight: 1.5, letterSpacing: '0px' }}
                          className="text-[12px] font-extrabold text-[#14243D]"
                        >
                          {isAr ? 'أعلى نسبة بيع' : 'Highest Sale Rate'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="auction-id font-en text-[12px] font-black px-2.5 py-0.5 rounded bg-white text-[#123B70] border border-[#86EFAC]">
                          {metrics.highestSaleAuction.auctionNumber}
                        </span>
                        <span
                          dir="ltr"
                          className="text-[13px] font-black text-[#16843B] font-en tabular-nums"
                        >
                          ({metrics.highestSaleAuction.saleRate.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  )}

                  {metrics.lowestSaleAuction && (
                    <div className="bg-[#FEF3F2] border border-[#FECDCA] rounded-[10px] px-3 py-1.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-md bg-[#C52B36] text-white flex items-center justify-center shrink-0">
                          <ArrowDownRight className="w-3.5 h-3.5" />
                        </span>
                        <span
                          style={{ lineHeight: 1.5, letterSpacing: '0px' }}
                          className="text-[12px] font-extrabold text-[#14243D]"
                        >
                          {isAr ? 'أقل نسبة بيع' : 'Lowest Sale Rate'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="auction-id font-en text-[12px] font-black px-2.5 py-0.5 rounded bg-white text-[#123B70] border border-[#FCA5A5]">
                          {metrics.lowestSaleAuction.auctionNumber}
                        </span>
                        <span
                          dir="ltr"
                          className="text-[13px] font-black text-[#C52B36] font-en tabular-nums"
                        >
                          ({metrics.lowestSaleAuction.saleRate.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Doughnut Chart Distribution Card (4 cols) */}
              <div className="col-span-4 bg-white border border-[#CBD5E1] rounded-[14px] overflow-hidden flex flex-col justify-between">
                <div
                  style={{
                    background:
                      'linear-gradient(135deg, #175A9C 0%, #123B70 60%, #0B2F5B 100%)',
                  }}
                  className="px-3.5 py-2 text-white flex items-center gap-2.5 shrink-0"
                >
                  <div className="w-7 h-7 rounded-[8px] bg-white/12 border border-white/15 flex items-center justify-center shrink-0">
                    <PieChart className="w-4 h-4 text-[#E2AD42]" />
                  </div>
                  <h3
                    style={{ lineHeight: 1.5, letterSpacing: '0px' }}
                    className="text-[14px] font-extrabold m-0"
                  >
                    {isAr
                      ? 'توزيع نتائج المزادات'
                      : 'Auction Results Distribution'}
                  </h3>
                </div>

                {/* Panoramic Hero Image with Smooth Bottom White Fade */}
                <div className="auction-card-hero h-[74px] shrink-0">
                  <img
                    src={`${assetBase}assets/card_distribution_hero.jpg`}
                    onError={(e) => {
                      e.currentTarget.src = `${assetBase}assets/auction_yard_showcase.jpg`;
                    }}
                    alt={
                      isAr
                        ? 'توزيع نتائج مزادات المركبات'
                        : 'Vehicle auction results distribution'
                    }
                    referrerPolicy="no-referrer"
                    className="object-[50%_54%]"
                  />
                </div>

                <div
                  dir="ltr"
                  className="flex items-center justify-around gap-3 px-3.5 py-1.5 my-auto"
                >
                  <div className="relative w-[126px] h-[126px] shrink-0 flex items-center justify-center">
                    <svg viewBox="0 0 144 144" className="w-full h-full">
                      {!hasVehicles ? (
                        <circle
                          cx="72"
                          cy="72"
                          r={radius}
                          fill="transparent"
                          stroke="#E2E8F0"
                          strokeWidth="24"
                        />
                      ) : (
                        <>
                          <circle
                            cx="72"
                            cy="72"
                            r={radius}
                            fill="transparent"
                            stroke="#1259A7"
                            strokeWidth="24"
                            strokeDasharray={`${soldStroke} ${circumference}`}
                            transform="rotate(-90 72 72)"
                          />
                          <circle
                            cx="72"
                            cy="72"
                            r={radius}
                            fill="transparent"
                            stroke="#D62828"
                            strokeWidth="24"
                            strokeDasharray={`${unsoldStroke} ${circumference}`}
                            strokeDashoffset={-soldStroke}
                            transform="rotate(-90 72 72)"
                          />
                          {metrics.overallUnsoldRate >= 8 && (
                            <text
                              x="46"
                              y="28"
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
                              x="80"
                              y="126"
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
                    <div
                      dir={isAr ? 'rtl' : 'ltr'}
                      className="absolute inset-0 flex flex-col items-center justify-center text-center"
                    >
                      <span className="text-[18px] font-black text-[#14243D] font-en tabular-nums leading-tight">
                        {metrics.totalListed.toLocaleString('en-US')}
                      </span>
                      <span
                        style={{ lineHeight: 1.35, letterSpacing: '0px' }}
                        className="text-[10.5px] font-extrabold text-[#64748B]"
                      >
                        {isAr ? 'مركبة مدرجة' : 'Vehicles'}
                      </span>
                    </div>
                  </div>

                  <div dir={isAr ? 'rtl' : 'ltr'} className="space-y-2 flex-1">
                    <div className="px-2.5 py-2 rounded-xl bg-[#F2F6FB] border border-[#DCE6F2]">
                      <div className="flex items-center gap-1.5 text-[11.5px] font-extrabold text-[#14243D]">
                        <span className="w-2.5 h-2.5 rounded-[3px] bg-[#1259A7] shrink-0" />
                        <span style={{ lineHeight: 1.4, letterSpacing: '0px' }}>
                          {isAr ? 'المركبات المبيعة' : 'Sold Vehicles'}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between mt-0.5 ps-3.5">
                        <span className="text-[15px] font-black font-en tabular-nums text-[#14243D]">
                          {metrics.totalSold.toLocaleString('en-US')}
                        </span>
                        <span
                          dir="ltr"
                          className="text-[11.5px] font-black text-[#1259A7] font-en tabular-nums"
                        >
                          ({metrics.overallSaleRate.toFixed(1)}%)
                        </span>
                      </div>
                    </div>

                    <div className="px-2.5 py-2 rounded-xl bg-[#FEF4F4] border border-[#FADBD8]">
                      <div className="flex items-center gap-1.5 text-[11.5px] font-extrabold text-[#14243D]">
                        <span className="w-2.5 h-2.5 rounded-[3px] bg-[#D62828] shrink-0" />
                        <span style={{ lineHeight: 1.4, letterSpacing: '0px' }}>
                          {isAr ? 'المركبات غير المبيعة' : 'Unsold Vehicles'}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between mt-0.5 ps-3.5">
                        <span className="text-[15px] font-black font-en tabular-nums text-[#D62828]">
                          {metrics.totalUnsold.toLocaleString('en-US')}
                        </span>
                        <span
                          dir="ltr"
                          className="text-[11.5px] font-black text-[#D62828] font-en tabular-nums"
                        >
                          ({metrics.overallUnsoldRate.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-4 py-2 bg-[#F8FAFC] border-t border-[#E2E8F0] shrink-0">
                  <div className="flex items-center justify-between text-[11.5px] font-extrabold mb-1">
                    <span
                      style={{ lineHeight: 1.45, letterSpacing: '0px' }}
                      className="text-[#475569]"
                    >
                      {isAr
                        ? 'مؤشر نسبة البيع الإجمالية'
                        : 'Overall Sale Rate Index'}
                    </span>
                    <span
                      dir="ltr"
                      className="text-[#1A8F3E] font-black font-en tabular-nums"
                    >
                      {metrics.overallSaleRate.toFixed(1)}%
                    </span>
                  </div>
                  <div
                    dir="ltr"
                    className="w-full h-2.5 bg-[#E2E8F0] rounded-full overflow-hidden flex"
                  >
                    <div
                      style={{
                        width: `${Math.min(100, metrics.overallSaleRate)}%`,
                        background:
                          'linear-gradient(90deg, #1259A7 0%, #1A8F3E 100%)',
                      }}
                      className="h-full"
                    />
                    <div
                      style={{
                        width: `${Math.min(100, metrics.overallUnsoldRate)}%`,
                      }}
                      className="h-full bg-[#D62828]"
                    />
                  </div>
                </div>
              </div>

              {/* Vehicle Auctions Visual Showcase Card (4 cols) */}
              <div className="col-span-4 bg-white border border-[#CBD5E1] rounded-[14px] overflow-hidden flex flex-col justify-between">
                <div
                  style={{
                    background:
                      'linear-gradient(135deg, #175A9C 0%, #123B70 100%)',
                  }}
                  className="px-4 py-2 text-white flex items-center gap-2"
                >
                  <Gavel className="w-4 h-4 text-[#D6A348] shrink-0" />
                  <h3
                    style={{ lineHeight: 1.5, letterSpacing: '0px' }}
                    className="text-[14px] font-extrabold m-0"
                  >
                    {isAr
                      ? 'ساحات مزادات المركبات'
                      : 'Vehicle Auctions Showcase'}
                  </h3>
                </div>

                <div className="relative flex-1 min-h-[175px] overflow-hidden bg-[#123B70]">
                  <img
                    src={`${assetBase}assets/auction_yard_showcase.jpg`}
                    onError={(e) => {
                      e.currentTarget.src = `${assetBase}assets/dashboard_cars_photo.png`;
                    }}
                    alt="SAAED Vehicle Auctions"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover object-center"
                  />
                  <div
                    style={{
                      background:
                        'linear-gradient(0deg, rgba(13,43,82,0.92) 0%, rgba(18,59,112,0.28) 55%, rgba(18,59,112,0) 100%)',
                    }}
                    className="absolute inset-0"
                  />
                  <div className="absolute bottom-2.5 inset-x-3.5 text-white">
                    <div
                      style={{ lineHeight: 1.5, letterSpacing: '0px' }}
                      className="text-[13.5px] font-black"
                    >
                      {isAr
                        ? `ساحات مزادات شركة ساعد — شهر ${monthNameAr} ${selectedPeriod.year}`
                        : `SAAED Official Auction Yards — ${monthNameEn} ${selectedPeriod.year}`}
                    </div>
                    <div
                      style={{ lineHeight: 1.45, letterSpacing: '0px' }}
                      className="text-[11px] font-bold text-[#E2E8F0] mt-0.5"
                    >
                      {isAr
                        ? 'تنظيم وإدارة مزادات المركبات وفق أعلى المعايير التشغيلية'
                        : 'Enterprise vehicle auction management & operational analytics'}
                    </div>
                  </div>
                </div>

                <div className="px-4 py-2 bg-[#F8FAFC] border-t border-[#E2E8F0] grid grid-cols-2 gap-2 text-center">
                  <div className="bg-white border border-[#E2E8F0] rounded-lg py-1 px-2">
                    <div
                      style={{ lineHeight: 1.4, letterSpacing: '0px' }}
                      className="text-[11px] font-bold text-[#64748B]"
                    >
                      {isAr ? 'معدل المركبات لكل مزاد' : 'Avg Listed / Auction'}
                    </div>
                    <div className="text-[14.5px] font-black text-[#123B70] font-en tabular-nums">
                      {metrics.totalAuctions > 0
                        ? Math.round(
                            metrics.totalListed / metrics.totalAuctions
                          ).toLocaleString('en-US')
                        : 0}
                    </div>
                  </div>
                  <div className="bg-white border border-[#E2E8F0] rounded-lg py-1 px-2">
                    <div
                      style={{ lineHeight: 1.4, letterSpacing: '0px' }}
                      className="text-[11px] font-bold text-[#64748B]"
                    >
                      {isAr ? 'معدل المبيعات لكل مزاد' : 'Avg Sold / Auction'}
                    </div>
                    <div className="text-[14.5px] font-black text-[#16843B] font-en tabular-nums">
                      {metrics.avgSoldPerAuction.toLocaleString('en-US')}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {renderPageFooter(pageNum)}
          </div>
        );
      })()}

      {/* ===================================================================
          PAGE 2: VISUAL CHARTS ANALYSIS (CLUSTERED BAR + HORIZONTAL SALE RATE)
         =================================================================== */}
      {(() => {
        runningPageNumber += 1;
        const pageNum = runningPageNumber;
        return (
          <div
            key={`page-${pageNum}`}
            style={{ width: `${pageWidthPx}px`, height: `${pageHeightPx}px` }}
            className="official-report-page bg-[#F4F7FB] text-[#14243D] p-5 flex flex-col justify-between box-border overflow-hidden border border-[#CBD5E1] shadow-lg print:shadow-none print:border-none"
          >
            {renderCompactHeader(
              'التحليل البياني لأداء المزادات ونسب النجاح',
              'Visual Performance & Sale Success Rate Analysis',
              pageNum
            )}

            <div className="grid grid-cols-12 gap-4 flex-1 items-stretch min-h-0 my-1">
              {/* Left/Right Col 1 (7 cols): Clustered Column Chart with Explicit Data Values */}
              <div className="col-span-7 bg-white border border-[#CBD5E1] rounded-[14px] overflow-hidden flex flex-col justify-between">
                <div
                  style={{
                    background:
                      'linear-gradient(135deg, #175A9C 0%, #123B70 60%, #0B2F5B 100%)',
                  }}
                  className="px-4 py-2 text-white flex items-center justify-between shrink-0"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-[8px] bg-white/12 border border-white/15 flex items-center justify-center shrink-0">
                      <BarChart3 className="w-4 h-4 text-[#E2AD42]" />
                    </div>
                    <h3
                      style={{ lineHeight: 1.5, letterSpacing: '0px' }}
                      className="text-[14.5px] font-extrabold m-0"
                    >
                      {isAr
                        ? 'مقارنة أداء المزادات (المدرجة / المبيعة / غير المبيعة)'
                        : 'Auction Performance Comparison (Listed / Sold / Unsold)'}
                    </h3>
                  </div>
                  <span
                    style={{ lineHeight: 1.45, letterSpacing: '0px' }}
                    className="text-[11.5px] font-bold text-[#E2BB70]"
                  >
                    {`${monthNameAr} ${selectedPeriod.year}`}
                  </span>
                </div>

                {/* Panoramic Hero Image with Smooth Bottom White Fade */}
                <div className="auction-card-hero h-[112px] shrink-0">
                  <img
                    src={`${assetBase}assets/card_comparison_hero.jpg`}
                    onError={(e) => {
                      e.currentTarget.src = `${assetBase}assets/auction_yard_showcase.jpg`;
                    }}
                    alt={
                      isAr
                        ? 'مقارنة أداء المزادات'
                        : 'Auction performance comparison'
                    }
                    referrerPolicy="no-referrer"
                    className="object-center"
                  />
                </div>

                <div
                  dir="ltr"
                  className="relative flex-1 flex flex-col justify-center px-5 py-2"
                >
                  {auctions.length === 0 ? (
                    <div
                      dir={isAr ? 'rtl' : 'ltr'}
                      style={{ lineHeight: 1.5, letterSpacing: '0px' }}
                      className="text-center text-[14px] font-extrabold text-[#64748B] py-12"
                    >
                      {isAr
                        ? `لا توجد مزادات مسجلة لشهر ${monthNameAr} ${selectedPeriod.year}`
                        : `No auctions recorded for ${monthNameEn} ${selectedPeriod.year}`}
                    </div>
                  ) : (
                    <svg
                      viewBox="0 0 620 296"
                      className="w-full h-full max-h-[305px] overflow-visible"
                    >
                      {/* Grid Lines */}
                      {standardTicks.map((tick) => {
                        const y = 248 - (tick / yAxisMax) * 212;
                        return (
                          <g key={tick}>
                            <line
                              x1="48"
                              y1={y}
                              x2="600"
                              y2={y}
                              stroke="#E2E8F0"
                              strokeDasharray={tick === 0 ? undefined : '4 4'}
                              strokeWidth="1"
                            />
                            <text
                              x="40"
                              y={y + 4}
                              textAnchor="end"
                              fill="#64748B"
                              fontSize="11.5"
                              fontWeight="800"
                              className="font-en tabular-nums"
                            >
                              {tick}
                            </text>
                          </g>
                        );
                      })}

                      {auctions.slice(0, 12).map((auc, i) => {
                        const visibleList = auctions.slice(0, 12);
                        const count = Math.max(1, visibleList.length);
                        const slotWidth = 548 / count;
                        const groupCenter = 50 + slotWidth * i + slotWidth / 2;
                        const barWidth = Math.min(
                          22,
                          Math.max(10, slotWidth * 0.22)
                        );

                        const listedH = (auc.listedVehicles / yAxisMax) * 212;
                        const soldH = (auc.soldVehicles / yAxisMax) * 212;
                        const unsoldH = (auc.unsoldVehicles / yAxisMax) * 212;

                        return (
                          <g key={auc.id}>
                            {/* Listed Bar */}
                            <rect
                              x={groupCenter - barWidth * 1.5 - 2}
                              y={248 - listedH}
                              width={barWidth}
                              height={Math.max(2, listedH)}
                              fill="#1259A7"
                              rx="3"
                            />
                            <text
                              x={groupCenter - barWidth - 2}
                              y={248 - listedH - 5}
                              textAnchor="middle"
                              fill="#1259A7"
                              fontSize="9.5"
                              fontWeight="800"
                              className="font-en tabular-nums"
                            >
                              {auc.listedVehicles}
                            </text>

                            {/* Sold Bar */}
                            <rect
                              x={groupCenter - barWidth * 0.5}
                              y={248 - soldH}
                              width={barWidth}
                              height={Math.max(2, soldH)}
                              fill="#1A8F3E"
                              rx="3"
                            />
                            <text
                              x={groupCenter}
                              y={248 - soldH - 5}
                              textAnchor="middle"
                              fill="#1A8F3E"
                              fontSize="9.5"
                              fontWeight="800"
                              className="font-en tabular-nums"
                            >
                              {auc.soldVehicles}
                            </text>

                            {/* Unsold Bar */}
                            <rect
                              x={groupCenter + barWidth * 0.5 + 2}
                              y={248 - unsoldH}
                              width={barWidth}
                              height={Math.max(2, unsoldH)}
                              fill="#D62828"
                              rx="3"
                            />
                            <text
                              x={groupCenter + barWidth + 2}
                              y={248 - unsoldH - 5}
                              textAnchor="middle"
                              fill="#D62828"
                              fontSize="9.5"
                              fontWeight="800"
                              className="font-en tabular-nums"
                            >
                              {auc.unsoldVehicles}
                            </text>

                            {/* Auction Code on X-Axis */}
                            <text
                              x={groupCenter}
                              y="270"
                              textAnchor="middle"
                              fill="#14243D"
                              fontSize="11"
                              fontWeight="900"
                              className="font-en"
                            >
                              {auc.auctionNumber}
                            </text>
                          </g>
                        );
                      })}

                      <line
                        x1="48"
                        y1="248"
                        x2="600"
                        y2="248"
                        stroke="#64748B"
                        strokeWidth="1.5"
                      />
                    </svg>
                  )}
                </div>

                {/* Legend */}
                <div
                  dir={isAr ? 'rtl' : 'ltr'}
                  style={{ lineHeight: 1.5, letterSpacing: '0px' }}
                  className="px-4 py-2.5 bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-center justify-center gap-6 text-[12.5px] font-extrabold text-[#14243D] shrink-0"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-[3px] bg-[#1259A7] shrink-0" />
                    <span>
                      {isAr ? 'المركبات المدرجة:' : 'Listed Vehicles:'}
                    </span>
                    <span className="font-en font-black text-[#1259A7] tabular-nums">
                      {metrics.totalListed.toLocaleString('en-US')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-[3px] bg-[#1A8F3E] shrink-0" />
                    <span>
                      {isAr ? 'المركبات المبيعة:' : 'Sold Vehicles:'}
                    </span>
                    <span className="font-en font-black text-[#1A8F3E] tabular-nums">
                      {metrics.totalSold.toLocaleString('en-US')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-[3px] bg-[#D62828] shrink-0" />
                    <span>
                      {isAr ? 'المركبات غير المبيعة:' : 'Unsold Vehicles:'}
                    </span>
                    <span className="font-en font-black text-[#D62828] tabular-nums">
                      {metrics.totalUnsold.toLocaleString('en-US')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Col 2 (5 cols): Horizontal Sale Success Rate Ranking */}
              <div className="col-span-5 bg-white border border-[#CBD5E1] rounded-[14px] overflow-hidden flex flex-col justify-between">
                <div
                  style={{
                    background:
                      'linear-gradient(135deg, #175A9C 0%, #123B70 60%, #0B2F5B 100%)',
                  }}
                  className="px-4 py-2 text-white flex items-center justify-between shrink-0"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-[8px] bg-white/12 border border-white/15 flex items-center justify-center shrink-0">
                      <TrendingUp className="w-4 h-4 text-[#E2AD42]" />
                    </div>
                    <h3
                      style={{ lineHeight: 1.5, letterSpacing: '0px' }}
                      className="text-[14.5px] font-extrabold m-0"
                    >
                      {isAr
                        ? 'نسبة نجاح البيع حسب المزاد (تنازليًا)'
                        : 'Sale Success Rate by Auction (Descending)'}
                    </h3>
                  </div>
                </div>

                {/* Panoramic Hero Image with Smooth Bottom White Fade */}
                <div className="auction-card-hero h-[112px] shrink-0">
                  <img
                    src={`${assetBase}assets/card_success_rate_hero.jpg`}
                    onError={(e) => {
                      e.currentTarget.src = `${assetBase}assets/auction_yard_showcase.jpg`;
                    }}
                    alt={
                      isAr
                        ? 'نسبة نجاح البيع حسب المزاد'
                        : 'Sale success rate by auction'
                    }
                    referrerPolicy="no-referrer"
                    className="object-[50%_62%]"
                  />
                </div>

                <div
                  dir="ltr"
                  className="flex-1 flex flex-col justify-center space-y-2.5 px-5 py-2"
                >
                  {sortedBySaleRate.length === 0 ? (
                    <div
                      dir={isAr ? 'rtl' : 'ltr'}
                      style={{ lineHeight: 1.5, letterSpacing: '0px' }}
                      className="text-center text-sm font-bold text-[#64748B]"
                    >
                      {isAr
                        ? `لا توجد مزادات مسجلة لشهر ${monthNameAr} ${selectedPeriod.year}`
                        : `No auctions recorded for ${monthNameEn} ${selectedPeriod.year}`}
                    </div>
                  ) : (
                    sortedBySaleRate.slice(0, 10).map((auc, idx) => {
                      const barGradients = [
                        'linear-gradient(90deg, #16843B 0%, #22A04B 100%)',
                        'linear-gradient(90deg, #1A8F3E 0%, #2BA853 100%)',
                        'linear-gradient(90deg, #259B4A 0%, #3BB862 100%)',
                        'linear-gradient(90deg, #35AA59 0%, #52C474 100%)',
                        'linear-gradient(90deg, #4BB868 0%, #68CE82 100%)',
                      ];
                      const barBg =
                        barGradients[Math.min(idx, barGradients.length - 1)];

                      return (
                        <div
                          key={auc.id}
                          className="flex items-center gap-3 text-[12px] font-extrabold"
                        >
                          <span className="auction-id w-[72px] justify-end font-en font-black text-[#123B70] text-[12.5px] shrink-0">
                            {auc.auctionNumber}
                          </span>

                          <div className="flex-1 h-[18px] bg-[#EEF3F9] rounded-[6px] relative flex items-center overflow-hidden border border-[#E2E8F0]">
                            <div
                              style={{
                                width: `${Math.min(100, Math.max(4, auc.saleRate))}%`,
                                background: barBg,
                              }}
                              className="h-full rounded-[5px]"
                            />
                          </div>

                          <div className="w-[102px] flex items-center justify-between shrink-0 font-en tabular-nums">
                            <span className="text-[12.5px] font-black text-[#1A8F3E]">
                              {auc.saleRate.toFixed(1)}%
                            </span>
                            <span className="text-[10.5px] font-bold text-[#64748B]">
                              ({auc.soldVehicles}/{auc.listedVehicles})
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Scale 0% .. 100% */}
                <div
                  dir="ltr"
                  className="ps-[92px] pe-[122px] py-2.5 bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-center justify-between text-[11px] font-extrabold font-en text-[#64748B] tabular-nums shrink-0"
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

            {renderPageFooter(pageNum)}
          </div>
        );
      })()}

      {/* ===================================================================
          PAGES 3..N: DETAILED AUCTION DATA TABLE (PAGINATED WITH REPEATED HEADER)
         =================================================================== */}
      {dataTableChunks.map((chunk, chunkIdx) => {
        runningPageNumber += 1;
        const pageNum = runningPageNumber;
        const isLastChunk = chunkIdx === dataTableChunks.length - 1;
        const startRowNumber = chunkIdx * dataTableRowsPerPage + 1;

        return (
          <div
            key={`page-${pageNum}`}
            style={{ width: `${pageWidthPx}px`, height: `${pageHeightPx}px` }}
            className="official-report-page bg-[#F4F7FB] text-[#14243D] p-5 flex flex-col justify-between box-border overflow-hidden border border-[#CBD5E1] shadow-lg print:shadow-none print:border-none"
          >
            {renderCompactHeader(
              dataTableChunks.length > 1
                ? `جدول بيانات المزادات التفصيلي — الجزء ${chunkIdx + 1} من ${dataTableChunks.length}`
                : 'جدول بيانات المزادات التفصيلي',
              dataTableChunks.length > 1
                ? `Detailed Auction Data Report (${chunkIdx + 1} of ${dataTableChunks.length})`
                : 'Detailed Auction Data Report',
              pageNum
            )}

            <div className="flex-1 bg-white border border-[#CBD5E1] rounded-[14px] overflow-hidden flex flex-col justify-between my-1">
              <table className="report-table w-full border-collapse text-center">
                <thead>
                  <tr
                    style={{
                      background:
                        'linear-gradient(180deg, #175A9C 0%, #123B70 100%)',
                      lineHeight: 1.5,
                      letterSpacing: '0px',
                    }}
                    className="text-white text-[12.5px] font-extrabold"
                  >
                    <th className="py-2.5 px-2 border border-[#24528A] w-[40px]">
                      {isAr ? 'م' : '#'}
                    </th>
                    <th className="py-2.5 px-2 border border-[#24528A] w-[92px] whitespace-nowrap">
                      {isAr ? 'رقم المزاد' : 'Auction ID'}
                    </th>
                    <th className="py-2.5 px-2 border border-[#24528A] w-[100px] whitespace-nowrap">
                      {isAr ? 'تاريخ المزاد' : 'Auction Date'}
                    </th>
                    <th className="py-2.5 px-2 border border-[#24528A] w-[108px] whitespace-nowrap">
                      {isAr ? 'مدة عرض المزاد' : 'Duration'}
                    </th>
                    <th className="py-2.5 px-2 border border-[#24528A] w-[88px] whitespace-nowrap">
                      {isAr ? 'المركبات المدرجة' : 'Listed'}
                    </th>
                    <th className="py-2.5 px-2 border border-[#24528A] w-[88px] whitespace-nowrap">
                      {isAr ? 'المركبات المبيعة' : 'Sold'}
                    </th>
                    <th className="py-2.5 px-2 border border-[#24528A] w-[90px] whitespace-nowrap">
                      {isAr ? 'غير المبيعة' : 'Unsold'}
                    </th>
                    <th className="py-2.5 px-3 border border-[#24528A]">
                      {isAr ? 'الملاحظات' : 'Operational Notes'}
                    </th>
                    <th className="py-2.5 px-3 border border-[#24528A]">
                      {isAr ? 'التحديات' : 'Challenges'}
                    </th>
                    <th className="py-2.5 px-3 border border-[#24528A]">
                      {isAr ? 'التوصيات' : 'Recommendations'}
                    </th>
                  </tr>
                </thead>
                <tbody
                  style={{ lineHeight: 1.55, letterSpacing: '0px' }}
                  className="text-[12px] font-bold text-[#14243D]"
                >
                  {chunk.length === 0 ? (
                    <tr>
                      <td
                        colSpan={10}
                        className="py-16 text-center text-[14px] font-extrabold text-[#64748B]"
                      >
                        {isAr
                          ? `لا توجد مزادات مسجلة لشهر ${monthNameAr} ${selectedPeriod.year}`
                          : `No auctions recorded for ${monthNameEn} ${selectedPeriod.year}`}
                      </td>
                    </tr>
                  ) : (
                    chunk.map((auc, idx) => (
                      <tr
                        key={auc.id}
                        className={
                          idx % 2 === 0 ? 'bg-white' : 'bg-[#F4F7FB]'
                        }
                      >
                        <td className="py-2.5 px-2 border border-[#CBD5E1] font-en font-black tabular-nums">
                          {startRowNumber + idx}
                        </td>
                        <td className="py-2.5 px-2 border border-[#CBD5E1] whitespace-nowrap">
                          <span className="auction-id font-en font-black text-[#123B70] text-[12.5px]">
                            {auc.auctionNumber}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 border border-[#CBD5E1] whitespace-nowrap">
                          {auc.auctionDate ? (
                            <span className="font-en font-extrabold tabular-nums text-[#14243D]">
                              {formatAuctionDateDisplay(auc.auctionDate, lang)}
                            </span>
                          ) : (
                            <span className="text-[#64748B] font-bold text-[11px]">
                              {formatAuctionDateDisplay(undefined, lang)}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 border border-[#CBD5E1] font-extrabold">
                          {isAr ? auc.durationAr : auc.durationEn}
                        </td>
                        <td className="py-2.5 px-2 border border-[#CBD5E1] font-en font-black tabular-nums text-[13px]">
                          {auc.listedVehicles.toLocaleString('en-US')}
                        </td>
                        <td className="py-2.5 px-2 border border-[#CBD5E1] font-en font-black tabular-nums text-[13px] text-[#16843B]">
                          {auc.soldVehicles.toLocaleString('en-US')}
                        </td>
                        <td className="py-2.5 px-2 border border-[#CBD5E1] font-en font-black tabular-nums text-[13px] text-[#C52B36]">
                          {auc.unsoldVehicles.toLocaleString('en-US')}
                        </td>
                        <td className="py-2 px-3 border border-[#CBD5E1] text-right whitespace-normal break-words">
                          {isAr ? auc.notesAr : auc.notesEn}
                        </td>
                        <td className="py-2 px-3 border border-[#CBD5E1] text-right whitespace-normal break-words">
                          {isAr ? auc.challengesAr : auc.challengesEn}
                        </td>
                        <td className="py-2 px-3 border border-[#CBD5E1] text-right whitespace-normal break-words">
                          {isAr
                            ? auc.recommendationsAr
                            : auc.recommendationsEn}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {isLastChunk && (
                  <tfoot>
                    <tr
                      style={{ lineHeight: 1.5, letterSpacing: '0px' }}
                      className="bg-[#123B70] text-white font-black text-[13.5px]"
                    >
                      <td
                        colSpan={4}
                        className="py-2.5 px-4 border border-[#123B70] text-center"
                      >
                        {isAr ? 'الإجمالي العام للشهر' : 'Monthly Grand Total'}
                      </td>
                      <td className="py-2.5 px-2 border border-[#24528A] bg-[#D6A348] text-[#14243D] font-en tabular-nums text-[15px]">
                        {metrics.totalListed.toLocaleString('en-US')}
                      </td>
                      <td className="py-2.5 px-2 border border-[#24528A] bg-[#E5BA63] text-[#14243D] font-en tabular-nums text-[15px]">
                        {metrics.totalSold.toLocaleString('en-US')}
                      </td>
                      <td className="py-2.5 px-2 border border-[#24528A] bg-[#D6A348] text-[#14243D] font-en tabular-nums text-[15px]">
                        {metrics.totalUnsold.toLocaleString('en-US')}
                      </td>
                      <td
                        colSpan={3}
                        className="py-2.5 px-4 border border-[#123B70] text-center text-[12.5px] text-[#F8FAFC]"
                      >
                        <div className="flex items-center justify-center gap-4">
                          <span>
                            {isAr ? 'نسبة البيع الإجمالية:' : 'Overall Sale Rate:'}{' '}
                            <strong dir="ltr" className="font-en text-[#86EFAC]">
                              {metrics.overallSaleRate.toFixed(1)}%
                            </strong>
                          </span>
                          <span>|</span>
                          <span>
                            {isAr ? 'نسبة عدم البيع:' : 'Unsold Rate:'}{' '}
                            <strong dir="ltr" className="font-en text-[#FCA5A5]">
                              {metrics.overallUnsoldRate.toFixed(1)}%
                            </strong>
                          </span>
                        </div>
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {renderPageFooter(pageNum)}
          </div>
        );
      })}

      {/* ===================================================================
          PAGES 4..N: COMPARATIVE ANALYSIS TABLE & OPERATIONAL INSIGHTS
         =================================================================== */}
      {compTableChunks.map((compChunk, cIdx) => {
        runningPageNumber += 1;
        const pageNum = runningPageNumber;

        return (
          <div
            key={`page-${pageNum}`}
            style={{ width: `${pageWidthPx}px`, height: `${pageHeightPx}px` }}
            className="official-report-page bg-[#F4F7FB] text-[#14243D] p-5 flex flex-col justify-between box-border overflow-hidden border border-[#CBD5E1] shadow-lg print:shadow-none print:border-none"
          >
            {renderCompactHeader(
              splitOpsToSeparatePage
                ? 'التحليل المقارن لأداء المزادات'
                : 'التحليل المقارن والملاحظات والتحديات والتوصيات التنفيذية',
              splitOpsToSeparatePage
                ? 'Comparative Auction Performance Analysis'
                : 'Comparative Analysis & Executive Operational Insights',
              pageNum
            )}

            <div className="flex-1 flex flex-col gap-3.5 my-1 min-h-0">
              {/* Comparative Analysis Table */}
              <div className="bg-white border border-[#CBD5E1] rounded-[14px] overflow-hidden flex flex-col">
                <div
                  style={{
                    background:
                      'linear-gradient(135deg, #175A9C 0%, #123B70 100%)',
                  }}
                  className="px-4 py-2 text-white flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <FileCheck2 className="w-4 h-4 text-[#D6A348] shrink-0" />
                    <h3
                      style={{ lineHeight: 1.5, letterSpacing: '0px' }}
                      className="text-[14px] font-extrabold m-0"
                    >
                      {isAr
                        ? 'جدول التحليل المقارن لأداء المزادات'
                        : 'Comparative Auction Performance Table'}
                    </h3>
                  </div>
                  <span
                    style={{ lineHeight: 1.45, letterSpacing: '0px' }}
                    className="text-[11.5px] font-bold text-[#E2BB70]"
                  >
                    {`${monthNameAr} ${selectedPeriod.year}`}
                  </span>
                </div>

                <table className="report-table w-full border-collapse text-center text-[12px] font-bold">
                  <thead>
                    <tr
                      style={{ lineHeight: 1.5, letterSpacing: '0px' }}
                      className="bg-[#123B70] text-white font-extrabold"
                    >
                      <th className="py-2 px-2.5 border border-[#24528A] whitespace-nowrap">
                        {isAr ? 'رقم المزاد' : 'Auction ID'}
                      </th>
                      <th className="py-2 px-2.5 border border-[#24528A] whitespace-nowrap">
                        {isAr ? 'تاريخ المزاد' : 'Auction Date'}
                      </th>
                      <th className="py-2 px-2.5 border border-[#24528A] whitespace-nowrap">
                        {isAr ? 'المركبات المدرجة' : 'Listed Vehicles'}
                      </th>
                      <th className="py-2 px-2.5 border border-[#24528A] whitespace-nowrap">
                        {isAr ? 'المركبات المبيعة' : 'Sold Vehicles'}
                      </th>
                      <th className="py-2 px-2.5 border border-[#24528A] whitespace-nowrap">
                        {isAr ? 'المركبات غير المبيعة' : 'Unsold Vehicles'}
                      </th>
                      <th className="py-2 px-2.5 border border-[#24528A] whitespace-nowrap">
                        {isAr ? 'نسبة البيع' : 'Sale Rate'}
                      </th>
                      <th className="py-2 px-2.5 border border-[#24528A] whitespace-nowrap">
                        {isAr ? 'نسبة عدم البيع' : 'Unsold Rate'}
                      </th>
                      <th className="py-2 px-2.5 border border-[#24528A] whitespace-nowrap">
                        {isAr ? 'تقييم الأداء' : 'Performance Evaluation'}
                      </th>
                    </tr>
                  </thead>
                  <tbody
                    style={{ lineHeight: 1.5, letterSpacing: '0px' }}
                    className="text-[#14243D]"
                  >
                    {compChunk.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="py-8 text-center text-[#64748B]"
                        >
                          {isAr
                            ? `لا توجد بيانات مقارنة لشهر ${monthNameAr} ${selectedPeriod.year}`
                            : `No comparative data for ${monthNameEn} ${selectedPeriod.year}`}
                        </td>
                      </tr>
                    ) : (
                      compChunk.map((auc, i) => {
                        const badge = evaluateAuctionPerformance(
                          auc.saleRate,
                          thresholds,
                          lang
                        );
                        return (
                          <tr
                            key={auc.id}
                            className={
                              i % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]'
                            }
                          >
                            <td className="py-1.5 px-2.5 border border-[#CBD5E1] whitespace-nowrap">
                              <span className="auction-id font-en font-black text-[#123B70]">
                                {auc.auctionNumber}
                              </span>
                            </td>
                            <td className="py-1.5 px-2.5 border border-[#CBD5E1] whitespace-nowrap">
                              {auc.auctionDate ? (
                                <span className="font-en font-extrabold tabular-nums text-[#14243D]">
                                  {formatAuctionDateDisplay(auc.auctionDate, lang)}
                                </span>
                              ) : (
                                <span className="text-[#64748B] font-bold text-[11px]">
                                  {formatAuctionDateDisplay(undefined, lang)}
                                </span>
                              )}
                            </td>
                            <td className="py-1.5 px-3 border border-[#CBD5E1] font-en tabular-nums font-extrabold">
                              {auc.listedVehicles.toLocaleString('en-US')}
                            </td>
                            <td className="py-1.5 px-3 border border-[#CBD5E1] font-en tabular-nums font-extrabold text-[#16843B]">
                              {auc.soldVehicles.toLocaleString('en-US')}
                            </td>
                            <td className="py-1.5 px-3 border border-[#CBD5E1] font-en tabular-nums font-extrabold text-[#C52B36]">
                              {auc.unsoldVehicles.toLocaleString('en-US')}
                            </td>
                            <td className="py-1.5 px-3 border border-[#CBD5E1] font-en tabular-nums font-black text-[#16843B]">
                              <span dir="ltr">{auc.saleRate.toFixed(1)}%</span>
                            </td>
                            <td className="py-1.5 px-3 border border-[#CBD5E1] font-en tabular-nums font-extrabold text-[#64748B]">
                              <span dir="ltr">
                                {auc.unsoldRate.toFixed(1)}%
                              </span>
                            </td>
                            <td className="py-1.5 px-3 border border-[#CBD5E1]">
                              <span
                                style={{ lineHeight: 1.4, letterSpacing: '0px' }}
                                className={`inline-flex items-center justify-center px-3 py-0.5 rounded-full text-[11px] font-extrabold border ${badge.bgClass} ${badge.textClass} ${badge.borderClass}`}
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

              {/* If compact (<= 5 auctions and normal text), render the 3 Operational Cards right below on the same page */}
              {!splitOpsToSeparatePage && cIdx === 0 && (
                <div className="grid grid-cols-3 gap-3.5 flex-1 items-stretch min-h-0">
                  {/* Card 7: Operational Notes */}
                  <div className="bg-white border border-[#CBD5E1] rounded-[14px] overflow-hidden flex flex-col">
                    <div
                      style={{
                        background:
                          'linear-gradient(135deg, #175A9C 0%, #123B70 100%)',
                      }}
                      className="px-3.5 py-2 text-white flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2">
                        <ClipboardCheck className="w-4 h-4 text-[#D6A348] shrink-0" />
                        <h3
                          style={{ lineHeight: 1.5, letterSpacing: '0px' }}
                          className="text-[13.5px] font-extrabold m-0"
                        >
                          {isAr
                            ? 'أبرز الملاحظات التشغيلية'
                            : 'Key Operational Notes'}
                        </h3>
                      </div>
                      <img
                        src={`${assetBase}assets/operational_notes_inspection.jpg`}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="w-10 h-6 rounded object-cover border border-[#93C5FD] shrink-0"
                      />
                    </div>
                    <ul className="p-3 divide-y divide-[#F1F5F9] flex-1">
                      {auctions.map((auc) => (
                        <li
                          key={auc.id}
                          className="py-1.5 first:pt-0 last:pb-0 flex items-start justify-between gap-2"
                        >
                          <span
                            style={{ lineHeight: 1.55, letterSpacing: '0px' }}
                            className="text-[12px] font-bold text-[#14243D] whitespace-normal break-words"
                          >
                            • {isAr ? auc.notesAr : auc.notesEn}
                          </span>
                          <span className="auction-id font-en text-[10.5px] font-black px-2 py-0.5 rounded bg-[#F0F5FA] text-[#175A9C] border border-[#CBD5E1]">
                            {auc.auctionNumber}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Card 8: Operational Challenges */}
                  <div className="bg-white border border-[#CBD5E1] rounded-[14px] overflow-hidden flex flex-col">
                    <div
                      style={{
                        background:
                          'linear-gradient(135deg, #123B70 0%, #0D2B52 100%)',
                      }}
                      className="px-3.5 py-2 text-white flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-[#D6A348] shrink-0" />
                        <h3
                          style={{ lineHeight: 1.5, letterSpacing: '0px' }}
                          className="text-[13.5px] font-extrabold m-0"
                        >
                          {isAr
                            ? 'التحديات التشغيلية الرئيسية'
                            : 'Operational Challenges'}
                        </h3>
                      </div>
                      <img
                        src={`${assetBase}assets/operational_challenges_yard.jpg`}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="w-10 h-6 rounded object-cover border border-[#93C5FD] shrink-0"
                      />
                    </div>
                    <ul className="p-3 divide-y divide-[#F1F5F9] flex-1">
                      {auctions.map((auc) => (
                        <li
                          key={auc.id}
                          className="py-1.5 first:pt-0 last:pb-0 flex items-start justify-between gap-2"
                        >
                          <span
                            style={{ lineHeight: 1.55, letterSpacing: '0px' }}
                            className="text-[12px] font-bold text-[#14243D] whitespace-normal break-words"
                          >
                            • {isAr ? auc.challengesAr : auc.challengesEn}
                          </span>
                          <span className="auction-id font-en text-[10.5px] font-black px-2 py-0.5 rounded bg-[#FEF3F2] text-[#C52B36] border border-[#FECDCA]">
                            {auc.auctionNumber}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Card 9: Recommendations */}
                  <div className="bg-white border border-[#CBD5E1] rounded-[14px] overflow-hidden flex flex-col">
                    <div
                      style={{
                        background:
                          'linear-gradient(135deg, #2467B2 0%, #123B70 100%)',
                      }}
                      className="px-3.5 py-2 text-white flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2">
                        <Lightbulb className="w-4 h-4 text-[#D6A348] shrink-0" />
                        <h3
                          style={{ lineHeight: 1.5, letterSpacing: '0px' }}
                          className="text-[13.5px] font-extrabold m-0"
                        >
                          {isAr
                            ? 'التوصيات والإجراءات التحسينية'
                            : 'Recommendations & Actions'}
                        </h3>
                      </div>
                      <img
                        src={`${assetBase}assets/recommendations_excellence.jpg`}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="w-10 h-6 rounded object-cover border border-[#93C5FD] shrink-0"
                      />
                    </div>
                    <ul className="p-3 divide-y divide-[#F1F5F9] flex-1">
                      {auctions.map((auc) => (
                        <li
                          key={auc.id}
                          className="py-1.5 first:pt-0 last:pb-0 flex items-start justify-between gap-2"
                        >
                          <span
                            style={{ lineHeight: 1.55, letterSpacing: '0px' }}
                            className="text-[12px] font-bold text-[#14243D] whitespace-normal break-words"
                          >
                            •{' '}
                            {isAr
                              ? auc.recommendationsAr
                              : auc.recommendationsEn}
                          </span>
                          <span className="auction-id font-en text-[10.5px] font-black px-2 py-0.5 rounded bg-[#ECFDF3] text-[#16843B] border border-[#ABEFC6]">
                            {auc.auctionNumber}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>

            {renderPageFooter(pageNum)}
          </div>
        );
      })}

      {/* If there are > 5 auctions or long texts, render dedicated page(s) for Operational Notes, Challenges, and Recommendations so nothing ever clips */}
      {splitOpsToSeparatePage &&
        opsChunks.map((opsChunk, oIdx) => {
          runningPageNumber += 1;
          const pageNum = runningPageNumber;

          return (
            <div
              key={`page-${pageNum}`}
              style={{ width: `${pageWidthPx}px`, height: `${pageHeightPx}px` }}
              className="official-report-page bg-[#F4F7FB] text-[#14243D] p-5 flex flex-col justify-between box-border overflow-hidden border border-[#CBD5E1] shadow-lg print:shadow-none print:border-none"
            >
              {renderCompactHeader(
                opsChunks.length > 1
                  ? `الملاحظات والتحديات والتوصيات التشغيلية — الجزء ${oIdx + 1} من ${opsChunks.length}`
                  : 'الملاحظات والتحديات والتوصيات التشغيلية',
                opsChunks.length > 1
                  ? `Operational Notes, Challenges & Recommendations (${oIdx + 1} of ${opsChunks.length})`
                  : 'Operational Notes, Challenges & Recommendations',
                pageNum
              )}

              <div className="grid grid-cols-3 gap-4 flex-1 items-stretch min-h-0 my-1">
                {/* Card 7: Operational Notes */}
                <div className="bg-white border border-[#CBD5E1] rounded-[14px] overflow-hidden flex flex-col">
                  <div
                    style={{
                      background:
                        'linear-gradient(135deg, #175A9C 0%, #123B70 100%)',
                    }}
                    className="px-4 py-2.5 text-white flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2">
                      <ClipboardCheck className="w-4 h-4 text-[#D6A348] shrink-0" />
                      <h3
                        style={{ lineHeight: 1.5, letterSpacing: '0px' }}
                        className="text-[14px] font-extrabold m-0"
                      >
                        {isAr
                          ? 'أبرز الملاحظات التشغيلية'
                          : 'Key Operational Notes'}
                      </h3>
                    </div>
                    <img
                      src={`${assetBase}assets/operational_notes_inspection.jpg`}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="w-11 h-7 rounded object-cover border border-[#93C5FD] shrink-0"
                    />
                  </div>
                  <ul className="p-3.5 divide-y divide-[#F1F5F9] flex-1">
                    {opsChunk.map((auc) => (
                      <li
                        key={auc.id}
                        className="py-2 first:pt-0 last:pb-0 flex items-start justify-between gap-2.5"
                      >
                        <span
                          style={{ lineHeight: 1.55, letterSpacing: '0px' }}
                          className="text-[12.5px] font-bold text-[#14243D] whitespace-normal break-words"
                        >
                          • {isAr ? auc.notesAr : auc.notesEn}
                        </span>
                        <span className="auction-id font-en text-[11px] font-black px-2 py-0.5 rounded bg-[#F0F5FA] text-[#175A9C] border border-[#CBD5E1]">
                          {auc.auctionNumber}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Card 8: Operational Challenges */}
                <div className="bg-white border border-[#CBD5E1] rounded-[14px] overflow-hidden flex flex-col">
                  <div
                    style={{
                      background:
                        'linear-gradient(135deg, #123B70 0%, #0D2B52 100%)',
                    }}
                    className="px-4 py-2.5 text-white flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-[#D6A348] shrink-0" />
                      <h3
                        style={{ lineHeight: 1.5, letterSpacing: '0px' }}
                        className="text-[14px] font-extrabold m-0"
                      >
                        {isAr
                          ? 'التحديات التشغيلية الرئيسية'
                          : 'Operational Challenges'}
                      </h3>
                    </div>
                    <img
                      src={`${assetBase}assets/operational_challenges_yard.jpg`}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="w-11 h-7 rounded object-cover border border-[#93C5FD] shrink-0"
                    />
                  </div>
                  <ul className="p-3.5 divide-y divide-[#F1F5F9] flex-1">
                    {opsChunk.map((auc) => (
                      <li
                        key={auc.id}
                        className="py-2 first:pt-0 last:pb-0 flex items-start justify-between gap-2.5"
                      >
                        <span
                          style={{ lineHeight: 1.55, letterSpacing: '0px' }}
                          className="text-[12.5px] font-bold text-[#14243D] whitespace-normal break-words"
                        >
                          • {isAr ? auc.challengesAr : auc.challengesEn}
                        </span>
                        <span className="auction-id font-en text-[11px] font-black px-2 py-0.5 rounded bg-[#FEF3F2] text-[#C52B36] border border-[#FECDCA]">
                          {auc.auctionNumber}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Card 9: Recommendations */}
                <div className="bg-white border border-[#CBD5E1] rounded-[14px] overflow-hidden flex flex-col">
                  <div
                    style={{
                      background:
                        'linear-gradient(135deg, #2467B2 0%, #123B70 100%)',
                    }}
                    className="px-4 py-2.5 text-white flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-[#D6A348] shrink-0" />
                      <h3
                        style={{ lineHeight: 1.5, letterSpacing: '0px' }}
                        className="text-[14px] font-extrabold m-0"
                      >
                        {isAr
                          ? 'التوصيات والإجراءات التحسينية'
                          : 'Recommendations & Actions'}
                      </h3>
                    </div>
                    <img
                      src={`${assetBase}assets/recommendations_excellence.jpg`}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="w-11 h-7 rounded object-cover border border-[#93C5FD] shrink-0"
                    />
                  </div>
                  <ul className="p-3.5 divide-y divide-[#F1F5F9] flex-1">
                    {opsChunk.map((auc) => (
                      <li
                        key={auc.id}
                        className="py-2 first:pt-0 last:pb-0 flex items-start justify-between gap-2.5"
                      >
                        <span
                          style={{ lineHeight: 1.55, letterSpacing: '0px' }}
                          className="text-[12.5px] font-bold text-[#14243D] whitespace-normal break-words"
                        >
                          •{' '}
                          {isAr
                            ? auc.recommendationsAr
                            : auc.recommendationsEn}
                        </span>
                        <span className="auction-id font-en text-[11px] font-black px-2 py-0.5 rounded bg-[#ECFDF3] text-[#16843B] border border-[#ABEFC6]">
                          {auc.auctionNumber}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {renderPageFooter(pageNum)}
            </div>
          );
        })}
    </div>
  );
};

/* ============================================================================
   OFFICIAL PRINT PREVIEW MODAL (معاينة التقرير الرسمية قبل الطباعة والتصدير)
   ============================================================================ */
interface OfficialReportPreviewModalProps {
  isOpen: boolean;
  auctions: AuctionRecord[];
  metrics: ComputedAuctionMetrics;
  metadata: ReportMetadata;
  thresholds: PerformanceThresholds;
  selectedPeriod: ReportingPeriod;
  lang: Language;
  paperSize: PaperSizeOption;
  isExportingPdf: boolean;
  onChangePaperSize: (size: PaperSizeOption) => void;
  onClose: () => void;
  onPrintOfficial: () => void;
  onExportPdfOfficial: () => void;
}

export const OfficialReportPreviewModal: React.FC<
  OfficialReportPreviewModalProps
> = ({
  isOpen,
  auctions,
  metrics,
  metadata,
  thresholds,
  selectedPeriod,
  lang,
  paperSize,
  isExportingPdf,
  onChangePaperSize,
  onClose,
  onPrintOfficial,
  onExportPdfOfficial,
}) => {
  const [zoom, setZoom] = React.useState<number>(0.85);
  const isAr = lang === 'ar';
  const monthName = getMonthName(selectedPeriod.month, lang);

  if (!isOpen) return null;

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="no-print fixed inset-0 z-50 bg-[#0A192F]/90 backdrop-blur-xs flex flex-col overflow-hidden"
    >
      {/* Top Preview Control Bar (Strictly outside printed area) */}
      <div className="bg-[#0E2E58] text-white border-b border-[#24528A] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-lg shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#D6A348]/20 border border-[#D6A348] flex items-center justify-center">
            <Layers className="w-5 h-5 text-[#D6A348]" />
          </div>
          <div>
            <h2 className="text-[15px] font-black text-white leading-normal">
              {isAr
                ? `معاينة التقرير التنفيذي الرسمي — شهر ${monthName} ${selectedPeriod.year}`
                : `Official Executive Report Preview — ${monthName} ${selectedPeriod.year}`}
            </h2>
            <p className="text-[11.5px] font-bold text-white/80">
              {isAr
                ? 'ما تشاهده في هذه المعاينة مطابق تمامًا لما يتم طباعته وتصديره إلى PDF (A4 / A3 Landscape)'
                : 'What You Preview Is What You Print and Export (Multi-Page Official Layout)'}
            </p>
          </div>
        </div>

        {/* Paper Size & Zoom Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Paper Size Toggle: A4 Landscape vs A3 Landscape */}
          <div className="flex items-center bg-[#081F3D] p-1 rounded-xl border border-[#24528A]">
            <button
              type="button"
              onClick={() => onChangePaperSize('a4')}
              className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-colors cursor-pointer ${
                paperSize === 'a4'
                  ? 'bg-[#D6A348] text-[#0A1E3C]'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              A4 أفقي (297×210mm)
            </button>
            <button
              type="button"
              onClick={() => onChangePaperSize('a3')}
              className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-colors cursor-pointer ${
                paperSize === 'a3'
                  ? 'bg-[#D6A348] text-[#0A1E3C]'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              A3 أفقي (420×297mm)
            </button>
          </div>

          {/* Zoom Controls (Preview Only) */}
          <div className="flex items-center gap-1 bg-[#081F3D] px-2 py-1 rounded-xl border border-[#24528A]">
            <button
              type="button"
              onClick={() =>
                setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))
              }
              title={isAr ? 'تصغير المعاينة' : 'Zoom Out'}
              className="p-1 rounded hover:bg-white/10 text-white cursor-pointer"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="px-2 text-xs font-en font-black tabular-nums text-[#D6A348]">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() =>
                setZoom((z) => Math.min(1.3, +(z + 0.1).toFixed(2)))
              }
              title={isAr ? 'تكبير المعاينة' : 'Zoom In'}
              className="p-1 rounded hover:bg-white/10 text-white cursor-pointer"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(0.85)}
              title={isAr ? 'إعادة ضبط التكبير' : 'Reset Zoom'}
              className="p-1 rounded hover:bg-white/10 text-white/75 hover:text-white cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Print Official Report Button */}
          <button
            type="button"
            onClick={onPrintOfficial}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-extrabold bg-[#175A9C] hover:bg-[#1E6BB8] text-white rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>{isAr ? 'طباعة التقرير' : 'Print Report'}</span>
          </button>

          {/* Export Official PDF Button */}
          <button
            type="button"
            disabled={isExportingPdf}
            onClick={onExportPdfOfficial}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-extrabold bg-[#C52B36] hover:bg-[#A8222C] text-white rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-60"
          >
            <FileDown className="w-4 h-4" />
            <span>
              {isExportingPdf
                ? isAr
                  ? 'جارٍ تجهيز التقرير وتصديره...'
                  : 'Preparing & Exporting PDF...'
                : isAr
                ? 'تصدير PDF الرسمي'
                : 'Export Official PDF'}
            </span>
          </button>

          {/* Close / Return to System */}
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold bg-white/15 hover:bg-white/25 text-white rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span>{isAr ? 'العودة للنظام' : 'Back to System'}</span>
          </button>
        </div>
      </div>

      {/* Scrollable Multi-Page Paper Canvas */}
      <div className="flex-1 overflow-auto p-6 flex justify-center bg-[#1E293B]">
        <div
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'top center',
          }}
          className="transition-transform duration-150 pb-16"
        >
          <ExecutiveAuctionPrintReport
            auctions={auctions}
            metrics={metrics}
            metadata={metadata}
            thresholds={thresholds}
            selectedPeriod={selectedPeriod}
            lang={lang}
            paperSize={paperSize}
            containerId="saaed-preview-report-pages"
          />
        </div>
      </div>
    </div>
  );
};
