export type Language = 'ar' | 'en';
export type ViewMode = 'combined' | 'sheet1' | 'sheet2';

export interface AuctionRecord {
  id: string;
  auctionNumber: string;
  durationAr: string;
  durationEn: string;
  listedVehicles: number;
  soldVehicles: number;
  unsoldVehicles: number;
  saleRate: number;
  unsoldRate: number;
  notesAr: string;
  notesEn: string;
  challengesAr: string;
  challengesEn: string;
  recommendationsAr: string;
  recommendationsEn: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReportMetadata {
  reportDate: string;
  periodStart: string;
  periodEnd: string;
}

export interface PerformanceThresholds {
  excellentMin: number; // e.g., 88 or 85
  goodMin: number; // e.g., 75
  needsImprovementMin: number; // e.g., 60
  useDetailedFourTierLabels: boolean; // If false, >= goodMin shows "أداء جيد" like the exact reference screenshot; if true, >= excellentMin shows "ممتاز"
}

export interface FirebaseConnectionConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

export interface ComputedAuctionMetrics {
  totalAuctions: number;
  totalListed: number;
  totalSold: number;
  totalUnsold: number;
  overallSaleRate: number;
  overallUnsoldRate: number;
  avgSoldPerAuction: number;
  highestSaleAuction: AuctionRecord | null;
  lowestSaleAuction: AuctionRecord | null;
}
