import React from 'react';
import {
  ClipboardList,
  ClipboardCheck,
  AlertTriangle,
  Lightbulb,
  SlidersHorizontal,
} from 'lucide-react';
import {
  AuctionRecord,
  ComputedAuctionMetrics,
  Language,
  PerformanceThresholds,
} from '../types/auction';
import { evaluateAuctionPerformance } from '../services/storageService';
import {
  GoldenGavelIcon,
  NavyCarIcon,
  CarSoldIcon,
  CarUnsoldIcon,
  GoldenTargetIcon,
  AscendingBarsIcon,
  ExcelSheetIcon,
} from './CustomIcons';

interface ExecutiveDashboardProps {
  auctions: AuctionRecord[];
  metrics: ComputedAuctionMetrics;
  thresholds: PerformanceThresholds;
  lang: Language;
  pixelPerfectMode: boolean;
  onOpenThresholdModal: () => void;
  onSwitchToSheet1?: () => void;
}

export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({
  auctions,
  metrics,
  thresholds,
  lang,
  pixelPerfectMode,
  onOpenThresholdModal,
  onSwitchToSheet1,
}) => {
  const isAr = lang === 'ar';
  const assetBase = import.meta.env.BASE_URL || './';

  // Sorted descending by saleRate for Horizontal Bar Chart
  const sortedBySaleRate = [...auctions].sort((a, b) => b.saleRate - a.saleRate);

  // Dynamic Y-axis max for Clustered Bar Chart (minimum 350 to match reference)
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
  const standardTicks = yAxisMax === 350 ? [0, 50, 100, 150, 200, 250, 300, 350] : yTicks;

  // Doughnut Chart Geometry
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const soldFraction = Math.min(1, Math.max(0, metrics.overallSaleRate / 100));
  const unsoldFraction = Math.max(0, 1 - soldFraction);
  const soldStroke = soldFraction * circumference;
  const unsoldStroke = unsoldFraction * circumference;

  return (
    <section
      id="sheet2-dashboard-container"
      dir={isAr ? 'rtl' : 'ltr'}
      className="print-sheet w-full bg-[#F4F7FB] rounded-[18px] border border-[#BCC8D6] shadow-[0_4px_20px_rgba(18,59,112,0.08)] overflow-hidden p-2.5 sm:p-3.5 transition-all"
    >
      {/* 1. EXECUTIVE DASHBOARD HEADER BANNER */}
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
            <p className="text-[13.5px] sm:text-[17px] font-bold text-white/95 font-en tracking-wide leading-tight mt-0.5">
              {isAr
                ? 'Executive Auction Performance Dashboard'
                : 'لوحة التحليل التنفيذي لأداء المزادات'}
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

      {/* 3. MIDDLE ANALYTICS ROW (Exact Left-to-Right Visual Placement from Reference Image) */}
      <div
        dir="ltr"
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[22fr_22fr_28fr_28fr] gap-2.5 items-stretch"
      >
        {/* PANEL 1 (Far Left, 22%): Executive Summary Card */}
        <div
          dir={isAr ? 'rtl' : 'ltr'}
          className="bg-white border border-[#BCC8D6] rounded-[14px] shadow-[0_2px_5px_rgba(18,59,112,0.05)] overflow-hidden flex flex-col justify-between"
        >
          <div>
            <div
              style={{
                background:
                  'linear-gradient(180deg, #165B9D 0%, #123B70 100%)',
              }}
              className="px-3 py-1.5 text-white flex items-center justify-center gap-2"
            >
              <ClipboardList className="w-4 h-4 text-white shrink-0" />
              <h3 className="text-[13.5px] sm:text-[14px] font-extrabold tracking-tight whitespace-nowrap">
                {isAr
                  ? 'الملخص التنفيذي لنتائج المزادات'
                  : 'Executive Auction Summary'}
              </h3>
            </div>

            <ul className="px-3.5 py-2 space-y-1 text-[13px] font-extrabold text-[#0F172A]">
              <li className="flex items-center gap-1.5">
                <span className="text-[#123B70] text-base leading-none">•</span>
                <span>{isAr ? 'عدد المزادات:' : 'Total Auctions:'}</span>
                <span className="tabular-nums font-black">
                  {metrics.totalAuctions}
                </span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="text-[#123B70] text-base leading-none">•</span>
                <span>
                  {isAr ? 'إجمالي المركبات المعروضة:' : 'Total Listed Vehicles:'}
                </span>
                <span className="tabular-nums font-black">
                  {metrics.totalListed.toLocaleString('en-US')}
                </span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="text-[#123B70] text-base leading-none">•</span>
                <span>{isAr ? 'عدد المركبات المبيعة:' : 'Total Sold Vehicles:'}</span>
                <span className="tabular-nums font-black">
                  {metrics.totalSold.toLocaleString('en-US')}
                </span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="text-[#123B70] text-base leading-none">•</span>
                <span>
                  {isAr ? 'عدد المركبات غير المبيعة:' : 'Total Unsold Vehicles:'}
                </span>
                <span className="tabular-nums font-black">
                  {metrics.totalUnsold.toLocaleString('en-US')}
                </span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="text-[#123B70] text-base leading-none">•</span>
                <span>
                  {isAr ? 'النسبة الإجمالية للبيع:' : 'Overall Sale Rate:'}
                </span>
                <span className="tabular-nums font-black text-[#16843A] text-[14px]">
                  {metrics.overallSaleRate.toFixed(1)}%
                </span>
              </li>
            </ul>
          </div>

          <div className="px-2.5 pb-2 space-y-1.5">
            {metrics.highestSaleAuction && (
              <div className="bg-[#E3F3E6] border border-[#B8DFC0] rounded-lg px-2.5 py-1 flex items-center gap-1.5 text-[12px] font-extrabold text-[#0F172A]">
                <svg
                  viewBox="0 0 20 20"
                  className="w-4 h-4 fill-[#289E47] shrink-0"
                >
                  <path d="M10 2L17 10H13V18H7V10H3L10 2Z" />
                </svg>
                <span className="truncate">
                  {isAr ? 'أعلى نسبة بيع: المزاد' : 'Highest Sale:'}{' '}
                  <span className="font-en font-black">
                    {metrics.highestSaleAuction.auctionNumber}
                  </span>{' '}
                  <span className="text-[#16843A] font-black tabular-nums">
                    ({metrics.highestSaleAuction.saleRate.toFixed(1)}%)
                  </span>
                </span>
              </div>
            )}

            {metrics.lowestSaleAuction && (
              <div className="bg-[#FCE8E6] border border-[#F3C2BF] rounded-lg px-2.5 py-1 flex items-center gap-1.5 text-[12px] font-extrabold text-[#0F172A]">
                <svg
                  viewBox="0 0 20 20"
                  className="w-4 h-4 fill-[#D9383A] shrink-0"
                >
                  <path d="M10 18L3 10H7V2H13V10H17L10 18Z" />
                </svg>
                <span className="truncate">
                  {isAr ? 'أقل نسبة بيع: المزاد' : 'Lowest Sale:'}{' '}
                  <span className="font-en font-black">
                    {metrics.lowestSaleAuction.auctionNumber}
                  </span>{' '}
                  <span className="text-[#B4232C] font-black tabular-nums">
                    ({metrics.lowestSaleAuction.saleRate.toFixed(1)}%)
                  </span>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* PANEL 2 (Second from Left, 22%): Doughnut Chart - توزيع نتائج المزادات */}
        <div
          dir={isAr ? 'rtl' : 'ltr'}
          className="bg-white border border-[#BCC8D6] rounded-[14px] shadow-[0_2px_5px_rgba(18,59,112,0.05)] p-2.5 flex flex-col justify-between"
        >
          <h3 className="text-center text-[14.5px] font-black text-[#0F294A] mb-1">
            {isAr ? 'توزيع نتائج المزادات' : 'Auction Results Distribution'}
          </h3>

          <div
            dir="ltr"
            className="flex items-center justify-around gap-2 my-auto py-1"
          >
            {/* Doughnut SVG matching reference orientation */}
            <div className="relative w-[138px] h-[138px] shrink-0 flex items-center justify-center">
              <svg viewBox="0 0 130 130" className="w-full h-full">
                {/* Sold Arc (Blue #135193) */}
                <circle
                  cx="65"
                  cy="65"
                  r={radius}
                  fill="transparent"
                  stroke="#135193"
                  strokeWidth="25"
                  strokeDasharray={`${soldStroke} ${circumference}`}
                  transform="rotate(-90 65 65)"
                />
                {/* Unsold Arc (Red #C92A2A) */}
                <circle
                  cx="65"
                  cy="65"
                  r={radius}
                  fill="transparent"
                  stroke="#C92A2A"
                  strokeWidth="25"
                  strokeDasharray={`${unsoldStroke} ${circumference}`}
                  strokeDashoffset={-soldStroke}
                  transform="rotate(-90 65 65)"
                />
                {/* Labels inside ring */}
                {metrics.overallUnsoldRate >= 8 && (
                  <text
                    x="42"
                    y="27"
                    textAnchor="middle"
                    fill="#FFFFFF"
                    fontSize="10"
                    fontWeight="800"
                  >
                    {metrics.overallUnsoldRate.toFixed(1)}%
                  </text>
                )}
                {metrics.overallSaleRate >= 20 && (
                  <text
                    x="74"
                    y="116"
                    textAnchor="middle"
                    fill="#FFFFFF"
                    fontSize="10.5"
                    fontWeight="800"
                  >
                    {metrics.overallSaleRate.toFixed(1)}%
                  </text>
                )}
              </svg>
              {/* Center Hole Total */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                <span className="text-[17px] font-black text-[#0F172A] tabular-nums leading-none">
                  {metrics.totalListed.toLocaleString('en-US')}
                </span>
                <span className="text-[12.5px] font-extrabold text-[#0F172A] mt-0.5">
                  {isAr ? 'مركبة' : 'Vehicles'}
                </span>
              </div>
            </div>

            {/* Right Legend */}
            <div dir={isAr ? 'rtl' : 'ltr'} className="space-y-3 text-right">
              <div>
                <div className="flex items-center gap-1.5 text-[12.5px] font-extrabold text-[#0F172A]">
                  <span className="w-3 h-3 rounded-[2px] bg-[#135193] shrink-0" />
                  <span>{isAr ? 'المركبات المبيعة' : 'Sold Vehicles'}</span>
                </div>
                <div className="text-[12.5px] font-black tabular-nums text-[#0F172A] mt-0.5 ps-4">
                  {metrics.totalSold.toLocaleString('en-US')}{' '}
                  <span className="text-[#135193]">
                    ({metrics.overallSaleRate.toFixed(1)}%)
                  </span>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-1.5 text-[12.5px] font-extrabold text-[#0F172A]">
                  <span className="w-3 h-3 rounded-[2px] bg-[#C92A2A] shrink-0" />
                  <span>
                    {isAr ? 'المركبات غير المبيعة' : 'Unsold Vehicles'}
                  </span>
                </div>
                <div className="text-[12.5px] font-black tabular-nums text-[#B4232C] mt-0.5 ps-4">
                  {metrics.totalUnsold.toLocaleString('en-US')} (
                  {metrics.overallUnsoldRate.toFixed(1)}%)
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PANEL 3 (Third from Left, 28%): Clustered Bar Chart - مقارنة أداء المزادات */}
        <div className="bg-white border border-[#BCC8D6] rounded-[14px] shadow-[0_2px_5px_rgba(18,59,112,0.05)] p-2.5 flex flex-col justify-between">
          <h3 className="text-center text-[14.5px] font-black text-[#0F294A] mb-1">
            {isAr ? 'مقارنة أداء المزادات' : 'Auction Performance Comparison'}
          </h3>

          {/* Precision SVG Clustered Bar Chart */}
          <div className="w-full flex-1 flex flex-col justify-center">
            <svg viewBox="0 0 380 155" className="w-full h-auto overflow-visible">
              {/* Horizontal Grid Lines & Y-Axis Labels */}
              {standardTicks.map((tick) => {
                const y = 128 - (tick / yAxisMax) * 112;
                return (
                  <g key={tick}>
                    <line
                      x1="34"
                      y1={y}
                      x2="372"
                      y2={y}
                      stroke="#E2E8F0"
                      strokeWidth="1"
                    />
                    <text
                      x="28"
                      y={y + 3.5}
                      textAnchor="end"
                      fill="#1E293B"
                      fontSize="10"
                      fontWeight="700"
                      className="font-en"
                    >
                      {tick}
                    </text>
                  </g>
                );
              })}

              {/* Clustered Bars per Auction */}
              {auctions.map((auc, i) => {
                const count = Math.max(1, auctions.length);
                const slotWidth = 336 / count;
                const groupCenter = 36 + slotWidth * i + slotWidth / 2;
                const barWidth = Math.min(13, Math.max(6, slotWidth * 0.2));

                const listedH = (auc.listedVehicles / yAxisMax) * 112;
                const soldH = (auc.soldVehicles / yAxisMax) * 112;
                const unsoldH = (auc.unsoldVehicles / yAxisMax) * 112;

                return (
                  <g key={auc.id}>
                    {/* Listed Bar (Navy #123B70) */}
                    <rect
                      x={groupCenter - barWidth * 1.5 - 1.5}
                      y={128 - listedH}
                      width={barWidth}
                      height={Math.max(1, listedH)}
                      fill="#123B70"
                      rx="1"
                    >
                      <title>{`${auc.auctionNumber} - ${
                        isAr ? 'المدرجة' : 'Listed'
                      }: ${auc.listedVehicles}`}</title>
                    </rect>
                    {/* Sold Bar (Green #2E8B46) */}
                    <rect
                      x={groupCenter - barWidth * 0.5}
                      y={128 - soldH}
                      width={barWidth}
                      height={Math.max(1, soldH)}
                      fill="#2E8B46"
                      rx="1"
                    >
                      <title>{`${auc.auctionNumber} - ${
                        isAr ? 'المبيعة' : 'Sold'
                      }: ${auc.soldVehicles}`}</title>
                    </rect>
                    {/* Unsold Bar (Red #D63333) */}
                    <rect
                      x={groupCenter + barWidth * 0.5 + 1.5}
                      y={128 - unsoldH}
                      width={barWidth}
                      height={Math.max(1, unsoldH)}
                      fill="#D63333"
                      rx="1"
                    >
                      <title>{`${auc.auctionNumber} - ${
                        isAr ? 'غير المبيعة' : 'Unsold'
                      }: ${auc.unsoldVehicles}`}</title>
                    </rect>

                    {/* X-Axis Auction Code */}
                    <text
                      x={groupCenter}
                      y="143"
                      textAnchor="middle"
                      fill="#0F172A"
                      fontSize="9.5"
                      fontWeight="800"
                      className="font-en"
                    >
                      {auc.auctionNumber}
                    </text>
                  </g>
                );
              })}

              {/* Baseline */}
              <line
                x1="34"
                y1="128"
                x2="372"
                y2="128"
                stroke="#94A3B8"
                strokeWidth="1.2"
              />
            </svg>
          </div>

          {/* Bottom Legend */}
          <div
            dir={isAr ? 'rtl' : 'ltr'}
            className="flex items-center justify-center gap-4 text-[11.5px] font-extrabold text-[#0F172A] pt-0.5"
          >
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-[2px] bg-[#123B70]" />
              <span>{isAr ? 'المركبات المدرجة' : 'Listed'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-[2px] bg-[#2E8B46]" />
              <span>{isAr ? 'المركبات المبيعة' : 'Sold'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-[2px] bg-[#D63333]" />
              <span>{isAr ? 'غير المبيعة' : 'Unsold'}</span>
            </div>
          </div>
        </div>

        {/* PANEL 4 (Far Right, 28%): Horizontal Bar Chart - نسبة نجاح البيع حسب المزاد */}
        <div className="bg-white border border-[#BCC8D6] rounded-[14px] shadow-[0_2px_5px_rgba(18,59,112,0.05)] p-2.5 flex flex-col justify-between">
          <h3 className="text-center text-[14.5px] font-black text-[#0F294A] mb-1">
            {isAr
              ? 'نسبة نجاح البيع حسب المزاد'
              : 'Sale Success Rate by Auction'}
          </h3>

          <div className="flex-1 flex flex-col justify-center space-y-2 px-1">
            {sortedBySaleRate.map((auc, idx) => {
              // Gradient shades of green matching reference image
              const barColors = [
                '#299449',
                '#2D9A4D',
                '#34A053',
                '#66B748',
                '#78BE43',
              ];
              const barColor = barColors[Math.min(idx, barColors.length - 1)];
              return (
                <div
                  key={auc.id}
                  className="flex items-center gap-2 text-[11.5px] font-extrabold"
                >
                  <span className="w-[54px] text-right font-en font-black text-[#0F172A] shrink-0">
                    {auc.auctionNumber}
                  </span>
                  <div className="flex-1 h-[15px] bg-[#F1F5F9] rounded-xs relative flex items-center">
                    <div
                      style={{
                        width: `${Math.min(100, Math.max(2, auc.saleRate))}%`,
                        backgroundColor: barColor,
                      }}
                      className="h-full rounded-xs transition-all duration-300"
                    />
                    <span
                      style={{
                        left: `calc(${Math.min(
                          86,
                          Math.max(5, auc.saleRate)
                        )}% + 6px)`,
                      }}
                      className="absolute text-[11px] font-black font-en tabular-nums text-[#0F172A]"
                    >
                      {auc.saleRate.toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Horizontal Axis 0% .. 100% */}
          <div className="ps-[62px] pe-6 pt-1.5 border-t border-slate-200 flex items-center justify-between text-[10.5px] font-extrabold font-en text-slate-600 tabular-nums">
            <span>0%</span>
            <span>20%</span>
            <span>40%</span>
            <span>60%</span>
            <span>80%</span>
            <span>100%</span>
          </div>
        </div>
      </div>

      {/* 4. BOTTOM ROW: VEHICLES PHOTO + COMPARATIVE TABLE + 3 OPERATIONAL CARDS */}
      <div
        dir="ltr"
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[22fr_28fr_16.6fr_16.7fr_16.7fr] gap-2.5 mt-2.5 items-stretch"
      >
        {/* BOTTOM COL 1 (Far Left, 22%): Auction Vehicles Photo + Sheet 2 Badge */}
        <div className="flex flex-col justify-between gap-1.5">
          <div className="relative flex-1 min-h-[115px] rounded-[14px] overflow-hidden border border-[#BCC8D6] bg-white shadow-xs">
            <img
              src={`${assetBase}assets/dashboard_cars_photo.png`}
              alt="SAAED Auction Vehicles Lineup"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover select-none"
            />
          </div>

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

        {/* BOTTOM COL 2 (Second from Left, 28%): Comparative Analysis Table */}
        <div
          dir={isAr ? 'rtl' : 'ltr'}
          className="bg-white border border-[#BCC8D6] rounded-[14px] shadow-[0_2px_5px_rgba(18,59,112,0.05)] overflow-hidden flex flex-col"
        >
          <div
            style={{
              background: 'linear-gradient(180deg, #165B9D 0%, #123B70 100%)',
            }}
            className="px-3 py-1.5 text-white flex items-center justify-between"
          >
            <div className="w-4" />
            <h3 className="text-[13.5px] font-extrabold text-center whitespace-nowrap">
              {isAr
                ? 'التحليل المقارن لأداء المزادات'
                : 'Comparative Auction Analysis'}
            </h3>
            {!pixelPerfectMode ? (
              <button
                type="button"
                onClick={onOpenThresholdModal}
                title={
                  isAr
                    ? 'تعديل حدود تقييم الأداء'
                    : 'Customize Performance Thresholds'
                }
                className="no-print text-white/85 hover:text-white cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </button>
            ) : (
              <div className="w-4" />
            )}
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full border-collapse text-center text-[11.5px] font-bold">
              <thead>
                <tr className="bg-[#165B9D] text-white font-extrabold">
                  <th className="py-1 px-1.5 border border-[#4978A8] whitespace-nowrap">
                    {isAr ? 'رقم المزاد' : 'Auction'}
                  </th>
                  <th className="py-1 px-1 border border-[#4978A8]">
                    {isAr ? 'المدرجة' : 'Listed'}
                  </th>
                  <th className="py-1 px-1 border border-[#4978A8]">
                    {isAr ? 'المبيعة' : 'Sold'}
                  </th>
                  <th className="py-1 px-1 border border-[#4978A8] whitespace-nowrap">
                    {isAr ? 'غير المبيعة' : 'Unsold'}
                  </th>
                  <th className="py-1 px-1 border border-[#4978A8] whitespace-nowrap">
                    {isAr ? 'نسبة البيع' : 'Sale %'}
                  </th>
                  <th className="py-1 px-1 border border-[#4978A8] whitespace-nowrap">
                    {isAr ? 'نسبة عدم البيع' : 'Unsold %'}
                  </th>
                  <th className="py-1 px-1.5 border border-[#4978A8] whitespace-nowrap">
                    {isAr ? 'تقييم الأداء' : 'Evaluation'}
                  </th>
                </tr>
              </thead>
              <tbody className="text-[#0F172A]">
                {auctions.map((auc, i) => {
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
                          ? 'bg-white border-b border-slate-200'
                          : 'bg-[#EEF3F9] border-b border-slate-200'
                      }
                    >
                      <td className="py-1 px-1.5 border border-slate-300 font-en font-black tabular-nums whitespace-nowrap">
                        {auc.auctionNumber}
                      </td>
                      <td className="py-1 px-1 border border-slate-300 font-extrabold tabular-nums">
                        {auc.listedVehicles}
                      </td>
                      <td className="py-1 px-1 border border-slate-300 font-extrabold tabular-nums">
                        {auc.soldVehicles}
                      </td>
                      <td className="py-1 px-1 border border-slate-300 font-extrabold tabular-nums">
                        {auc.unsoldVehicles}
                      </td>
                      <td className="py-1 px-1 border border-slate-300 font-black tabular-nums text-[#16843A]">
                        {auc.saleRate.toFixed(1)}%
                      </td>
                      <td className="py-1 px-1 border border-slate-300 font-extrabold tabular-nums text-[#0F172A]">
                        {auc.unsoldRate.toFixed(1)}%
                      </td>
                      <td className="py-0.5 px-1.5 border border-slate-300">
                        <span
                          className={`inline-block w-full px-2 py-0.5 rounded-full text-[10.5px] font-extrabold border ${badge.bgClass} ${badge.textClass} ${badge.borderClass} whitespace-nowrap`}
                        >
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* BOTTOM COL 3 (Third from Left, 16.6%): Operational Notes - أبرز الملاحظات التشغيلية */}
        <div
          dir={isAr ? 'rtl' : 'ltr'}
          className="bg-white border border-[#BCC8D6] rounded-[14px] shadow-[0_2px_5px_rgba(18,59,112,0.05)] overflow-hidden flex flex-col"
        >
          <div
            style={{
              background: 'linear-gradient(180deg, #165B9D 0%, #123B70 100%)',
            }}
            className="px-2.5 py-1.5 text-white flex items-center justify-center gap-1.5"
          >
            <ClipboardCheck className="w-4 h-4 text-white shrink-0" />
            <h3 className="text-[13px] font-extrabold whitespace-nowrap">
              {isAr ? 'أبرز الملاحظات التشغيلية' : 'Key Operational Notes'}
            </h3>
          </div>
          <ul className="p-2.5 space-y-1.5 text-[12px] font-extrabold text-[#0F172A] flex-1">
            {auctions.map((auc) => (
              <li
                key={auc.id}
                title={`${auc.auctionNumber}: ${
                  isAr ? auc.notesAr : auc.notesEn
                }`}
                className="flex items-start gap-1.5 leading-snug"
              >
                <span className="text-[#123B70] font-black leading-tight">
                  •
                </span>
                <span className="flex-1">
                  {isAr ? auc.notesAr : auc.notesEn}
                  {!pixelPerfectMode && (
                    <span className="ms-1 text-[10px] font-en font-bold text-[#165B9D]">
                      [{auc.auctionNumber}]
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* BOTTOM COL 4 (Fourth from Left, 16.6%): Operational Challenges - التحديات التشغيلية الرئيسية */}
        <div
          dir={isAr ? 'rtl' : 'ltr'}
          className="bg-white border border-[#BCC8D6] rounded-[14px] shadow-[0_2px_5px_rgba(18,59,112,0.05)] overflow-hidden flex flex-col"
        >
          <div
            style={{
              background: 'linear-gradient(180deg, #165B9D 0%, #123B70 100%)',
            }}
            className="px-2.5 py-1.5 text-white flex items-center justify-center gap-1.5"
          >
            <AlertTriangle className="w-4 h-4 text-[#FACC15] shrink-0" />
            <h3 className="text-[13px] font-extrabold whitespace-nowrap">
              {isAr
                ? 'التحديات التشغيلية الرئيسية'
                : 'Operational Challenges'}
            </h3>
          </div>
          <ul className="p-2.5 space-y-1.5 text-[12px] font-extrabold text-[#0F172A] flex-1">
            {auctions.map((auc) => (
              <li
                key={auc.id}
                title={`${auc.auctionNumber}: ${
                  isAr ? auc.challengesAr : auc.challengesEn
                }`}
                className="flex items-start gap-1.5 leading-snug"
              >
                <span className="text-[#123B70] font-black leading-tight">
                  •
                </span>
                <span className="flex-1">
                  {isAr ? auc.challengesAr : auc.challengesEn}
                  {!pixelPerfectMode && (
                    <span className="ms-1 text-[10px] font-en font-bold text-[#922C35]">
                      [{auc.auctionNumber}]
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* BOTTOM COL 5 (Far Right, 16.8%): Recommendations - التوصيات والإجراءات التحسينية */}
        <div
          dir={isAr ? 'rtl' : 'ltr'}
          className="bg-white border border-[#BCC8D6] rounded-[14px] shadow-[0_2px_5px_rgba(18,59,112,0.05)] overflow-hidden flex flex-col"
        >
          <div
            style={{
              background: 'linear-gradient(180deg, #165B9D 0%, #123B70 100%)',
            }}
            className="px-2.5 py-1.5 text-white flex items-center justify-center gap-1.5"
          >
            <Lightbulb className="w-4 h-4 text-[#FDE047] shrink-0" />
            <h3 className="text-[13px] font-extrabold whitespace-nowrap">
              {isAr
                ? 'التوصيات والإجراءات التحسينية'
                : 'Recommendations & Actions'}
            </h3>
          </div>
          <ul className="p-2.5 space-y-1.5 text-[12px] font-extrabold text-[#0F172A] flex-1">
            {auctions.map((auc) => (
              <li
                key={auc.id}
                title={`${auc.auctionNumber}: ${
                  isAr ? auc.recommendationsAr : auc.recommendationsEn
                }`}
                className="flex items-start gap-1.5 leading-snug"
              >
                <span className="text-[#123B70] font-black leading-tight">
                  •
                </span>
                <span className="flex-1">
                  {isAr ? auc.recommendationsAr : auc.recommendationsEn}
                  {!pixelPerfectMode && (
                    <span className="ms-1 text-[10px] font-en font-bold text-[#16843A]">
                      [{auc.auctionNumber}]
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};
