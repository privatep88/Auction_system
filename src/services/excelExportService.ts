import ExcelJS from 'exceljs';
import {
  AuctionRecord,
  ComputedAuctionMetrics,
  Language,
  PerformanceThresholds,
  ReportMetadata,
} from '../types/auction';
import { evaluateAuctionPerformance } from './storageService';

async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const res = reader.result as string;
        resolve(res ? res.split(',')[1] : null);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function exportExecutiveExcelReport(params: {
  auctions: AuctionRecord[];
  metrics: ComputedAuctionMetrics;
  metadata: ReportMetadata;
  thresholds: PerformanceThresholds;
  lang: Language;
}): Promise<void> {
  const { auctions, metrics, metadata, thresholds, lang } = params;
  const isAr = lang === 'ar';
  const assetBase = import.meta.env.BASE_URL || './';

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SAAED Vehicle Auction Executive Reporting System';
  workbook.created = new Date();
  workbook.modified = new Date();

  // Load images to embed into the workbook
  const [logoBase64, topPhotoBase64, bottomPhotoBase64, carsPhotoBase64] =
    await Promise.all([
      fetchImageAsBase64(`${assetBase}assets/saaed_logo.png`),
      fetchImageAsBase64(`${assetBase}assets/header_top_photo.png`),
      fetchImageAsBase64(`${assetBase}assets/header_bottom_photo.png`),
      fetchImageAsBase64(`${assetBase}assets/dashboard_cars_photo.png`),
    ]);

  const logoId = logoBase64
    ? workbook.addImage({ base64: logoBase64, extension: 'png' })
    : null;
  const topPhotoId = topPhotoBase64
    ? workbook.addImage({ base64: topPhotoBase64, extension: 'png' })
    : null;
  const bottomPhotoId = bottomPhotoBase64
    ? workbook.addImage({ base64: bottomPhotoBase64, extension: 'png' })
    : null;
  const carsPhotoId = carsPhotoBase64
    ? workbook.addImage({ base64: carsPhotoBase64, extension: 'png' })
    : null;

  // ============================================================================
  // SHEET 1: تقرير بيانات المزادات
  // ============================================================================
  const sheet1 = workbook.addWorksheet('تقرير بيانات المزادات', {
    views: [{ rightToLeft: true, showGridLines: true, zoomScale: 95 }],
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      margins: {
        left: 0.3,
        right: 0.3,
        top: 0.3,
        bottom: 0.3,
        header: 0.2,
        footer: 0.2,
      },
    },
  });

  sheet1.columns = [
    { key: 'seq', width: 8 },
    { key: 'code', width: 16 },
    { key: 'duration', width: 20 },
    { key: 'listed', width: 18 },
    { key: 'sold', width: 18 },
    { key: 'unsold', width: 18 },
    { key: 'notes', width: 32 },
    { key: 'challenges', width: 32 },
    { key: 'recommendations', width: 34 },
  ];

  // Header Banner Rows (Rows 1 to 3)
  sheet1.getRow(1).height = 28;
  sheet1.getRow(2).height = 26;
  sheet1.getRow(3).height = 24;

  // Logo space (Cols A-B, Rows 1-2)
  sheet1.mergeCells('A1:B2');
  const s1LogoCell = sheet1.getCell('A1');
  s1LogoCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFFFFF' },
  };

  // Title Banner (Cols C-F, Rows 1-2)
  sheet1.mergeCells('C1:F1');
  const s1TitleAr = sheet1.getCell('C1');
  s1TitleAr.value = 'تقرير بيانات المزادات';
  s1TitleAr.font = {
    name: 'Cairo',
    size: 18,
    bold: true,
    color: { argb: 'FFFFFFFF' },
  };
  s1TitleAr.alignment = { horizontal: 'center', vertical: 'middle' };
  s1TitleAr.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF123B70' },
  };

  sheet1.mergeCells('C2:F2');
  const s1TitleEn = sheet1.getCell('C2');
  s1TitleEn.value = 'Vehicle Auction Data Report';
  s1TitleEn.font = {
    name: 'Calibri',
    size: 13,
    bold: true,
    color: { argb: 'FFE2E8F0' },
  };
  s1TitleEn.alignment = { horizontal: 'center', vertical: 'middle' };
  s1TitleEn.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF165B9D' },
  };

  // Panoramic photo area (Cols G-I, Rows 1-3)
  sheet1.mergeCells('G1:I3');
  const s1PhotoCell = sheet1.getCell('G1');
  s1PhotoCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF123B70' },
  };

  if (logoId !== null) {
    sheet1.addImage(logoId, {
      tl: { col: 0.15, row: 0.15 },
      ext: { width: 165, height: 64 },
    });
  }
  if (topPhotoId !== null) {
    sheet1.addImage(topPhotoId, {
      tl: { col: 6.05, row: 0.08 },
      ext: { width: 490, height: 94 },
    });
  }

  // Row 3: Report Date & Period Metadata
  sheet1.mergeCells('A3:C3');
  const s1DateCell = sheet1.getCell('A3');
  s1DateCell.value = `تاريخ إعداد التقرير : ${metadata.reportDate}`;
  s1DateCell.font = {
    name: 'Cairo',
    size: 11,
    bold: true,
    color: { argb: 'FF123B70' },
  };
  s1DateCell.alignment = { horizontal: 'center', vertical: 'middle' };
  s1DateCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFEEF3F9' },
  };

  sheet1.mergeCells('D3:F3');
  const s1PeriodCell = sheet1.getCell('D3');
  s1PeriodCell.value = `الفترة المشمولة بالتقرير : من ${metadata.periodStart} إلى ${metadata.periodEnd}`;
  s1PeriodCell.font = {
    name: 'Cairo',
    size: 11,
    bold: true,
    color: { argb: 'FF123B70' },
  };
  s1PeriodCell.alignment = { horizontal: 'center', vertical: 'middle' };
  s1PeriodCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFEEF3F9' },
  };

  sheet1.getRow(4).height = 10;

  // Rows 5-6: 6 KPI Cards using Excel Cells & Live Formulas
  const dataStartRow = 9;
  const dataEndRow = dataStartRow + auctions.length - 1;
  const totalRowIdx = dataEndRow + 1;

  sheet1.getRow(5).height = 22;
  sheet1.getRow(6).height = 28;

  const s1Kpis = [
    {
      titleCols: 'A5:B5',
      valCols: 'A6:B6',
      cellTitle: 'A5',
      cellVal: 'A6',
      title: isAr ? 'إجمالي عدد المزادات' : 'Total Auctions',
      formula: `COUNTA(B${dataStartRow}:B${dataEndRow})`,
      result: metrics.totalAuctions,
      numFmt: '#,##0',
      color: 'FF922C35',
    },
    {
      titleCols: 'C5:C5',
      valCols: 'C6:C6',
      cellTitle: 'C5',
      cellVal: 'C6',
      title: isAr ? 'إجمالي المركبات المدرجة' : 'Total Listed Vehicles',
      formula: `D${totalRowIdx}`,
      result: metrics.totalListed,
      numFmt: '#,##0',
      color: 'FF922C35',
    },
    {
      titleCols: 'D5:E5',
      valCols: 'D6:E6',
      cellTitle: 'D5',
      cellVal: 'D6',
      title: isAr ? 'إجمالي المركبات المبيعة' : 'Total Sold Vehicles',
      formula: `E${totalRowIdx}`,
      result: metrics.totalSold,
      numFmt: '#,##0',
      color: 'FF922C35',
    },
    {
      titleCols: 'F5:G5',
      valCols: 'F6:G6',
      cellTitle: 'F5',
      cellVal: 'F6',
      title: isAr ? 'إجمالي المركبات غير المبيعة' : 'Total Unsold Vehicles',
      formula: `F${totalRowIdx}`,
      result: metrics.totalUnsold,
      numFmt: '#,##0',
      color: 'FF922C35',
    },
    {
      titleCols: 'H5:H5',
      valCols: 'H6:H6',
      cellTitle: 'H5',
      cellVal: 'H6',
      title: isAr ? 'نسبة البيع الإجمالية' : 'Overall Sale Rate',
      formula: `IF(D${totalRowIdx}>0,E${totalRowIdx}/D${totalRowIdx},0)`,
      result: metrics.overallSaleRate / 100,
      numFmt: '0.0%',
      color: 'FF16843A',
    },
    {
      titleCols: 'I5:I5',
      valCols: 'I6:I6',
      cellTitle: 'I5',
      cellVal: 'I6',
      title: isAr ? 'نسبة عدم البيع' : 'Unsold Rate',
      formula: `IF(D${totalRowIdx}>0,F${totalRowIdx}/D${totalRowIdx},0)`,
      result: metrics.overallUnsoldRate / 100,
      numFmt: '0.0%',
      color: 'FF922C35',
    },
  ];

  for (const kpi of s1Kpis) {
    if (kpi.titleCols.split(':')[0] !== kpi.titleCols.split(':')[1]) {
      sheet1.mergeCells(kpi.titleCols);
      sheet1.mergeCells(kpi.valCols);
    }
    const tCell = sheet1.getCell(kpi.cellTitle);
    tCell.value = kpi.title;
    tCell.font = {
      name: 'Cairo',
      size: 11,
      bold: true,
      color: { argb: 'FF123B70' },
    };
    tCell.alignment = { horizontal: 'center', vertical: 'middle' };
    tCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFFFF' },
    };
    tCell.border = {
      top: { style: 'thin', color: { argb: 'FFBCC8D6' } },
      left: { style: 'thin', color: { argb: 'FFBCC8D6' } },
      right: { style: 'thin', color: { argb: 'FFBCC8D6' } },
    };

    const vCell = sheet1.getCell(kpi.cellVal);
    vCell.value = { formula: kpi.formula, result: kpi.result };
    vCell.numFmt = kpi.numFmt;
    vCell.font = {
      name: 'Cairo',
      size: 16,
      bold: true,
      color: { argb: kpi.color },
    };
    vCell.alignment = { horizontal: 'center', vertical: 'middle' };
    vCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFFFF' },
    };
    vCell.border = {
      bottom: { style: 'medium', color: { argb: 'FF165B9D' } },
      left: { style: 'thin', color: { argb: 'FFBCC8D6' } },
      right: { style: 'thin', color: { argb: 'FFBCC8D6' } },
    };
  }

  sheet1.getRow(7).height = 10;

  // Row 8: Table Header Row
  const headerRow = sheet1.getRow(8);
  headerRow.height = 30;
  const headersS1 = isAr
    ? [
        'م',
        'رقم المزاد',
        'مدة عرض المزاد',
        'عدد المركبات المدرجة',
        'عدد المركبات المبيعة',
        'عدد المركبات غير المبيعة',
        'الملاحظات',
        'التحديات',
        'التوصيات',
      ]
    : [
        '#',
        'Auction No.',
        'Auction Duration',
        'Listed Vehicles',
        'Sold Vehicles',
        'Unsold Vehicles',
        'Operational Notes',
        'Challenges',
        'Recommendations',
      ];

  headersS1.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = {
      name: 'Cairo',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF123B70' },
    };
    cell.alignment = {
      horizontal: 'center',
      vertical: 'middle',
      wrapText: true,
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF4978A8' } },
      bottom: { style: 'medium', color: { argb: 'FFD5A03D' } },
      left: { style: 'thin', color: { argb: 'FF4978A8' } },
      right: { style: 'thin', color: { argb: 'FF4978A8' } },
    };
  });

  // Data Rows (Rows 9..9+N-1)
  auctions.forEach((auc, idx) => {
    const rIdx = dataStartRow + idx;
    const row = sheet1.getRow(rIdx);
    row.height = 24;
    const bgArgb = idx % 2 === 0 ? 'FFFFFFFF' : 'FFE9EFF7';

    row.getCell(1).value = idx + 1;
    row.getCell(2).value = auc.auctionNumber;
    row.getCell(3).value = isAr ? auc.durationAr : auc.durationEn;
    row.getCell(4).value = auc.listedVehicles;
    row.getCell(5).value = auc.soldVehicles;
    row.getCell(6).value = {
      formula: `D${rIdx}-E${rIdx}`,
      result: auc.unsoldVehicles,
    };
    row.getCell(7).value = isAr ? auc.notesAr : auc.notesEn;
    row.getCell(8).value = isAr ? auc.challengesAr : auc.challengesEn;
    row.getCell(9).value = isAr ? auc.recommendationsAr : auc.recommendationsEn;

    for (let c = 1; c <= 9; c++) {
      const cell = row.getCell(c);
      cell.font = {
        name: 'Cairo',
        size: 11,
        bold: c <= 6,
        color: { argb: 'FF0F172A' },
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: bgArgb },
      };
      cell.alignment = {
        horizontal: 'center',
        vertical: 'middle',
        wrapText: true,
      };
      if (c >= 4 && c <= 6) {
        cell.numFmt = '#,##0';
      }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFBCC8D6' } },
        bottom: { style: 'thin', color: { argb: 'FFBCC8D6' } },
        left: { style: 'thin', color: { argb: 'FFBCC8D6' } },
        right: { style: 'thin', color: { argb: 'FFBCC8D6' } },
      };
    }
  });

  // Totals Row (Gold + Navy)
  const totalRow = sheet1.getRow(totalRowIdx);
  totalRow.height = 28;
  sheet1.mergeCells(`A${totalRowIdx}:C${totalRowIdx}`);
  const totLabelCell = sheet1.getCell(`A${totalRowIdx}`);
  totLabelCell.value = isAr ? 'الإجمالي' : 'Total';

  totalRow.getCell(4).value = {
    formula: `SUM(D${dataStartRow}:D${dataEndRow})`,
    result: metrics.totalListed,
  };
  totalRow.getCell(5).value = {
    formula: `SUM(E${dataStartRow}:E${dataEndRow})`,
    result: metrics.totalSold,
  };
  totalRow.getCell(6).value = {
    formula: `SUM(F${dataStartRow}:F${dataEndRow})`,
    result: metrics.totalUnsold,
  };
  totalRow.getCell(7).value = '—';
  totalRow.getCell(8).value = '—';
  totalRow.getCell(9).value = '—';

  for (let c = 1; c <= 9; c++) {
    const cell = totalRow.getCell(c);
    const isGold = c >= 4 && c <= 6;
    cell.font = {
      name: 'Cairo',
      size: 12,
      bold: true,
      color: { argb: isGold ? 'FF0F172A' : 'FFFFFFFF' },
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: isGold ? 'FFD5A03D' : 'FF123B70' },
    };
    if (isGold) cell.numFmt = '#,##0';
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF123B70' } },
      bottom: { style: 'medium', color: { argb: 'FF123B70' } },
      left: { style: 'thin', color: { argb: 'FF4978A8' } },
      right: { style: 'thin', color: { argb: 'FF4978A8' } },
    };
  }

  // ============================================================================
  // SHEET 2: التحليل التنفيذي
  // ============================================================================
  const sheet2 = workbook.addWorksheet('التحليل التنفيذي', {
    views: [{ rightToLeft: true, showGridLines: true, zoomScale: 90 }],
    pageSetup: {
      paperSize: 9, // A4 Landscape
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      margins: {
        left: 0.3,
        right: 0.3,
        top: 0.3,
        bottom: 0.3,
        header: 0.2,
        footer: 0.2,
      },
    },
  });

  sheet2.columns = [
    { key: 'c1', width: 16 },
    { key: 'c2', width: 15 },
    { key: 'c3', width: 15 },
    { key: 'c4', width: 15 },
    { key: 'c5', width: 16 },
    { key: 'c6', width: 16 },
    { key: 'c7', width: 22 },
    { key: 'c8', width: 32 },
    { key: 'c9', width: 32 },
    { key: 'c10', width: 34 },
  ];

  sheet2.getRow(1).height = 30;
  sheet2.getRow(2).height = 28;

  // Logo space (Cols A-B, Rows 1-2)
  sheet2.mergeCells('A1:B2');
  sheet2.getCell('A1').fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFFFFF' },
  };

  // Title Banner (Cols C-G, Rows 1-2)
  sheet2.mergeCells('C1:G1');
  const s2TitleAr = sheet2.getCell('C1');
  s2TitleAr.value = 'لوحة التحليل التنفيذي لأداء المزادات';
  s2TitleAr.font = {
    name: 'Cairo',
    size: 18,
    bold: true,
    color: { argb: 'FFFFFFFF' },
  };
  s2TitleAr.alignment = { horizontal: 'center', vertical: 'middle' };
  s2TitleAr.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF123B70' },
  };

  sheet2.mergeCells('C2:G2');
  const s2TitleEn = sheet2.getCell('C2');
  s2TitleEn.value = 'Executive Auction Performance Dashboard';
  s2TitleEn.font = {
    name: 'Calibri',
    size: 13,
    bold: true,
    color: { argb: 'FFE2E8F0' },
  };
  s2TitleEn.alignment = { horizontal: 'center', vertical: 'middle' };
  s2TitleEn.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF165B9D' },
  };

  // Panoramic photo area (Cols H-J, Rows 1-2)
  sheet2.mergeCells('H1:J2');
  sheet2.getCell('H1').fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF123B70' },
  };

  if (logoId !== null) {
    sheet2.addImage(logoId, {
      tl: { col: 0.15, row: 0.12 },
      ext: { width: 165, height: 64 },
    });
  }
  if (bottomPhotoId !== null) {
    sheet2.addImage(bottomPhotoId, {
      tl: { col: 7.05, row: 0.08 },
      ext: { width: 460, height: 74 },
    });
  }

  sheet2.getRow(3).height = 10;
  sheet2.getRow(4).height = 22;
  sheet2.getRow(5).height = 28;

  // Sheet 2 KPI Cards referencing Sheet 1
  const s2Kpis = [
    {
      titleCols: 'A4:B4',
      valCols: 'A5:B5',
      cTitle: 'A4',
      cVal: 'A5',
      title: isAr ? 'إجمالي عدد المزادات' : 'Total Auctions',
      formula: `'تقرير بيانات المزادات'!A6`,
      result: metrics.totalAuctions,
      numFmt: '#,##0',
      color: 'FF922C35',
    },
    {
      titleCols: 'C4:D4',
      valCols: 'C5:D5',
      cTitle: 'C4',
      cVal: 'C5',
      title: isAr ? 'إجمالي المركبات المدرجة' : 'Total Listed Vehicles',
      formula: `'تقرير بيانات المزادات'!D${totalRowIdx}`,
      result: metrics.totalListed,
      numFmt: '#,##0',
      color: 'FF922C35',
    },
    {
      titleCols: 'E4:F4',
      valCols: 'E5:F5',
      cTitle: 'E4',
      cVal: 'E5',
      title: isAr ? 'إجمالي المركبات المبيعة' : 'Total Sold Vehicles',
      formula: `'تقرير بيانات المزادات'!E${totalRowIdx}`,
      result: metrics.totalSold,
      numFmt: '#,##0',
      color: 'FF922C35',
    },
    {
      titleCols: 'G4:H4',
      valCols: 'G5:H5',
      cTitle: 'G4',
      cVal: 'G5',
      title: isAr ? 'إجمالي المركبات غير المبيعة' : 'Total Unsold Vehicles',
      formula: `'تقرير بيانات المزادات'!F${totalRowIdx}`,
      result: metrics.totalUnsold,
      numFmt: '#,##0',
      color: 'FF922C35',
    },
    {
      titleCols: 'I4:I4',
      valCols: 'I5:I5',
      cTitle: 'I4',
      cVal: 'I5',
      title: isAr ? 'نسبة نجاح البيع' : 'Sale Success Rate',
      formula: `'تقرير بيانات المزادات'!H6`,
      result: metrics.overallSaleRate / 100,
      numFmt: '0.0%',
      color: 'FF16843A',
    },
    {
      titleCols: 'J4:J4',
      valCols: 'J5:J5',
      cTitle: 'J4',
      cVal: 'J5',
      title: isAr ? 'متوسط المبيعات لكل مزاد (مركبة/مزاد)' : 'Avg Sold / Auction',
      formula: `IF('تقرير بيانات المزادات'!A6>0,ROUND('تقرير بيانات المزادات'!E${totalRowIdx}/'تقرير بيانات المزادات'!A6,0),0)`,
      result: metrics.avgSoldPerAuction,
      numFmt: '#,##0',
      color: 'FF123B70',
    },
  ];

  for (const kpi of s2Kpis) {
    if (kpi.titleCols.split(':')[0] !== kpi.titleCols.split(':')[1]) {
      sheet2.mergeCells(kpi.titleCols);
      sheet2.mergeCells(kpi.valCols);
    }
    const tCell = sheet2.getCell(kpi.cTitle);
    tCell.value = kpi.title;
    tCell.font = {
      name: 'Cairo',
      size: 11,
      bold: true,
      color: { argb: 'FF123B70' },
    };
    tCell.alignment = { horizontal: 'center', vertical: 'middle' };
    tCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFFFF' },
    };
    tCell.border = {
      top: { style: 'thin', color: { argb: 'FFBCC8D6' } },
      left: { style: 'thin', color: { argb: 'FFBCC8D6' } },
      right: { style: 'thin', color: { argb: 'FFBCC8D6' } },
    };

    const vCell = sheet2.getCell(kpi.cVal);
    vCell.value = { formula: kpi.formula, result: kpi.result };
    vCell.numFmt = kpi.numFmt;
    vCell.font = {
      name: 'Cairo',
      size: 15,
      bold: true,
      color: { argb: kpi.color },
    };
    vCell.alignment = { horizontal: 'center', vertical: 'middle' };
    vCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFFFF' },
    };
    vCell.border = {
      bottom: { style: 'medium', color: { argb: 'FF165B9D' } },
      left: { style: 'thin', color: { argb: 'FFBCC8D6' } },
      right: { style: 'thin', color: { argb: 'FFBCC8D6' } },
    };
  }

  sheet2.getRow(6).height = 12;

  // Section Headers Row 7: Comparative Analysis Table (Cols A-G) + Operational Insights (Cols H-J)
  const s2HeaderRow = sheet2.getRow(7);
  s2HeaderRow.height = 26;

  sheet2.mergeCells('A7:G7');
  const compTitleCell = sheet2.getCell('A7');
  compTitleCell.value = isAr
    ? 'التحليل المقارن لأداء المزادات'
    : 'Comparative Auction Performance Analysis';
  compTitleCell.font = {
    name: 'Cairo',
    size: 12,
    bold: true,
    color: { argb: 'FFFFFFFF' },
  };
  compTitleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF123B70' },
  };
  compTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

  const opHeaders = [
    { col: 'H7', title: isAr ? 'أبرز الملاحظات التشغيلية' : 'Operational Notes' },
    {
      col: 'I7',
      title: isAr ? 'التحديات التشغيلية الرئيسية' : 'Operational Challenges',
    },
    {
      col: 'J7',
      title: isAr
        ? 'التوصيات والإجراءات التحسينية'
        : 'Recommendations & Improvement Actions',
    },
  ];
  for (const oh of opHeaders) {
    const c = sheet2.getCell(oh.col);
    c.value = oh.title;
    c.font = {
      name: 'Cairo',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    c.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF123B70' },
    };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
  }

  // Row 8: Sub-headers for Comparative Table
  const compSubHeaderRow = sheet2.getRow(8);
  compSubHeaderRow.height = 24;
  const compCols = isAr
    ? [
        'رقم المزاد',
        'المدرجة',
        'المبيعة',
        'غير المبيعة',
        'نسبة البيع',
        'نسبة عدم البيع',
        'تقييم الأداء',
      ]
    : [
        'Auction No.',
        'Listed',
        'Sold',
        'Unsold',
        'Sale Rate %',
        'Unsold Rate %',
        'Performance Rating',
      ];
  compCols.forEach((label, idx) => {
    const c = compSubHeaderRow.getCell(idx + 1);
    c.value = label;
    c.font = {
      name: 'Cairo',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    c.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF165B9D' },
    };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  ['H8', 'I8', 'J8'].forEach((addr, idx) => {
    const c = sheet2.getCell(addr);
    c.value =
      idx === 0
        ? isAr
          ? 'الملاحظات المسجلة'
          : 'Recorded Notes'
        : idx === 1
        ? isAr
          ? 'التحديات المرصودة'
          : 'Identified Challenges'
        : isAr
        ? 'التوصيات التنفيذية'
        : 'Actionable Recommendations';
    c.font = {
      name: 'Cairo',
      size: 10,
      bold: true,
      color: { argb: 'FF123B70' },
    };
    c.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFEEF3F9' },
    };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  // Rows 9..9+N-1: Comparative Table + Operational Notes/Challenges/Recommendations
  const s2StartRow = 9;
  auctions.forEach((auc, idx) => {
    const rIdx = s2StartRow + idx;
    const s1Row = dataStartRow + idx;
    const row = sheet2.getRow(rIdx);
    row.height = 24;
    const bgArgb = idx % 2 === 0 ? 'FFFFFFFF' : 'FFE9EFF7';

    row.getCell(1).value = {
      formula: `'تقرير بيانات المزادات'!B${s1Row}`,
      result: auc.auctionNumber,
    };
    row.getCell(2).value = {
      formula: `'تقرير بيانات المزادات'!D${s1Row}`,
      result: auc.listedVehicles,
    };
    row.getCell(3).value = {
      formula: `'تقرير بيانات المزادات'!E${s1Row}`,
      result: auc.soldVehicles,
    };
    row.getCell(4).value = {
      formula: `B${rIdx}-C${rIdx}`,
      result: auc.unsoldVehicles,
    };
    row.getCell(5).value = {
      formula: `IF(B${rIdx}>0,C${rIdx}/B${rIdx},0)`,
      result: auc.saleRate / 100,
    };
    row.getCell(6).value = {
      formula: `IF(B${rIdx}>0,D${rIdx}/B${rIdx},0)`,
      result: auc.unsoldRate / 100,
    };

    const evalBadge = evaluateAuctionPerformance(auc.saleRate, thresholds, lang);
    const goodThresholdDec = thresholds.goodMin / 100;
    const warnThresholdDec = thresholds.needsImprovementMin / 100;

    row.getCell(7).value = {
      formula: `IF(E${rIdx}>=${goodThresholdDec},"أداء جيد",IF(E${rIdx}>=${warnThresholdDec},"يحتاج إلى تحسين","منخفض"))`,
      result: evalBadge.label,
    };

    row.getCell(8).value = `• ${isAr ? auc.notesAr : auc.notesEn} (${
      auc.auctionNumber
    })`;
    row.getCell(9).value = `• ${isAr ? auc.challengesAr : auc.challengesEn} (${
      auc.auctionNumber
    })`;
    row.getCell(10).value = `• ${
      isAr ? auc.recommendationsAr : auc.recommendationsEn
    } (${auc.auctionNumber})`;

    for (let c = 1; c <= 10; c++) {
      const cell = row.getCell(c);
      let fg = bgArgb;
      let fontColor = 'FF0F172A';
      if (c === 5) fontColor = 'FF16843A';
      if (c === 7) {
        fg =
          evalBadge.tier === 'excellent' || evalBadge.tier === 'good'
            ? 'FFD7F0D8'
            : evalBadge.tier === 'warning'
            ? 'FFF5DF99'
            : 'FFFCDAD7';
        fontColor =
          evalBadge.tier === 'excellent' || evalBadge.tier === 'good'
            ? 'FF13652C'
            : evalBadge.tier === 'warning'
            ? 'FF784A00'
            : 'FF9C1C1C';
      }

      cell.font = {
        name: 'Cairo',
        size: 11,
        bold: c <= 7,
        color: { argb: fontColor },
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: fg },
      };
      cell.alignment = {
        horizontal: c <= 7 ? 'center' : 'right',
        vertical: 'middle',
        wrapText: true,
      };
      if (c >= 2 && c <= 4) cell.numFmt = '#,##0';
      if (c === 5 || c === 6) cell.numFmt = '0.0%';
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFBCC8D6' } },
        bottom: { style: 'thin', color: { argb: 'FFBCC8D6' } },
        left: { style: 'thin', color: { argb: 'FFBCC8D6' } },
        right: { style: 'thin', color: { argb: 'FFBCC8D6' } },
      };
    }
  });

  // Executive Summary & Ranked Sale Rate Visual Bars Block below Comparative Table
  const summaryStartRow = s2StartRow + auctions.length + 2;
  sheet2.getRow(summaryStartRow).height = 26;
  sheet2.mergeCells(`A${summaryStartRow}:D${summaryStartRow}`);
  const execSumHeader = sheet2.getCell(`A${summaryStartRow}`);
  execSumHeader.value = isAr
    ? 'الملخص التنفيذي لنتائج المزادات'
    : 'Executive Summary of Auction Results';
  execSumHeader.font = {
    name: 'Cairo',
    size: 12,
    bold: true,
    color: { argb: 'FFFFFFFF' },
  };
  execSumHeader.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF123B70' },
  };
  execSumHeader.alignment = { horizontal: 'center', vertical: 'middle' };

  sheet2.mergeCells(`E${summaryStartRow}:H${summaryStartRow}`);
  const rankHeader = sheet2.getCell(`E${summaryStartRow}`);
  rankHeader.value = isAr
    ? 'ترتيب المزادات تنازلياً حسب نسبة نجاح البيع'
    : 'Auctions Ranked Descending by Sale Success Rate';
  rankHeader.font = {
    name: 'Cairo',
    size: 12,
    bold: true,
    color: { argb: 'FFFFFFFF' },
  };
  rankHeader.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF165B9D' },
  };
  rankHeader.alignment = { horizontal: 'center', vertical: 'middle' };

  sheet2.mergeCells(`I${summaryStartRow}:J${summaryStartRow + 5}`);
  if (carsPhotoId !== null) {
    sheet2.addImage(carsPhotoId, {
      tl: { col: 8.05, row: summaryStartRow - 0.9 },
      ext: { width: 380, height: 145 },
    });
  }

  const summaryItems = [
    {
      label: isAr ? '• عدد المزادات:' : '• Total Auctions:',
      val: metrics.totalAuctions.toString(),
      color: 'FF0F172A',
      bg: 'FFFFFFFF',
    },
    {
      label: isAr ? '• إجمالي المركبات المعروضة:' : '• Total Listed Vehicles:',
      val: metrics.totalListed.toLocaleString('en-US'),
      color: 'FF0F172A',
      bg: 'FFFFFFFF',
    },
    {
      label: isAr ? '• عدد المركبات المبيعة:' : '• Total Sold Vehicles:',
      val: `${metrics.totalSold.toLocaleString('en-US')} (${metrics.overallSaleRate.toFixed(
        1
      )}%)`,
      color: 'FF16843A',
      bg: 'FFFFFFFF',
    },
    {
      label: isAr ? '• عدد المركبات غير المبيعة:' : '• Total Unsold Vehicles:',
      val: `${metrics.totalUnsold.toLocaleString(
        'en-US'
      )} (${metrics.overallUnsoldRate.toFixed(1)}%)`,
      color: 'FFB4232C',
      bg: 'FFFFFFFF',
    },
    {
      label: isAr ? '⬆ أعلى نسبة بيع:' : '⬆ Highest Sale Rate:',
      val: metrics.highestSaleAuction
        ? `${metrics.highestSaleAuction.auctionNumber} (${metrics.highestSaleAuction.saleRate.toFixed(
            1
          )}%)`
        : '-',
      color: 'FF16843A',
      bg: 'FFE3F3E6',
    },
    {
      label: isAr ? '⬇ أقل نسبة بيع:' : '⬇ Lowest Sale Rate:',
      val: metrics.lowestSaleAuction
        ? `${metrics.lowestSaleAuction.auctionNumber} (${metrics.lowestSaleAuction.saleRate.toFixed(
            1
          )}%)`
        : '-',
      color: 'FFB4232C',
      bg: 'FFFCE8E6',
    },
  ];

  const sortedAuctions = [...auctions].sort((a, b) => b.saleRate - a.saleRate);

  for (let i = 0; i < Math.max(summaryItems.length, sortedAuctions.length); i++) {
    const r = summaryStartRow + 1 + i;
    const row = sheet2.getRow(r);
    row.height = 22;

    if (i < summaryItems.length) {
      const sItem = summaryItems[i];
      sheet2.mergeCells(`A${r}:B${r}`);
      sheet2.mergeCells(`C${r}:D${r}`);
      const lCell = sheet2.getCell(`A${r}`);
      const vCell = sheet2.getCell(`C${r}`);
      lCell.value = sItem.label;
      vCell.value = sItem.val;
      [lCell, vCell].forEach((c) => {
        c.font = {
          name: 'Cairo',
          size: 11,
          bold: true,
          color: { argb: sItem.color },
        };
        c.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: sItem.bg },
        };
        c.alignment = { horizontal: 'right', vertical: 'middle' };
        c.border = {
          top: { style: 'thin', color: { argb: 'FFBCC8D6' } },
          bottom: { style: 'thin', color: { argb: 'FFBCC8D6' } },
          left: { style: 'thin', color: { argb: 'FFBCC8D6' } },
          right: { style: 'thin', color: { argb: 'FFBCC8D6' } },
        };
      });
    }

    if (i < sortedAuctions.length) {
      const sa = sortedAuctions[i];
      const cCode = sheet2.getCell(`E${r}`);
      const cRate = sheet2.getCell(`F${r}`);
      sheet2.mergeCells(`G${r}:H${r}`);
      const cBar = sheet2.getCell(`G${r}`);

      cCode.value = sa.auctionNumber;
      cRate.value = sa.saleRate / 100;
      cRate.numFmt = '0.0%';
      const blocks = '█'.repeat(Math.round(sa.saleRate / 5));
      cBar.value = `${blocks} ${sa.saleRate.toFixed(1)}%`;

      [cCode, cRate, cBar].forEach((c, idx) => {
        c.font = {
          name: 'Cairo',
          size: 10.5,
          bold: true,
          color: { argb: idx >= 1 ? 'FF16843A' : 'FF0F172A' },
        };
        c.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFFFFF' },
        };
        c.alignment = {
          horizontal: idx === 2 ? 'left' : 'center',
          vertical: 'middle',
        };
        c.border = {
          top: { style: 'thin', color: { argb: 'FFBCC8D6' } },
          bottom: { style: 'thin', color: { argb: 'FFBCC8D6' } },
          left: { style: 'thin', color: { argb: 'FFBCC8D6' } },
          right: { style: 'thin', color: { argb: 'FFBCC8D6' } },
        };
      });
    }
  }

  // Generate & Trigger Download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'SAAED_Auction_Executive_Report.xlsx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
