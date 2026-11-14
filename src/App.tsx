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
  Database,
  FileSearch,
} from 'lucide-react';
import { useNotification } from './context/NotificationContext';
import { validateAuctionDraft } from './utils/auctionValidation';
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
  reassignAuctionPeriod,
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
  const [firebaseConnected, setFirebaseConnected] = useState<boolean>(false);
  const [firebaseConfig, setFirebaseConfig] =
    useState<FirebaseConnectionConfig | null>(() => getStoredFirebaseConfig());

  const {
    setLang: setNotifLang,
    showToast,
    updateToast,
    dismissToast,
    showSuccess,
    showError,
    confirmAction,
  } = useNotification();

  const isAr = lang === 'ar';
  const currentMonthName = getMonthName(selectedPeriod.month, lang);

  const refreshArchiveSummary = useCallback(() => {
    setArchiveSummary(getArchivedPeriodsSummary());
  }, []);

  useEffect(() => {
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    setNotifLang(lang);
  }, [lang, isAr, setNotifLang]);

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
          if (!syncedWithFirestore) {
            showToast({
              variant: 'warning',
              title: isAr
                ? 'تم تحميل البيانات من الأرشيف المحلي'
                : 'Loaded from Local Archive',
              message: isAr
                ? 'تعذر الاتصال السحابي مع Firestore لهذه الفترة؛ البيانات المحلية محفوظة وآمنة.'
                : 'Could not reach Firestore for this period; local archive data is safely loaded.',
            });
          }
        });
      }
    },
    [firebaseConnected, refreshArchiveSummary, isAr, showToast]
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
    if (res.success) {
      showSuccess(
        isAr ? 'تم اعتماد الترحيل وتصفير الأشهر الأخرى بنجاح' : 'Migration & Zeroing Completed',
        isAr ? res.messageAr : res.messageEn
      );
    } else {
      showError({
        title: isAr ? 'تعذر إتمام ترحيل البيانات' : 'Migration Stopped',
        message: isAr ? res.messageAr : res.messageEn,
      });
    }
  };

  const handleRequestApproveMigrationFromBanner = async () => {
    await confirmAction({
      title: isAr
        ? 'تأكيد ترحيل أكتوبر إلى نوفمبر وتصفير بقية الأشهر'
        : 'Confirm October -> November Migration & Zeroing',
      message: isAr
        ? 'سيتم اعتماد نقل مزادات أكتوبر 2026 إلى نوفمبر 2026 وتصفير أكتوبر وبقية الأشهر مع الاحتفاظ بالنسخة الاحتياطية الكاملة.'
        : 'Approves copying October 2026 auctions into November 2026 and zeroing all other periods with a restorable backup.',
      destructive: true,
      confirmText: isAr ? 'تأكيد الترحيل والتصفير' : 'Confirm Migration & Zeroing',
      cancelText: isAr ? 'إلغاء' : 'Cancel',
      impactMeta: {
        operationName: isAr
          ? 'اعتماد الترحيل وتصفير الأشهر الأخرى'
          : 'Approve Migration & Zero Other Months',
        periodLabel: isAr
          ? `الوجهة المحفوظة: نوفمبر 2026 · الأشهر المصفّرة: ${migrationSummary.periodsToZero.length} فترة`
          : `Target: Nov 2026 · Zeroed periods: ${migrationSummary.periodsToZero.length}`,
        affectedCountLabel: isAr
          ? `${migrationSummary.sourceRecords.length} مزادات (${migrationSummary.totalListedToMigrate.toLocaleString('en-US')} مركبة)`
          : `${migrationSummary.sourceRecords.length} auctions (${migrationSummary.totalListedToMigrate.toLocaleString('en-US')} vehicles)`,
        impactDescription: isAr
          ? 'تبقى بيانات نوفمبر 2026 كاملة وتُصفّر جميع الأشهر الأخرى مع توفر النسخة الاحتياطية.'
          : 'November 2026 keeps full migrated records while other months reset cleanly.',
        reversibilityLabel: isAr
          ? 'يمكن استعادة النسخة الاحتياطية من نافذة سجل الترحيل في أي وقت.'
          : 'Reversible anytime via the Migration & Backup dialog.',
      },
      onConfirm: () => handleApproveMigrationAndZero('replace'),
    });
  };

  const handleRestorePreMigrationBackup = () => {
    const res = restorePreMigrationBackup();
    setMigrationSummary(getOctToNovMigrationSummary());
    refreshArchiveSummary();
    const loaded = loadPeriodData(selectedPeriod.year, selectedPeriod.month);
    setAuctions(loaded.auctions);
    setMetadata(loaded.metadata);
    setMigrationModalOpen(false);
    if (res.restored) {
      showSuccess(
        isAr ? 'تمت استعادة النسخة الاحتياطية بنجاح' : 'Backup Restored',
        isAr ? res.messageAr : res.messageEn
      );
    } else {
      showError({
        title: isAr ? 'تعذر استعادة النسخة الاحتياطية' : 'Restore Failed',
        message: isAr ? res.messageAr : res.messageEn,
      });
    }
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

  const metrics = useMemo(() => calculateMetrics(auctions), [auctions]);

  const handleUpdateMetadata = (newMeta: ReportMetadata) => {
    setMetadata(newMeta);
    savePeriodMetadata(selectedPeriod.year, selectedPeriod.month, newMeta);
    showSuccess(
      isAr ? 'تم تحديث تواريخ التقرير بنجاح' : 'Report Dates Updated',
      isAr
        ? `تم حفظ تواريخ تقرير شهر ${currentMonthName} ${selectedPeriod.year}.`
        : `Report dates for ${currentMonthName} ${selectedPeriod.year} updated.`
    );
  };

  const handleSaveAuctionFromModal = async (
    record: AuctionRecord,
    targetPeriodOverride?: ReportingPeriod
  ): Promise<boolean> => {
    const effectivePeriod = targetPeriodOverride ?? selectedPeriod;
    const isCrossPeriod =
      effectivePeriod.year !== selectedPeriod.year ||
      effectivePeriod.month !== selectedPeriod.month;
    const targetMonthName = getMonthName(effectivePeriod.month, lang);

    if (isCrossPeriod) {
      const reassignRes = reassignAuctionPeriod({
        record,
        fromPeriod: selectedPeriod,
        toPeriod: effectivePeriod,
      });

      if (!reassignRes.ok || !reassignRes.savedRecord) {
        showError({
          title: isAr
            ? 'يوجد رقم مزاد مكرر في الشهر المستهدف'
            : 'Duplicate Auction Number in Target Period',
          message: isAr
            ? `رقم المزاد (${record.auctionNumber}) مسجل بالفعل في شهر ${targetMonthName} ${effectivePeriod.year}.`
            : `Auction (${record.auctionNumber}) already exists in ${targetMonthName} ${effectivePeriod.year}.`,
          hint: isAr
            ? 'يرجى تغيير رقم المزاد أو تعديل التاريخ حتى لا يتعارض مع سجل قائم في ذلك الشهر.'
            : 'Change the auction number or adjust the date to avoid conflicting with an existing record.',
          confirmText: isAr ? 'العودة للتصحيح' : 'Return & Fix',
        });
        return false;
      }

      const savedRec = reassignRes.savedRecord;
      setAuctions(reassignRes.sourceAuctions || []);
      refreshArchiveSummary();
      setFormModalOpen(false);
      setEditingRecord(null);

      let cloudOk = true;
      if (firebaseConnected) {
        if (formModalMode === 'edit') {
          await deleteSingleAuctionFromCloud({
            ...savedRec,
            year: selectedPeriod.year,
            month: selectedPeriod.month,
          });
        }
        cloudOk = await persistSingleAuctionToCloud(savedRec);
      }

      if (firebaseConnected && !cloudOk) {
        showToast({
          variant: 'warning',
          title: isAr
            ? `تم حفظ المزاد (${savedRec.auctionNumber}) محلياً فقط`
            : `Saved (${savedRec.auctionNumber}) Locally Only`,
          message: isAr
            ? `تم الحفظ في أرشيف ${targetMonthName} ${effectivePeriod.year} وتعذرت المزامنة مع Firestore حالياً.`
            : `Saved in ${targetMonthName} ${effectivePeriod.year}; Firestore sync failed.`,
        });
        return true;
      }

      showSuccess(
        formModalMode === 'add'
          ? isAr
            ? `تمت إضافة المزاد (${savedRec.auctionNumber}) بنجاح`
            : `Auction (${savedRec.auctionNumber}) Added`
          : isAr
          ? `تم نقل وحفظ المزاد (${savedRec.auctionNumber}) بنجاح`
          : `Auction (${savedRec.auctionNumber}) Moved & Saved`,
        isAr
          ? `أرشيف شهر ${targetMonthName} ${effectivePeriod.year}`
          : `${targetMonthName} ${effectivePeriod.year} Archive`
      );
      return true;
    }

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
    const cloudSynced = firebaseConnected
      ? await persistSingleAuctionToCloud(normalized)
      : true;

    if (firebaseConnected && !cloudSynced) {
      showToast({
        variant: 'warning',
        title: isAr
          ? `تم حفظ المزاد (${normalized.auctionNumber}) محلياً فقط`
          : `Saved (${normalized.auctionNumber}) Locally Only`,
        message: isAr
          ? 'تعذر المزامنة مع Firestore حالياً — تم حفظ السجل بأمان في المتصفح.'
          : 'Could not sync to Firestore right now — record safely stored locally.',
      });
      return true;
    }

    showSuccess(
      formModalMode === 'add'
        ? isAr
          ? `تمت إضافة المزاد (${normalized.auctionNumber}) بنجاح`
          : `Auction (${normalized.auctionNumber}) Added`
        : isAr
        ? `تم حفظ تعديلات المزاد (${normalized.auctionNumber}) بنجاح`
        : `Auction (${normalized.auctionNumber}) Updated`,
      isAr
        ? `شهر ${currentMonthName} ${selectedPeriod.year}`
        : `${currentMonthName} ${selectedPeriod.year}`
    );
    return true;
  };

  const handleInlineSaveAuction = async (
    draft: AuctionRecord,
    targetPeriodOverride?: ReportingPeriod
  ): Promise<{ ok: boolean; error?: string }> => {
    const validation = validateAuctionDraft(draft, auctions, {
      lang,
      periodLabel: `${currentMonthName} ${selectedPeriod.year}`,
      requireDuration: true,
      requireDate: false,
    });
    if (!validation.valid) {
      return {
        ok: false,
        error:
          validation.summaryMessages[0] ||
          (isAr ? 'بيانات غير صالحة' : 'Invalid data'),
      };
    }

    const cleanCode = draft.auctionNumber.trim().toUpperCase();
    const effectivePeriod = targetPeriodOverride ?? selectedPeriod;
    const isCrossPeriod =
      effectivePeriod.year !== selectedPeriod.year ||
      effectivePeriod.month !== selectedPeriod.month;

    if (isCrossPeriod) {
      const targetMonthName = getMonthName(effectivePeriod.month, lang);
      const reassignRes = reassignAuctionPeriod({
        record: {
          ...draft,
          auctionNumber: cleanCode,
          updatedAt: new Date().toISOString(),
        },
        fromPeriod: selectedPeriod,
        toPeriod: effectivePeriod,
      });

      if (!reassignRes.ok || !reassignRes.savedRecord) {
        return {
          ok: false,
          error: isAr
            ? `رقم المزاد (${cleanCode}) موجود مسبقاً في شهر ${targetMonthName} ${effectivePeriod.year}.`
            : `Auction number (${cleanCode}) already exists in ${targetMonthName} ${effectivePeriod.year}.`,
        };
      }

      const savedRec = reassignRes.savedRecord;
      setAuctions(reassignRes.sourceAuctions || []);
      refreshArchiveSummary();

      if (firebaseConnected) {
        await deleteSingleAuctionFromCloud({
          ...savedRec,
          year: selectedPeriod.year,
          month: selectedPeriod.month,
        });
        const ok = await persistSingleAuctionToCloud(savedRec);
        if (!ok) {
          showToast({
            variant: 'warning',
            title: isAr ? 'تنبيه المزامنة السحابية' : 'Cloud Sync Notice',
            message: isAr
              ? `تم نقل (${savedRec.auctionNumber}) محلياً وتعذرت المزامنة مع Firestore حالياً.`
              : `Moved (${savedRec.auctionNumber}) locally; Firestore sync failed.`,
          });
        }
      }

      showSuccess(
        isAr
          ? `تم نقل وحفظ المزاد (${savedRec.auctionNumber}) بنجاح`
          : `Auction (${savedRec.auctionNumber}) Moved & Saved`,
        isAr
          ? `أرشيف شهر ${targetMonthName} ${effectivePeriod.year}`
          : `${targetMonthName} ${effectivePeriod.year} Archive`
      );
      return { ok: true };
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
    persistSingleAuctionToCloud(normalized).then((ok) => {
      if (firebaseConnected && !ok) {
        showToast({
          variant: 'warning',
          title: isAr ? 'تنبيه المزامنة السحابية' : 'Cloud Sync Notice',
          message: isAr
            ? `تم حفظ (${normalized.auctionNumber}) محلياً وتعذر إرساله إلى Firestore حالياً.`
            : `Saved (${normalized.auctionNumber}) locally; Firestore sync failed.`,
        });
      }
    });
    showSuccess(
      isAr
        ? `تم تحديث بيانات المزاد (${normalized.auctionNumber}) بنجاح`
        : `Auction (${normalized.auctionNumber}) Updated`,
      isAr
        ? `شهر ${currentMonthName} ${selectedPeriod.year}`
        : `${currentMonthName} ${selectedPeriod.year}`
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
    const cloudOk = firebaseConnected
      ? await deleteSingleAuctionFromCloud(record)
      : true;
    if (firebaseConnected && !cloudOk) {
      showToast({
        variant: 'warning',
        title: isAr
          ? `تم حذف المزاد (${record.auctionNumber}) محلياً`
          : `Deleted (${record.auctionNumber}) Locally`,
        message: isAr
          ? 'تعذر حذف السجل من Firestore حالياً، سيتم الحفاظ على النسخة المحلية المحدثة.'
          : 'Could not remove record from Firestore right now.',
      });
      return;
    }
    showSuccess(
      isAr
        ? `تم حذف المزاد (${record.auctionNumber}) بنجاح`
        : `Auction (${record.auctionNumber}) Deleted`,
      isAr
        ? `تم تحديث مؤشرات شهر ${currentMonthName} ${selectedPeriod.year} تلقائياً.`
        : `Metrics updated for ${currentMonthName} ${selectedPeriod.year}.`
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
      const syncRes = await syncPeriodWithCloud(
        selectedPeriod.year,
        selectedPeriod.month,
        saved
      );
      if (!syncRes.syncedWithFirestore) {
        showToast({
          variant: 'warning',
          title: isAr
            ? `تم الحفظ محلياً لشهر ${currentMonthName} ${selectedPeriod.year}`
            : `Saved Locally for ${currentMonthName} ${selectedPeriod.year}`,
          message: isAr
            ? 'تعذرت المزامنة مع Firebase Firestore، والبيانات محفوظة بأمان في المتصفح.'
            : 'Firestore sync failed; records are safely archived locally.',
        });
        return;
      }
      showSuccess(
        isAr ? 'تم حفظ البيانات ومزامنتها سحابياً' : 'Saved & Synced with Firestore',
        isAr
          ? `شهر ${currentMonthName} ${selectedPeriod.year} (${saved.length} سجل)`
          : `${currentMonthName} ${selectedPeriod.year} (${saved.length} records)`
      );
      return;
    }
    showSuccess(
      isAr ? 'تم حفظ وأرشفة بيانات الشهر بنجاح' : 'Month Data Saved & Archived',
      isAr
        ? `شهر ${currentMonthName} ${selectedPeriod.year} (${saved.length} سجل)`
        : `${currentMonthName} ${selectedPeriod.year} (${saved.length} records)`
    );
  };

  const handleRefreshReport = () => {
    const reloaded = loadPeriodData(selectedPeriod.year, selectedPeriod.month);
    setAuctions([...reloaded.auctions]);
    setMetadata({ ...reloaded.metadata });
    refreshArchiveSummary();
    showToast({
      variant: 'info',
      title: isAr ? 'تم تحديث التقرير وإعادة حساب المؤشرات' : 'Report Refreshed',
      message: isAr
        ? `شهر ${currentMonthName} ${selectedPeriod.year}`
        : `${currentMonthName} ${selectedPeriod.year}`,
    });
  };

  const handleExportExcel = async () => {
    const toastId = showToast({
      variant: 'loading',
      title: isAr ? 'جارٍ تجهيز ملف Excel...' : 'Preparing Excel Workbook...',
      message: isAr
        ? `تقرير شهر ${currentMonthName} ${selectedPeriod.year}`
        : `${currentMonthName} ${selectedPeriod.year} Report`,
    });
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
      updateToast(toastId, {
        variant: 'success',
        title: isAr ? 'تم تصدير ملف Excel بنجاح' : 'Excel File Exported Successfully',
        message: exportedFileName,
      });
    } catch (err) {
      console.error('Excel export failed:', err);
      dismissToast(toastId);
      showError({
        title: isAr ? 'تعذر تصدير ملف Excel' : 'Unable to Export Excel File',
        message: isAr
          ? 'حدث خطأ أثناء إنشاء أو تنزيل مصنف Excel للتقرير التنفيذي.'
          : 'An error occurred while building or downloading the Excel workbook.',
        details: [
          err instanceof Error && err.message
            ? err.message
            : isAr
            ? 'تعذر قراءة أو تجهيز موارد التقرير في المتصفح.'
            : 'Unable to prepare report workbook assets.',
        ],
        confirmText: isAr ? 'حسناً' : 'OK',
      });
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleExportPdf = async () => {
    const toastId = showToast({
      variant: 'loading',
      title: isAr ? 'جارٍ تجهيز التقرير...' : 'Preparing Report...',
      message: isAr
        ? `شهر ${currentMonthName} ${selectedPeriod.year}`
        : `${currentMonthName} ${selectedPeriod.year}`,
    });
    try {
      setIsExportingPdf(true);
      const exportedFileName = await exportExecutivePdfReport({
        auctions,
        metrics,
        thresholds,
        metadata,
        selectedPeriod,
        lang,
        paperSize,
        onProgress: (stage) => {
          if (stage === 'building' || stage === 'downloading') {
            updateToast(toastId, {
              variant: 'loading',
              title: isAr ? 'جارٍ إنشاء ملف PDF...' : 'Generating PDF File...',
              message: isAr
                ? 'تجهيز الرسوم البيانية والخطوط العربية...'
                : 'Rendering charts and Arabic typography...',
            });
          }
        },
      });
      updateToast(toastId, {
        variant: 'success',
        title: isAr ? 'تم تجهيز ملف PDF بنجاح' : 'PDF File Ready & Exported',
        message: `${exportedFileName} — ${currentMonthName} ${selectedPeriod.year}`,
      });
    } catch (error) {
      console.error('PDF_EXPORT_FAILED:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        selectedPeriod,
        paperSize,
      });
      dismissToast(toastId);
      showError({
        title: isAr ? 'تعذر تصدير ملف PDF' : 'Unable to Export PDF File',
        message: isAr
          ? 'تعذر إنشاء ملف PDF الرسمي للتقرير في الوقت الحالي.'
          : 'Unable to generate the official PDF report at this time.',
        details: [
          error instanceof Error && error.message
            ? error.message
            : isAr
            ? 'خطأ غير متوقع أثناء تجميع الصفحات أو تحميل الخطوط والصور.'
            : 'Unexpected error during page assembly or asset loading.',
        ],
        hint: isAr
          ? 'يمكنك المحاولة مرة أخرى أو استخدام زر "معاينة التقرير" ثم "طباعة التقرير" لحفظه كـ PDF من المتصفح.'
          : 'Please try again or use Preview -> Print Report to save via the browser print dialog.',
        confirmText: isAr ? 'حسناً' : 'OK',
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handlePrint = async () => {
    try {
      await triggerOfficialReportPrint(paperSize);
      showToast({
        variant: 'info',
        title: isAr ? 'تم فتح معاينة الطباعة' : 'Print Preview Opened',
        message: isAr
          ? `تأكد من اختيار حجم الورق (${paperSize.toUpperCase()} Landscape) في نافذة الطباعة.`
          : `Ensure (${paperSize.toUpperCase()} Landscape) is selected in the browser print dialog.`,
      });
    } catch (error) {
      console.error('Print preview failed:', error);
      showError({
        title: isAr ? 'تعذر فتح معاينة الطباعة' : 'Unable to Open Print Preview',
        message: isAr
          ? 'لم يتمكن المتصفح من فتح نافذة الطباعة الرسمية للتقرير.'
          : 'The browser could not open the official print dialog.',
        details: [
          error instanceof Error && error.message
            ? error.message
            : isAr
            ? 'تحقق من إعدادات المتصفح أو عدم حظر النوافذ الخاصة بالطباعة.'
            : 'Check browser print permissions or iframe blocking.',
        ],
        confirmText: isAr ? 'حسناً' : 'OK',
      });
    }
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
                  onClick={handleRequestApproveMigrationFromBanner}
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

      {/* EXECUTIVE CORPORATE FOOTER */}
      <footer className="no-print mt-auto bg-[#123B70] border-t-2 border-[#D6A348] text-white py-2 px-4 shadow-sm">
        <div className="max-w-[1540px] mx-auto flex items-center justify-center gap-2.5 text-center text-xs sm:text-[13px] font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-[#D6A348] shrink-0" />
          <span className="text-white font-extrabold tracking-wide">
            {isAr ? 'إعداد وتصميم: خالد الهاشمي' : 'Prepared & Designed by: Khalid Al Hashemi'}
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#D6A348] shrink-0" />
        </div>
      </footer>

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
          showSuccess(
            isAr ? 'تم تحديث حدود تقييم الأداء بنجاح' : 'Rating Thresholds Updated',
            isAr
              ? 'تم تطبيق معايير التقييم الجديدة على التقرير ولوحة التحليل.'
              : 'Updated thresholds applied to reports and dashboard.'
          );
        }}
        onSaveFirebase={(cfg) => {
          setFirebaseConfig(cfg);
          const res = saveFirebaseConfig(cfg);
          setFirebaseConnected(res.connected);
          if (cfg && !res.connected) {
            showError({
              title: isAr ? 'تعذر الاتصال بـ Firebase Firestore' : 'Firebase Connection Failed',
              message: isAr
                ? 'بيانات الربط السحابي المدخلة لم تنجح في إنشاء اتصال بـ Firestore، وسيستمر حفظ البيانات محلياً في المتصفح.'
                : 'The provided Firebase settings failed to connect to Firestore; data remains stored locally.',
            });
            return;
          }
          if (res.connected) {
            syncPeriodWithCloud(
              selectedPeriod.year,
              selectedPeriod.month,
              auctions
            ).then(({ records, syncedWithFirestore }) => {
              setAuctions(records);
              refreshArchiveSummary();
              if (syncedWithFirestore) {
                showSuccess(
                  isAr ? 'تم تفعيل الربط والمزامنة مع Firestore' : 'Firestore Sync Active',
                  isAr
                    ? `المشروع المتصل: ${res.projectId || ''}`
                    : `Connected project: ${res.projectId || ''}`
                );
              }
            });
          }
        }}
        onResetDefaults={() => {
          const def = resetOctoberReferenceData();
          executePeriodSwitch(2026, 11);
          setThresholds(def.thresholds);
          setMigrationSummary(getOctToNovMigrationSummary());
          showSuccess(
            isAr
              ? 'تمت استعادة بيانات نوفمبر 2026 المنقولة'
              : 'November 2026 Reference Data Restored',
            isAr
              ? 'تم الحفاظ على بيانات كافة الأشهر والسنوات الأخرى دون تغيير.'
              : 'All other months and years were preserved unchanged.'
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
