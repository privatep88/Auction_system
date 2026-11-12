/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
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
} from 'lucide-react';
import {
  AuctionRecord,
  FirebaseConnectionConfig,
  Language,
  PerformanceThresholds,
  ReportMetadata,
  ViewMode,
} from './types/auction';
import {
  calculateMetrics,
  deleteSingleAuctionFromCloud,
  getStoredFirebaseConfig,
  initFirebaseIfConfigured,
  loadLocalAuctions,
  loadMetadata,
  loadThresholds,
  normalizeAuctionRecord,
  persistSingleAuctionToCloud,
  resetToDefaultData,
  saveFirebaseConfig,
  saveLocalAuctions,
  saveMetadata,
  saveThresholds,
  syncAuctionsWithCloud,
} from './services/storageService';
import { AuctionDataReport } from './components/AuctionDataReport';
import { ExecutiveDashboard } from './components/ExecutiveDashboard';
import {
  AuctionFormModal,
  DeleteConfirmModal,
  SettingsModal,
} from './components/Modals';
import { exportExecutiveExcelReport } from './services/excelExportService';
import { exportExecutivePdfReport } from './services/pdfExportService';

export default function App() {
  const [auctions, setAuctions] = useState<AuctionRecord[]>(() =>
    loadLocalAuctions()
  );
  const [metadata, setMetadata] = useState<ReportMetadata>(() =>
    loadMetadata()
  );
  const [thresholds, setThresholds] = useState<PerformanceThresholds>(() =>
    loadThresholds()
  );
  const [lang, setLang] = useState<Language>('ar');
  const [viewMode, setViewMode] = useState<ViewMode>('combined');
  const [pixelPerfectMode, setPixelPerfectMode] = useState<boolean>(false);

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

  // Export & Persistence Status
  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [firebaseConnected, setFirebaseConnected] = useState<boolean>(false);
  const [firebaseConfig, setFirebaseConfig] =
    useState<FirebaseConnectionConfig | null>(() => getStoredFirebaseConfig());

  const isAr = lang === 'ar';

  useEffect(() => {
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang, isAr]);

  useEffect(() => {
    const fbStatus = initFirebaseIfConfigured();
    setFirebaseConnected(fbStatus.connected);
    if (fbStatus.connected) {
      syncAuctionsWithCloud(loadLocalAuctions()).then(
        ({ records, syncedWithFirestore }) => {
          setAuctions(records);
          setFirebaseConnected(syncedWithFirestore);
        }
      );
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
    saveMetadata(newMeta);
    showToast(
      isAr
        ? 'تم تحديث تواريخ التقرير وحفظها تلقائياً.'
        : 'Report dates updated and saved.'
    );
  };

  const handleSaveAuctionFromModal = async (record: AuctionRecord) => {
    const normalized = normalizeAuctionRecord(record);
    let updatedList: AuctionRecord[];
    if (formModalMode === 'add') {
      updatedList = [...auctions, normalized];
    } else {
      updatedList = auctions.map((a) =>
        a.id === normalized.id ? normalized : a
      );
    }
    const saved = saveLocalAuctions(updatedList);
    setAuctions(saved);
    setFormModalOpen(false);
    setEditingRecord(null);
    await persistSingleAuctionToCloud(normalized);
    showToast(
      formModalMode === 'add'
        ? isAr
          ? `تمت إضافة المزاد (${normalized.auctionNumber}) وتحديث المؤشرات بنجاح.`
          : `Auction (${normalized.auctionNumber}) added and KPIs updated.`
        : isAr
        ? `تم حفظ تعديلات المزاد (${normalized.auctionNumber}) بنجاح.`
        : `Auction (${normalized.auctionNumber}) updated successfully.`
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
          ? `رقم المزاد (${cleanCode}) مكرر. يمنع تكرار أرقام المزادات.`
          : `Duplicate auction number (${cleanCode}) is not allowed.`,
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

    const normalized = normalizeAuctionRecord({
      ...draft,
      auctionNumber: cleanCode,
      updatedAt: new Date().toISOString(),
    });
    const updatedList = auctions.map((a) =>
      a.id === normalized.id ? normalized : a
    );
    const saved = saveLocalAuctions(updatedList);
    setAuctions(saved);
    persistSingleAuctionToCloud(normalized);
    showToast(
      isAr
        ? `تم تحديث بيانات المزاد (${normalized.auctionNumber}) والمؤشرات التنفيذية.`
        : `Auction (${normalized.auctionNumber}) updated.`
    );
    return { ok: true };
  };

  const handleConfirmDelete = async (record: AuctionRecord) => {
    const updated = auctions.filter((a) => a.id !== record.id);
    const saved = saveLocalAuctions(updated);
    setAuctions(saved);
    setDeletingRecord(null);
    await deleteSingleAuctionFromCloud(record.id);
    showToast(
      isAr
        ? `تم حذف المزاد (${record.auctionNumber}) وتحديث التقرير.`
        : `Auction (${record.auctionNumber}) deleted.`
    );
  };

  const handleManualSaveAll = async () => {
    const saved = saveLocalAuctions(auctions);
    saveMetadata(metadata);
    saveThresholds(thresholds);
    setAuctions(saved);
    if (firebaseConnected) {
      await syncAuctionsWithCloud(saved);
    }
    showToast(
      firebaseConnected
        ? isAr
          ? 'تم حفظ البيانات محلياً ومزامنتها مع سحابة Firebase Firestore بنجاح.'
          : 'Data saved locally and synced with Firebase Firestore.'
        : isAr
        ? 'تم حفظ جميع السجلات والإعدادات بنجاح في وحدة التخزين الدائمة.'
        : 'All records and settings saved to persistent storage.'
    );
  };

  const handleRefreshReport = () => {
    const reloaded = loadLocalAuctions();
    setAuctions([...reloaded]);
    showToast(
      isAr
        ? 'تم تحديث التقرير وإعادة حساب جميع المؤشرات والرسوم البيانية.'
        : 'Report refreshed and all metrics recalculated.'
    );
  };

  const handleExportExcel = async () => {
    try {
      setIsExportingExcel(true);
      await exportExecutiveExcelReport({
        auctions,
        metrics,
        metadata,
        thresholds,
        lang,
      });
      showToast(
        isAr
          ? 'تم تصدير ملف SAAED_Auction_Executive_Report.xlsx (شامل الشعار والصور والمعادلات).'
          : 'Exported SAAED_Auction_Executive_Report.xlsx with formulas and branding.'
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
      await exportExecutivePdfReport({
        metadata,
        lang,
      });
      showToast(
        isAr
          ? 'تم تصدير التقرير التنفيذي بصيغة PDF بنجاح.'
          : 'Executive PDF report exported successfully.'
      );
    } catch (err) {
      console.error('PDF export failed:', err);
      showToast(
        isAr ? 'حدث خطأ أثناء تصدير ملف PDF.' : 'Failed to export PDF report.'
      );
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="min-h-screen bg-[#E4ECF5] text-[#0F172A] flex flex-col"
    >
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
                    ? 'جاري تصدير PDF...'
                    : 'Exporting PDF...'
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
        {(viewMode === 'combined' || viewMode === 'sheet1') && (
          <AuctionDataReport
            auctions={auctions}
            metrics={metrics}
            metadata={metadata}
            lang={lang}
            pixelPerfectMode={pixelPerfectMode}
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
            lang={lang}
            pixelPerfectMode={pixelPerfectMode}
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
            syncAuctionsWithCloud(auctions).then(({ records }) =>
              setAuctions(records)
            );
          }
        }}
        onResetDefaults={() => {
          const def = resetToDefaultData();
          setAuctions(def.auctions);
          setMetadata(def.metadata);
          setThresholds(def.thresholds);
          showToast(
            isAr
              ? 'تمت استعادة البيانات المرجعية الافتراضية (5 مزادات).'
              : 'Restored default reference data (5 auctions).'
          );
        }}
      />
    </div>
  );
}
