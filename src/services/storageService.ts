import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  Firestore,
} from 'firebase/firestore';
import {
  AuctionRecord,
  ComputedAuctionMetrics,
  FirebaseConnectionConfig,
  PerformanceThresholds,
  ReportMetadata,
} from '../types/auction';

const STORAGE_KEYS = {
  AUCTIONS: 'saaed_auction_records_v1',
  METADATA: 'saaed_report_metadata_v1',
  THRESHOLDS: 'saaed_performance_thresholds_v1',
  FIREBASE_CONFIG: 'saaed_firebase_config_v1',
};

export const INITIAL_METADATA: ReportMetadata = {
  reportDate: '2026-11-12',
  periodStart: '2026-10-01',
  periodEnd: '2026-10-31',
};

export const INITIAL_THRESHOLDS: PerformanceThresholds = {
  excellentMin: 85,
  goodMin: 75,
  needsImprovementMin: 60,
  useDetailedFourTierLabels: false,
};

function computeRowFields(
  listed: number,
  sold: number
): { unsoldVehicles: number; saleRate: number; unsoldRate: number } {
  const safeListed = Math.max(0, Number(listed) || 0);
  const safeSold = Math.min(safeListed, Math.max(0, Number(sold) || 0));
  const unsoldVehicles = safeListed - safeSold;
  const saleRate =
    safeListed > 0 ? Number(((safeSold / safeListed) * 100).toFixed(1)) : 0;
  const unsoldRate =
    safeListed > 0 ? Number(((unsoldVehicles / safeListed) * 100).toFixed(1)) : 0;
  return { unsoldVehicles, saleRate, unsoldRate };
}

export const INITIAL_AUCTIONS: AuctionRecord[] = [
  {
    id: 'auc-1',
    auctionNumber: 'AUC-001',
    durationAr: 'أسبوع (7 أيام)',
    durationEn: '1 Week (7 Days)',
    listedVehicles: 300,
    soldVehicles: 265,
    ...computeRowFields(300, 265),
    notesAr: 'إقبال جيد على فئة المركبات الخفيفة.',
    notesEn: 'Strong demand on light vehicle category.',
    challengesAr: 'تأخر في تجهيز بعض المركبات.',
    challengesEn: 'Delay in preparing some vehicles.',
    recommendationsAr: 'تحسين جاهزية المركبات قبل العرض.',
    recommendationsEn: 'Improve vehicle readiness prior to listing.',
    createdAt: '2026-10-05T09:00:00.000Z',
    updatedAt: '2026-11-12T08:00:00.000Z',
  },
  {
    id: 'auc-2',
    auctionNumber: 'AUC-002',
    durationAr: '10 أيام',
    durationEn: '10 Days',
    listedVehicles: 220,
    soldVehicles: 170,
    ...computeRowFields(220, 170),
    notesAr: 'مبيعات أقل من المتوقع.',
    notesEn: 'Sales lower than anticipated.',
    challengesAr: 'ارتفاع تكلفة الإصلاح لبعض المركبات.',
    challengesEn: 'High repair costs for certain vehicles.',
    recommendationsAr: 'إعادة تقييم أسعار البداية.',
    recommendationsEn: 'Re-evaluate starting bid prices.',
    createdAt: '2026-10-12T09:00:00.000Z',
    updatedAt: '2026-11-12T08:00:00.000Z',
  },
  {
    id: 'auc-3',
    auctionNumber: 'AUC-003',
    durationAr: 'أسبوع (7 أيام)',
    durationEn: '1 Week (7 Days)',
    listedVehicles: 280,
    soldVehicles: 245,
    ...computeRowFields(280, 245),
    notesAr: 'نتائج إيجابية ومعدلات بيع مرتفعة.',
    notesEn: 'Positive results and high sell-through rates.',
    challengesAr: 'ضغط على ساحة المعاينة.',
    challengesEn: 'Congestion in the inspection yard.',
    recommendationsAr: 'توسيع مساحة المعاينة وتنظيم الحركة.',
    recommendationsEn: 'Expand inspection yard and organize traffic flow.',
    createdAt: '2026-10-18T09:00:00.000Z',
    updatedAt: '2026-11-12T08:00:00.000Z',
  },
  {
    id: 'auc-4',
    auctionNumber: 'AUC-004',
    durationAr: '14 يومًا',
    durationEn: '14 Days',
    listedVehicles: 250,
    soldVehicles: 210,
    ...computeRowFields(250, 210),
    notesAr: 'بيع جيد لفئة المركبات التجارية.',
    notesEn: 'Solid sales for commercial vehicles category.',
    challengesAr: 'تأخر بعض المستندات.',
    challengesEn: 'Delay in some vehicle documentation.',
    recommendationsAr: 'استكمال المستندات قبل بدء المزاد.',
    recommendationsEn: 'Complete all documentation before auction start.',
    createdAt: '2026-10-24T09:00:00.000Z',
    updatedAt: '2026-11-12T08:00:00.000Z',
  },
  {
    id: 'auc-5',
    auctionNumber: 'AUC-005',
    durationAr: 'أسبوع (7 أيام)',
    durationEn: '1 Week (7 Days)',
    listedVehicles: 200,
    soldVehicles: 145,
    ...computeRowFields(200, 145),
    notesAr: 'إقبال متوسط على بعض الفئات.',
    notesEn: 'Moderate demand on select vehicle segments.',
    challengesAr: 'منافسة مزادات أخرى في نفس الفترة.',
    challengesEn: 'Competition from concurrent external auctions.',
    recommendationsAr: 'تعزيز الترويج والتسويق للمزاد.',
    recommendationsEn: 'Strengthen promotional and marketing campaigns.',
    createdAt: '2026-10-30T09:00:00.000Z',
    updatedAt: '2026-11-12T08:00:00.000Z',
  },
];

let firestoreDb: Firestore | null = null;

export function getStoredFirebaseConfig(): FirebaseConnectionConfig | null {
  try {
    const envApiKey = import.meta.env.VITE_FIREBASE_API_KEY;
    const envProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
    if (envApiKey && envProjectId) {
      return {
        apiKey: envApiKey,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${envProjectId}.firebaseapp.com`,
        projectId: envProjectId,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
        appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
      };
    }
    const raw = localStorage.getItem(STORAGE_KEYS.FIREBASE_CONFIG);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FirebaseConnectionConfig;
    if (parsed && parsed.apiKey && parsed.projectId) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function initFirebaseIfConfigured(): { connected: boolean; projectId?: string } {
  try {
    const config = getStoredFirebaseConfig();
    if (!config) {
      firestoreDb = null;
      return { connected: false };
    }
    let app: FirebaseApp;
    if (!getApps().length) {
      app = initializeApp(config);
    } else {
      app = getApps()[0];
    }
    firestoreDb = getFirestore(app);
    return { connected: true, projectId: config.projectId };
  } catch (err) {
    console.warn('Firebase initialization skipped or failed, using localStorage:', err);
    firestoreDb = null;
    return { connected: false };
  }
}

export function saveFirebaseConfig(config: FirebaseConnectionConfig | null): {
  connected: boolean;
  projectId?: string;
} {
  if (!config || !config.apiKey || !config.projectId) {
    localStorage.removeItem(STORAGE_KEYS.FIREBASE_CONFIG);
    firestoreDb = null;
    return { connected: false };
  }
  localStorage.setItem(STORAGE_KEYS.FIREBASE_CONFIG, JSON.stringify(config));
  return initFirebaseIfConfigured();
}

export function normalizeAuctionRecord(
  input: Omit<AuctionRecord, 'unsoldVehicles' | 'saleRate' | 'unsoldRate'>
): AuctionRecord {
  const { unsoldVehicles, saleRate, unsoldRate } = computeRowFields(
    input.listedVehicles,
    input.soldVehicles
  );
  return {
    ...input,
    listedVehicles: Math.max(0, Number(input.listedVehicles) || 0),
    soldVehicles: Math.max(0, Number(input.soldVehicles) || 0),
    unsoldVehicles,
    saleRate,
    unsoldRate,
  };
}

export function loadLocalAuctions(): AuctionRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.AUCTIONS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.AUCTIONS, JSON.stringify(INITIAL_AUCTIONS));
      return INITIAL_AUCTIONS;
    }
    const parsed = JSON.parse(raw) as AuctionRecord[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return INITIAL_AUCTIONS;
    }
    return parsed.map((item) => normalizeAuctionRecord(item));
  } catch {
    return INITIAL_AUCTIONS;
  }
}

export function saveLocalAuctions(records: AuctionRecord[]): AuctionRecord[] {
  const normalized = records.map((r) => normalizeAuctionRecord(r));
  localStorage.setItem(STORAGE_KEYS.AUCTIONS, JSON.stringify(normalized));
  return normalized;
}

export async function syncAuctionsWithCloud(localRecords: AuctionRecord[]): Promise<{
  records: AuctionRecord[];
  syncedWithFirestore: boolean;
}> {
  if (!firestoreDb) {
    initFirebaseIfConfigured();
  }
  if (!firestoreDb) {
    return { records: localRecords, syncedWithFirestore: false };
  }
  try {
    const colRef = collection(firestoreDb, 'saaed_auctions');
    const snap = await getDocs(colRef);
    if (snap.empty) {
      // Seed cloud with current local records
      for (const rec of localRecords) {
        await setDoc(doc(firestoreDb, 'saaed_auctions', rec.id), rec);
      }
      return { records: localRecords, syncedWithFirestore: true };
    } else {
      const cloudRecords: AuctionRecord[] = [];
      snap.forEach((docSnap) => {
        cloudRecords.push(normalizeAuctionRecord(docSnap.data() as AuctionRecord));
      });
      cloudRecords.sort((a, b) => a.auctionNumber.localeCompare(b.auctionNumber));
      saveLocalAuctions(cloudRecords);
      return { records: cloudRecords, syncedWithFirestore: true };
    }
  } catch (err) {
    console.warn('Firestore sync fallback to local:', err);
    return { records: localRecords, syncedWithFirestore: false };
  }
}

export async function persistSingleAuctionToCloud(record: AuctionRecord): Promise<boolean> {
  if (!firestoreDb) return false;
  try {
    await setDoc(doc(firestoreDb, 'saaed_auctions', record.id), record);
    return true;
  } catch {
    return false;
  }
}

export async function deleteSingleAuctionFromCloud(id: string): Promise<boolean> {
  if (!firestoreDb) return false;
  try {
    await deleteDoc(doc(firestoreDb, 'saaed_auctions', id));
    return true;
  } catch {
    return false;
  }
}

export function loadMetadata(): ReportMetadata {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.METADATA);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.METADATA, JSON.stringify(INITIAL_METADATA));
      return INITIAL_METADATA;
    }
    return { ...INITIAL_METADATA, ...JSON.parse(raw) };
  } catch {
    return INITIAL_METADATA;
  }
}

export function saveMetadata(meta: ReportMetadata): void {
  localStorage.setItem(STORAGE_KEYS.METADATA, JSON.stringify(meta));
}

export function loadThresholds(): PerformanceThresholds {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.THRESHOLDS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.THRESHOLDS, JSON.stringify(INITIAL_THRESHOLDS));
      return INITIAL_THRESHOLDS;
    }
    return { ...INITIAL_THRESHOLDS, ...JSON.parse(raw) };
  } catch {
    return INITIAL_THRESHOLDS;
  }
}

export function saveThresholds(thresholds: PerformanceThresholds): void {
  localStorage.setItem(STORAGE_KEYS.THRESHOLDS, JSON.stringify(thresholds));
}

export function resetToDefaultData(): {
  auctions: AuctionRecord[];
  metadata: ReportMetadata;
  thresholds: PerformanceThresholds;
} {
  localStorage.setItem(STORAGE_KEYS.AUCTIONS, JSON.stringify(INITIAL_AUCTIONS));
  localStorage.setItem(STORAGE_KEYS.METADATA, JSON.stringify(INITIAL_METADATA));
  localStorage.setItem(STORAGE_KEYS.THRESHOLDS, JSON.stringify(INITIAL_THRESHOLDS));
  return {
    auctions: INITIAL_AUCTIONS,
    metadata: INITIAL_METADATA,
    thresholds: INITIAL_THRESHOLDS,
  };
}

export function calculateMetrics(auctions: AuctionRecord[]): ComputedAuctionMetrics {
  const totalAuctions = auctions.length;
  const totalListed = auctions.reduce((sum, a) => sum + a.listedVehicles, 0);
  const totalSold = auctions.reduce((sum, a) => sum + a.soldVehicles, 0);
  const totalUnsold = auctions.reduce((sum, a) => sum + a.unsoldVehicles, 0);

  const overallSaleRate =
    totalListed > 0 ? Number(((totalSold / totalListed) * 100).toFixed(1)) : 0;
  const overallUnsoldRate =
    totalListed > 0 ? Number(((totalUnsold / totalListed) * 100).toFixed(1)) : 0;
  const avgSoldPerAuction =
    totalAuctions > 0 ? Math.round(totalSold / totalAuctions) : 0;

  let highestSaleAuction: AuctionRecord | null = null;
  let lowestSaleAuction: AuctionRecord | null = null;

  for (const a of auctions) {
    if (!highestSaleAuction || a.saleRate > highestSaleAuction.saleRate) {
      highestSaleAuction = a;
    }
    if (!lowestSaleAuction || a.saleRate < lowestSaleAuction.saleRate) {
      lowestSaleAuction = a;
    }
  }

  return {
    totalAuctions,
    totalListed,
    totalSold,
    totalUnsold,
    overallSaleRate,
    overallUnsoldRate,
    avgSoldPerAuction,
    highestSaleAuction,
    lowestSaleAuction,
  };
}

export function evaluateAuctionPerformance(
  saleRate: number,
  thresholds: PerformanceThresholds,
  lang: 'ar' | 'en'
): {
  label: string;
  tier: 'excellent' | 'good' | 'warning' | 'low';
  bgClass: string;
  textClass: string;
  borderClass: string;
} {
  if (thresholds.useDetailedFourTierLabels && saleRate >= thresholds.excellentMin) {
    return {
      label: lang === 'ar' ? 'ممتاز' : 'Excellent',
      tier: 'excellent',
      bgClass: 'bg-[#C6EFCE]',
      textClass: 'text-[#006100]',
      borderClass: 'border-[#8ED99C]',
    };
  }
  if (saleRate >= thresholds.goodMin) {
    return {
      label: lang === 'ar' ? 'أداء جيد' : 'Good Performance',
      tier: 'good',
      bgClass: 'bg-[#D7F0D8]',
      textClass: 'text-[#13652C]',
      borderClass: 'border-[#9CD6A0]',
    };
  }
  if (saleRate >= thresholds.needsImprovementMin) {
    return {
      label: lang === 'ar' ? 'يحتاج إلى تحسين' : 'Needs Improvement',
      tier: 'warning',
      bgClass: 'bg-[#F5DF99]',
      textClass: 'text-[#784A00]',
      borderClass: 'border-[#E0BE58]',
    };
  }
  return {
    label: lang === 'ar' ? 'منخفض' : 'Low',
    tier: 'low',
    bgClass: 'bg-[#FCDAD7]',
    textClass: 'text-[#9C1C1C]',
    borderClass: 'border-[#F2A39D]',
  };
}
