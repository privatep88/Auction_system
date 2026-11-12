/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FileSpreadsheet,
  FileDown,
  Printer,
  Plus,
  Save,
  RefreshCw,
  Settings,
  Globe,
  Eye,
  LayoutGrid,
  Table2,
  BarChart3,
  CheckCircle2,
  Database,
  FileSearch,
} from 'lucide-react';
import {
  AuctionRecord,
  FirebaseConnectionConfig,
  Language,
  PerformanceThresholds,
  ReportingPeriod,
  ReportMetadata,
  ViewMode,
} from './types/auction';
import {
  calculateMetrics,
  deleteSingleAuctionFromCloud,
  executeApprovedOctToNovMigration,
  getAdjacentPeriod,
  getArchivedPeriodsSummary,
  getCurrentUaePeriod,
  getMonthName,
  getOctToNovMigrationSummary,
  getStoredFirebaseConfig,
  initFirebaseIfConfigured,
  loadPeriodData,
  loadSelectedPeriod,
  loadThresholds,
  normalizeAuctionRecord,
  persistSingleAuctionToCloud,
  resetOctoberReferenceData,
  restorePreMigrationBackup,
  saveFirebaseConfig,
  savePeriodAuctions,
  savePeriodMetadata,
  saveSelectedPeriod,
  saveThresholds,
  syncPeriodWithCloud,
} from './services/storageService';
import { AuctionDataReport } from './components/AuctionDataReport';
import { ExecutiveDashboard } from './components/ExecutiveDashboard';
import {
  AuctionFormModal,
  DeleteConfirmModal,
  MigrationApprovalModal,
  SettingsModal,
  UnsavedPeriodSwitchModal,
} from './components/Modals';
import { exportExecutiveExcelReport } from './services/excelExportService';
import {
  exportExecutivePdfReport,
  triggerOfficialReportPrint,
} from './services/pdfExportService';
import {
  ExecutiveAuctionPrintReport,
  OfficialReportPreviewModal,
  PaperSizeOption,
} from './components/ExecutiveAuctionPrintReport';

export default function App() {
  // Initialize migration summary & backup before loading period data
  const [migrationSummary, setMigrationSummary] = useState(() =>
    getOctToNovMigrationSummary()
  );
  const [migrationModalOpen, setMigrationModalOpen] = useState<boolean>(false);

  const [selectedPeriod, setSelectedPeriod] = useState<ReportingPeriod>(() =>
    loadSelectedPeriod()
  );

  const initialPeriodData = useMemo(
    () => loadPeriodData(selectedPeriod.year, selectedPeriod.month),
    []
  );

  const [auctions, setAuctions] = useState<AuctionRecord[]>(
    () => initialPeriodData.auctions
  );
  const [metadata, setMetadata] = useState<ReportMetadata>(
    () => initialPeriodData.metadata
  );
  const [thresholds, setThresholds] = useState<PerformanceThresholds>(() =>
    loadThresholds()
  );
  const [lang, setLang] = useState<Language>('ar');
  const [viewMode, setViewMode] = useState<ViewMode>('combined');
  const [pixelPerfectMode, setPixelPerfectMode] = useState<boolean>(false);

  // Archive Summary State (tracks which years and months contain records)
  const [archiveSummary, setArchiveSummary] = useState(() =>
    getArchivedPeriodsSummary()
  );

  // Dirty Inline Edit Guard when switching months
  const [hasUnsavedInlineEdit, setHasUnsavedInlineEdit] =
    useState<boolean>(false);
  const [pendingPeriodSwitch, setPendingPeriodSwitch] =
    useState<ReportingPeriod | null>(null);

  // Modals State
  const [formModalOpen, setFormModalOpen] = useState<boolean>(false);
  const [formModalMode, setFormModalMode] = useState<'add' | 'edit'>('add');
  const [editingRecord, setEditingRecord] = useState<AuctionRecord | null>(
    null
  );
  const [deletingRecord, setDeletingRecord] = useState<AuctionRecord | null>(
    null
  );
  const [settingsModalOpen, setSettingsModalOpen] = useState<boolean>(false);

  // Export, Print Preview & Persistence Status
  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [previewModalOpen, setPreviewModalOpen] = useState<boolean>(false);
  const [paperSize, setPaperSize] = useState<PaperSizeOption>('a4');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [firebaseConnected, setFirebaseConnected] = useState<boolean>(false);
  const [firebaseConfig, setFirebaseConfig] =
    useState<FirebaseConnectionConfig | null>(() => getStoredFirebaseConfig());

  const isAr = lang === 'ar';
  const currentMonthName = getMonthName(selectedPeriod.month, lang);

  const refreshArchiveSummary = useCallback(() => {
    setArchiveSummary(getArchivedPeriodsSummary());
  }, []);

  useEffect(() => {
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang, isAr]);

  // Apply period switch cleanly and synchronously load that month's archived data
  const executePeriodSwitch = useCallback(
    (targetYear: number, targetMonth: number) => {
      const normalizedPeriod: ReportingPeriod = {
        year: Number(targetYear) || 2026,
        month: Math.min(12, Math.max(1, Number(targetMonth) || 1)),
      };
      setSelectedPeriod(normalizedPeriod);
      saveSelectedPeriod(normalizedPeriod);
      setHasUnsavedInlineEdit(false);
      setPendingPeriodSwitch(null);

      const loaded = loadPeriodData(
        normalizedPeriod.year,
        normalizedPeriod.month
      );
      setAuctions(loaded.auctions);
      setMetadata(loaded.metadata);
      refreshArchiveSummary();

      if (firebaseConnected) {
        syncPeriodWithCloud(
          normalizedPeriod.year,
          normalizedPeriod.month,
          loaded.auctions
        ).then(({ records, syncedWithFirestore }) => {
          setAuctions(records);
          setFirebaseConnected(syncedWithFirestore);
          refreshArchiveSummary();
        });
      }
    },
    [firebaseConnected, refreshArchiveSummary]
  );

  const requestPeriodSwitch = useCallback(
    (targetYear: number, targetMonth: number) => {
      if (
        targetYear === selectedPeriod.year &&
        targetMonth === selectedPeriod.month
      ) {
        return;
      }
      if (hasUnsavedInlineEdit) {
        setPendingPeriodSwitch({ year: targetYear, month: targetMonth });
        return;
      }
      executePeriodSwitch(targetYear, targetMonth);
    },
    [selectedPeriod, hasUnsavedInlineEdit, executePeriodSwitch]
  );

  const handlePrevMonth = useCallback(() => {
    const prev = getAdjacentPeriod(
      selectedPeriod.year,
      selectedPeriod.month,
      -1
    );
    requestPeriodSwitch(prev.year, prev.month);
  }, [selectedPeriod, requestPeriodSwitch]);

  const handleNextMonth = useCallback(() => {
    const next = getAdjacentPeriod(
      selectedPeriod.year,
      selectedPeriod.month,
      1
    );
    requestPeriodSwitch(next.year, next.month);
  }, [selectedPeriod, requestPeriodSwitch]);

  const handleReturnToCurrentMonth = useCallback(() => {
    const uaeNow = getCurrentUaePeriod(new Date());
    requestPeriodSwitch(uaeNow.year, uaeNow.month);
  }, [requestPeriodSwitch]);

  const handleApproveMigrationAndZero = async (
    conflictMode: 'replace' | 'merge' = 'replace'
  ) => {
    const res = await executeApprovedOctToNovMigration(conflictMode);
    setMigrationSummary(getOctToNovMigrationSummary());
    refreshArchiveSummary();
    const loaded = loadPeriodData(selectedPeriod.year, selectedPeriod.month);
    setAuctions(loaded.auctions);
    setMetadata(loaded.metadata);
    setMigrationModalOpen(false);
    showToast(isAr ? res.messageAr : res.messageEn);
  };

  const handleRestorePreMigrationBackup = () => {
    const res = restorePreMigrationBackup();
    setMigrationSummary(getOctToNovMigrationSummary());
    refreshArchiveSummary();
    const loaded = loadPeriodData(selectedPeriod.year, selectedPeriod.month);
    setAuctions(loaded.auctions);
    setMetadata(loaded.metadata);
    setMigrationModalOpen(false);
    showToast(isAr ? res.messageAr : res.messageEn);
  };

  useEffect(() => {
    const fbStatus = initFirebaseIfConfigured();
    setFirebaseConnected(fbStatus.connected);
    if (fbStatus.connected) {
      syncPeriodWithCloud(
        selectedPeriod.year,
        selectedPeriod.month,
        auctions
      ).then(({ records, syncedWithFirestore }) => {
        setAuctions(records);
        setFirebaseConnected(syncedWithFirestore);
        refreshArchiveSummary();
      });
    }
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  const metrics = useMemo(() => calculateMetrics(auctions), [auctions]);

  const handleUpdateMetadata = (newMeta: ReportMetadata) => {
    setMetadata(newMeta);
    savePeriodMetadata(selectedPeriod.year, selectedPeriod.month, newMeta);
    showToast(
      isAr
        ? `تم تحديث تواريخ تقرير شهر ${currentMonthName} ${selectedPeriod.year} وحفظها.`
        : `Report dates for ${currentMonthName} ${selectedPeriod.year} updated.`
    );
  };

  const handleSaveAuctionFromModal = async (record: AuctionRecord) => {
    const normalized = normalizeAuctionRecord(record, selectedPeriod);
    let updatedList: AuctionRecord[];
    if (formModalMode === 'add') {
      updatedList = [...auctions, normalized];
    } else {
      updatedList = auctions.map((a) =>
        a.id === normalized.id ? normalized : a
      );
    }
    const saved = savePeriodAuctions(
      selectedPeriod.year,
      selectedPeriod.month,
      updatedList
    );
    setAuctions(saved);
    refreshArchiveSummary();
    setFormModalOpen(false);
    setEditingRecord(null);
    await persistSingleAuctionToCloud(normalized);
    showToast(
      formModalMode === 'add'
        ? isAr
          ? `تمت إضافة المزاد (${normalized.auctionNumber}) لشهر ${currentMonthName} ${selectedPeriod.year} وحفظه.`
          : `Auction (${normalized.auctionNumber}) added to ${currentMonthName} ${selectedPeriod.year}.`
        : isAr
        ? `تم حفظ تعديلات المزاد (${normalized.auctionNumber}) لشهر ${currentMonthName} ${selectedPeriod.year}.`
        : `Auction (${normalized.auctionNumber}) updated in ${currentMonthName} ${selectedPeriod.year}.`
    );
  };

  const handleInlineSaveAuction = (
    draft: AuctionRecord
  ): { ok: boolean; error?: string } => {
    const cleanCode = draft.auctionNumber.trim().toUpperCase();
    if (!cleanCode) {
      return {
        ok: false,
        error: isAr ? 'يرجى إدخال رقم المزاد.' : 'Auction number is required.',
      };
    }
    const isDuplicate = auctions.some(
      (a) => a.auctionNumber.toUpperCase() === cleanCode && a.id !== draft.id
    );
    if (isDuplicate) {
      return {
        ok: false,
        error: isAr
          ? `رقم المزاد (${cleanCode}) مكرر في شهر ${currentMonthName} ${selectedPeriod.year}. يمنع تكرار أرقام المزادات داخل الشهر نفسه.`
          : `Duplicate auction number (${cleanCode}) in ${currentMonthName} ${selectedPeriod.year}.`,
      };
    }
    if (draft.listedVehicles <= 0) {
      return {
        ok: false,
        error: isAr
          ? 'عدد المركبات المدرجة يجب أن يكون أكبر من صفر.'
          : 'Listed vehicles must be greater than zero.',
      };
    }
    if (draft.soldVehicles < 0 || draft.soldVehicles > draft.listedVehicles) {
      return {
        ok: false,
        error: isAr
          ? 'عدد المركبات المبيعة لا يمكن أن يتجاوز عدد المركبات المدرجة!'
          : 'Sold vehicles cannot exceed listed vehicles!',
      };
    }

    const normalized = normalizeAuctionRecord(
      {
        ...draft,
        year: selectedPeriod.year,
        month: selectedPeriod.month,
        auctionNumber: cleanCode,
        updatedAt: new Date().toISOString(),
      },
      selectedPeriod
    );
    const updatedList = auctions.map((a) =>
      a.id === normalized.id ? normalized : a
    );
    const saved = savePeriodAuctions(
      selectedPeriod.year,
      selectedPeriod.month,
      updatedList
    );
    setAuctions(saved);
    refreshArchiveSummary();
    persistSingleAuctionToCloud(normalized);
    showToast(
      isAr
        ? `تم تحديث بيانات المزاد (${normalized.auctionNumber}) لشهر ${currentMonthName} ${selectedPeriod.year}.`
        : `Auction (${normalized.auctionNumber}) updated.`
    );
    return { ok: true };
  };

  const handleConfirmDelete = async (record: AuctionRecord) => {
    const updated = auctions.filter((a) => a.id !== record.id);
    const saved = savePeriodAuctions(
      selectedPeriod.year,
      selectedPeriod.month,
      updated
    );
    setAuctions(saved);
    refreshArchiveSummary();
    setDeletingRecord(null);
    await deleteSingleAuctionFromCloud(record);
    showToast(
      isAr
        ? `تم حذف المزاد (${record.auctionNumber}) من شهر ${currentMonthName} ${selectedPeriod.year}.`
        : `Auction (${record.auctionNumber}) deleted from ${currentMonthName} ${selectedPeriod.year}.`
    );
  };

  const handleManualSaveAll = async () => {
    const saved = savePeriodAuctions(
      selectedPeriod.year,
      selectedPeriod.month,
      auctions
    );
    savePeriodMetadata(selectedPeriod.year, selectedPeriod.month, metadata);
    saveThresholds(thresholds);
    setAuctions(saved);
    refreshArchiveSummary();
    if (firebaseConnected) {
      await syncPeriodWithCloud(
        selectedPeriod.year,
        selectedPeriod.month,
        saved
      );
    }
    showToast(
      firebaseConnected
        ? isAr
          ? `تم حفظ بيانات شهر ${currentMonthName} ${selectedPeriod.year} محلياً ومزامنتها مع Firebase Firestore.`
          : `Saved ${currentMonthName} ${selectedPeriod.year} locally and synced with Firestore.`
        : isAr
        ? `تم حفظ وأرشفة سجلات شهر ${currentMonthName} ${selectedPeriod.year} بنجاح.`
        : `Archived records for ${currentMonthName} ${selectedPeriod.year} saved.`
    );
  };

  const handleRefreshReport = () => {
    const reloaded = loadPeriodData(selectedPeriod.year, selectedPeriod.month);
    setAuctions([...reloaded.auctions]);
    setMetadata({ ...reloaded.metadata });
    refreshArchiveSummary();
    showToast(
      isAr
        ? `تم تحديث تقرير شهر ${currentMonthName} ${selectedPeriod.year} وإعادة حساب المؤشرات.`
        : `Refreshed report for ${currentMonthName} ${selectedPeriod.year}.`
    );
  };

  const handleExportExcel = async () => {
    try {
      setIsExportingExcel(true);
      const exportedFileName = await exportExecutiveExcelReport({
        auctions,
        metrics,
        metadata,
        selectedPeriod,
        thresholds,
        lang,
      });
      showToast(
        isAr
          ? `تم تصدير ملف ${exportedFileName} لشهر ${currentMonthName} ${selectedPeriod.year}.`
          : `Exported ${exportedFileName} for ${currentMonthName} ${selectedPeriod.year}.`
      );
    } catch (err) {
      console.error('Excel export failed:', err);
      showToast(
        isAr
          ? 'حدث خطأ أثناء تصدير ملف Excel.'
          : 'Failed to export Excel report.'
      );
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleExportPdf = async () => {
    try {
      setIsExportingPdf(true);
      const exportedFileName = await exportExecutivePdfReport({
        metadata,
        selectedPeriod,
        lang,
        paperSize,
      });
      showToast(
        isAr
          ? `تم تصدير التقرير الرسمي (${exportedFileName}) لشهر ${currentMonthName} ${selectedPeriod.year} بنجاح.`
          : `Exported official report (${exportedFileName}) for ${currentMonthName} ${selectedPeriod.year}.`
      );
    } catch (error) {
      console.error('PDF_EXPORT_FAILED:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        selectedPeriod,
        paperSize,
      });
      showToast(
        isAr
          ? 'تعذر إنشاء ملف PDF. يرجى إعادة المحاولة.'
          : 'Unable to generate PDF file. Please try again.'
      );
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handlePrint = async () => {
    await triggerOfficialReportPrint(paperSize);
  };

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="min-h-screen bg-[#E4ECF5] text-[#0F172A] flex flex-col"
    >
      {/* INTERACTIVE WORKSPACE ROOT (Hidden during native printing; Official Report Mount prints instead) */}
      <div id="interactive-workspace-root" className="flex-1 flex flex-col">

      {/* EXECUTIVE ACTION & NAVIGATION TOOLBAR (Hidden when printing) */}
      <header className="no-print sticky top-0 z-40 bg-[#0E2E58] text-white border-b border-[#25548B] shadow-md px-3 py-2">
        <div className="max-w-[1560px] mx-auto flex flex-wrap items-center justify-between gap-2">
          {/* Navigation Tabs (Combined | Sheet 1 | Sheet 2) */}
          <div className="flex items-center gap-1 bg-[#081F3D] p-1 rounded-xl border border-[#24528A]">
            <button
              type="button"
              onClick={() => setViewMode('combined')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                viewMode === 'combined'
                  ? 'bg-[#D5A03D] text-[#0A1E3C] shadow-xs'
                  : 'text-white/85 hover:text-white hover:bg-white/10'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>
                {isAr
                  ? 'العرض التنفيذي الشامل (الورقتان معاً)'
                  : 'Full Reference View (Both Sheets)'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('sheet1')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                viewMode === 'sheet1'
                  ? 'bg-[#165B9D] text-white shadow-xs'
                  : 'text-white/85 hover:text-white hover:bg-white/10'
              }`}
            >
              <Table2 className="w-3.5 h-3.5" />
              <span>
                {isAr
                  ? '1. تقرير بيانات المزادات'
                  : '1. Auction Data Report'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('sheet2')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                viewMode === 'sheet2'
                  ? 'bg-[#165B9D] text-white shadow-xs'
                  : 'text-white/85 hover:text-white hover:bg-white/10'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>
                {isAr
                  ? '2. لوحة التحليل التنفيذي'
                  : '2. Executive Dashboard'}
              </span>
            </button>
          </div>

          {/* Functional Executive Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Add New Auction */}
            <button
              type="button"
              onClick={() => {
                setFormModalMode('add');
                setEditingRecord(null);
                setFormModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-extrabold bg-[#16843A] hover:bg-[#136F30] text-white rounded-lg shadow-xs transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isAr ? 'إضافة مزاد جديد' : 'Add Auction'}</span>
            </button>

            {/* Save Data */}
            <button
              type="button"
              onClick={handleManualSaveAll}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold bg-[#165B9D] hover:bg-[#1B6BB8] text-white rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isAr ? 'حفظ البيانات' : 'Save Data'}</span>
            </button>

            {/* Refresh Report */}
            <button
              type="button"
              onClick={handleRefreshReport}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {isAr ? 'تحديث التقرير' : 'Refresh'}
              </span>
            </button>

            {/* Export Excel */}
            <button
              type="button"
              disabled={isExportingExcel}
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold bg-[#107C41] hover:bg-[#0D6534] text-white rounded-lg shadow-xs transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>
                {isExportingExcel
                  ? isAr
                    ? 'جاري تصدير Excel...'
                    : 'Exporting Excel...'
                  : isAr
                  ? 'تصدير التقرير إلى Excel'
                  : 'Export Excel'}
              </span>
            </button>

            {/* Official Report Preview */}
            <button
              type="button"
              onClick={() => setPreviewModalOpen(true)}
              title={
                isAr
                  ? 'معاينة صفحات التقرير الرسمي (A4 / A3) قبل الطباعة أو تصدير PDF'
                  : 'Official Multi-Page Print & PDF Preview'
              }
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold bg-[#D5A03D] hover:bg-[#C28E2E] text-[#0A1E3C] rounded-lg shadow-xs transition-colors cursor-pointer whitespace-nowrap"
            >
              <FileSearch className="w-3.5 h-3.5" />
              <span>{isAr ? 'معاينة التقرير' : 'Preview Report'}</span>
            </button>

            {/* Export PDF */}
            <button
              type="button"
              disabled={isExportingPdf}
              onClick={handleExportPdf}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold bg-[#922C35] hover:bg-[#7A222A] text-white rounded-lg shadow-xs transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>
                {isExportingPdf
                  ? isAr
                    ? 'جارٍ تجهيز التقرير وتصديره...'
                    : 'Preparing & Exporting PDF...'
                  : isAr
                  ? 'تصدير PDF'
                  : 'Export PDF'}
              </span>
            </button>

            {/* Print Report */}
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden md:inline">
                {isAr ? 'طباعة التقرير' : 'Print'}
              </span>
            </button>

            {/* Pixel-Perfect Reference Mode Toggle */}
            <button
              type="button"
              onClick={() => setPixelPerfectMode(!pixelPerfectMode)}
              title={
                isAr
                  ? 'إظهار/إخفاء أدوات البحث والإجراءات لمعاينة التطابق المرجعي 100%'
                  : 'Toggle 100% Reference Visual Match Mode'
              }
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                pixelPerfectMode
                  ? 'bg-[#D5A03D] text-[#0A1E3C]'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">
                {pixelPerfectMode
                  ? isAr
                    ? 'وضع المرجع: مفعّل'
                    : 'Ref Mode: ON'
                  : isAr
                  ? 'معاينة المرجع'
                  : 'Ref Mode'}
              </span>
            </button>

            {/* System Settings & Thresholds */}
            <button
              type="button"
              onClick={() => setSettingsModalOpen(true)}
              title={
                isAr
                  ? 'إعدادات حدود التقييم وربط قاعدة البيانات'
                  : 'Settings & Thresholds'
              }
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              <Database
                className={`w-3 h-3 ${
                  firebaseConnected ? 'text-emerald-400' : 'text-amber-300'
                }`}
              />
            </button>

            {/* Language Switcher (AR / EN) */}
            <button
              type="button"
              onClick={() => setLang(isAr ? 'en' : 'ar')}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-extrabold bg-white text-[#123B70] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{isAr ? 'EN' : 'عربي'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="no-print fixed bottom-4 end-4 z-50 bg-[#0E2E58] text-white border border-[#D5A03D] px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs sm:text-sm font-bold animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-[#4ADE80] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* MAIN EXECUTIVE WORKSPACE CANVAS (1536px Reference Max-Width Container) */}
      <main className="flex-1 w-full max-w-[1540px] mx-auto px-2 sm:px-3 py-2.5 space-y-3">
        {/* PRE-ZEROING MIGRATION SUMMARY & EXPLICIT USER APPROVAL BANNER */}
        {migrationSummary.migrationState === 'pending_approval' &&
          !pixelPerfectMode && (
            <div className="no-print bg-[#FEFCE8] border border-[#FDE047] rounded-[14px] px-4 py-2.5 shadow-xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs sm:text-[13px] font-extrabold text-[#14243D]">
                <span className="px-2 py-0.5 rounded-md bg-[#123B70] text-[#D6A348] text-[11px] font-black whitespace-nowrap">
                  {isAr ? 'حماية وترحيل البيانات' : 'Data Migration Protection'}
                </span>
                <span>
                  {isAr
                    ? `تم إنشاء نسخة احتياطية كاملة ونسخ مزادات أكتوبر 2026 (${migrationSummary.sourceRecords.length} مزادات، ${migrationSummary.totalListedToMigrate.toLocaleString('en-US')} مركبة) إلى نوفمبر 2026 بتطابق 100%. يرجى الموافقة لتنفيذ تصفير أكتوبر وبقية الأشهر.`
                    : `Full backup created & ${migrationSummary.sourceRecords.length} October 2026 auctions copied to November 2026 (100% parity). Please approve to zero October and other months.`}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setMigrationModalOpen(true)}
                  className="px-3 py-1.5 text-xs font-extrabold text-[#123B70] bg-white hover:bg-slate-50 border border-[#CBD5E1] rounded-lg cursor-pointer whitespace-nowrap"
                >
                  {isAr
                    ? 'عرض ملخص المقارنة والنسخة الاحتياطية'
                    : 'View Summary & Backup'}
                </button>
                <button
                  type="button"
                  onClick={() => handleApproveMigrationAndZero('replace')}
                  className="px-3.5 py-1.5 text-xs font-extrabold text-white bg-[#16843B] hover:bg-[#126E30] rounded-lg shadow-2xs cursor-pointer whitespace-nowrap"
                >
                  {isAr
                    ? 'الموافقة وتصفير أكتوبر وبقية الأشهر'
                    : 'Approve & Zero Other Months'}
                </button>
              </div>
            </div>
          )}

        {(viewMode === 'combined' || viewMode === 'sheet1') && (
          <AuctionDataReport
            auctions={auctions}
            metrics={metrics}
            metadata={metadata}
            selectedPeriod={selectedPeriod}
            yearsWithData={archiveSummary.yearsWithData}
            countsByPeriodKey={archiveSummary.countsByPeriodKey}
            lang={lang}
            pixelPerfectMode={pixelPerfectMode}
            migrationState={migrationSummary.migrationState}
            onSelectPeriod={requestPeriodSwitch}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
            onReturnToCurrentMonth={handleReturnToCurrentMonth}
            onOpenMigrationModal={() => setMigrationModalOpen(true)}
            onUpdateMetadata={handleUpdateMetadata}
            onOpenAddModal={() => {
              setFormModalMode('add');
              setEditingRecord(null);
              setFormModalOpen(true);
            }}
            onOpenEditModal={(rec) => {
              setFormModalMode('edit');
              setEditingRecord(rec);
              setFormModalOpen(true);
            }}
            onDeleteAuction={(rec) => setDeletingRecord(rec)}
            onInlineSaveAuction={handleInlineSaveAuction}
            onInlineDirtyChange={setHasUnsavedInlineEdit}
            onSwitchToSheet2={() =>
              setViewMode(viewMode === 'sheet1' ? 'sheet2' : 'sheet2')
            }
          />
        )}

        {(viewMode === 'combined' || viewMode === 'sheet2') && (
          <ExecutiveDashboard
            auctions={auctions}
            metrics={metrics}
            thresholds={thresholds}
            selectedPeriod={selectedPeriod}
            yearsWithData={archiveSummary.yearsWithData}
            countsByPeriodKey={archiveSummary.countsByPeriodKey}
            showStandalonePeriodBar={viewMode === 'sheet2'}
            lang={lang}
            pixelPerfectMode={pixelPerfectMode}
            migrationState={migrationSummary.migrationState}
            onSelectPeriod={requestPeriodSwitch}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
            onReturnToCurrentMonth={handleReturnToCurrentMonth}
            onOpenMigrationModal={() => setMigrationModalOpen(true)}
            onOpenAddModal={() => {
              setFormModalMode('add');
              setEditingRecord(null);
              setFormModalOpen(true);
            }}
            onOpenThresholdModal={() => setSettingsModalOpen(true)}
            onSwitchToSheet1={() =>
              setViewMode(viewMode === 'sheet2' ? 'sheet1' : 'sheet1')
            }
          />
        )}
      </main>

      {/* Modals */}
      <AuctionFormModal
        isOpen={formModalOpen}
        mode={formModalMode}
        selectedPeriod={selectedPeriod}
        initialRecord={editingRecord}
        existingAuctions={auctions}
        lang={lang}
        onClose={() => {
          setFormModalOpen(false);
          setEditingRecord(null);
        }}
        onSave={handleSaveAuctionFromModal}
      />

      <DeleteConfirmModal
        record={deletingRecord}
        lang={lang}
        onCancel={() => setDeletingRecord(null)}
        onConfirm={handleConfirmDelete}
      />

      <UnsavedPeriodSwitchModal
        pendingPeriod={pendingPeriodSwitch}
        lang={lang}
        onCancel={() => setPendingPeriodSwitch(null)}
        onDiscardAndSwitch={(target) =>
          executePeriodSwitch(target.year, target.month)
        }
      />

      <SettingsModal
        isOpen={settingsModalOpen}
        thresholds={thresholds}
        firebaseConfig={firebaseConfig}
        firebaseConnected={firebaseConnected}
        lang={lang}
        onClose={() => setSettingsModalOpen(false)}
        onSaveThresholds={(newT) => {
          setThresholds(newT);
          saveThresholds(newT);
          showToast(
            isAr
              ? 'تم تحديث حدود تقييم الأداء بنجاح.'
              : 'Performance rating thresholds updated.'
          );
        }}
        onSaveFirebase={(cfg) => {
          setFirebaseConfig(cfg);
          const res = saveFirebaseConfig(cfg);
          setFirebaseConnected(res.connected);
          if (res.connected) {
            syncPeriodWithCloud(
              selectedPeriod.year,
              selectedPeriod.month,
              auctions
            ).then(({ records }) => {
              setAuctions(records);
              refreshArchiveSummary();
            });
          }
        }}
        onResetDefaults={() => {
          const def = resetOctoberReferenceData();
          executePeriodSwitch(2026, 11);
          setThresholds(def.thresholds);
          setMigrationSummary(getOctToNovMigrationSummary());
          showToast(
            isAr
              ? 'تمت استعادة البيانات المنقولة لشهر نوفمبر 2026 (دون المساس بالأشهر الأخرى).'
              : 'Restored November 2026 migrated data (other months preserved).'
          );
        }}
      />

      <MigrationApprovalModal
        isOpen={migrationModalOpen}
        summary={migrationSummary}
        lang={lang}
        onClose={() => setMigrationModalOpen(false)}
        onApproveMigrationAndZero={handleApproveMigrationAndZero}
        onRestoreBackup={handleRestorePreMigrationBackup}
      />
      </div>

      {/* OFFICIAL MULTI-PAGE REPORT PREVIEW MODAL */}
      <OfficialReportPreviewModal
        isOpen={previewModalOpen}
        auctions={auctions}
        metrics={metrics}
        metadata={metadata}
        thresholds={thresholds}
        selectedPeriod={selectedPeriod}
        lang={lang}
        paperSize={paperSize}
        isExportingPdf={isExportingPdf}
        onChangePaperSize={setPaperSize}
        onClose={() => setPreviewModalOpen(false)}
        onPrintOfficial={handlePrint}
        onExportPdfOfficial={handleExportPdf}
      />

      {/* UNIFIED OFFICIAL REPORT MOUNT FOR NATIVE VECTOR PRINT & PDF EXPORT */}
      <div id="saaed-official-print-mount" aria-hidden="true">
        <ExecutiveAuctionPrintReport
          auctions={auctions}
          metrics={metrics}
          metadata={metadata}
          thresholds={thresholds}
          selectedPeriod={selectedPeriod}
          lang={lang}
          paperSize={paperSize}
        />
      </div>
    </div>
  );
}
