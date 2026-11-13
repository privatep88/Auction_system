import {
  AuctionRecord,
  Language,
  PerformanceThresholds,
  ReportMetadata,
} from '../types/auction';

export type AuctionFieldKey =
  | 'auctionNumber'
  | 'durationAr'
  | 'durationEn'
  | 'listedVehicles'
  | 'soldVehicles'
  | 'notesAr'
  | 'challengesAr'
  | 'recommendationsAr';

export interface AuctionValidationItem {
  field: AuctionFieldKey;
  label: string;
  message: string;
}

export interface AuctionValidationResult {
  valid: boolean;
  fieldErrors: Partial<Record<AuctionFieldKey, string>>;
  errors: AuctionValidationItem[];
  summaryMessages: string[];
}

export interface AuctionDraftInput {
  id?: string;
  auctionNumber: string;
  durationAr?: string;
  durationEn?: string;
  listedVehicles: number | string;
  soldVehicles: number | string;
  notesAr?: string;
  challengesAr?: string;
  recommendationsAr?: string;
}

/**
 * Validates auction input values consistently for both modal forms and inline table editing.
 * Enforces positive integers for listed vehicles, non-negative integers <= listed for sold vehicles,
 * required auction number, non-duplicate auction code within the target month/year, and clean duration.
 */
export function validateAuctionDraft(
  draft: AuctionDraftInput,
  existingAuctions: AuctionRecord[],
  options: {
    lang: Language;
    periodLabel?: string;
    requireDuration?: boolean;
  }
): AuctionValidationResult {
  const isAr = options.lang === 'ar';
  const fieldErrors: Partial<Record<AuctionFieldKey, string>> = {};
  const errors: AuctionValidationItem[] = [];

  const pushError = (field: AuctionFieldKey, label: string, message: string) => {
    if (!fieldErrors[field]) {
      fieldErrors[field] = message;
    }
    errors.push({ field, label, message });
  };

  // 1. Auction Number
  const cleanCode = String(draft.auctionNumber || '').trim().toUpperCase();
  if (!cleanCode) {
    pushError(
      'auctionNumber',
      isAr ? 'رقم المزاد' : 'Auction Number',
      isAr
        ? 'رقم المزاد حقل إلزامي ولا يمكن تركه فارغاً.'
        : 'Auction number is required and cannot be empty.'
    );
  } else {
    const isDuplicate = existingAuctions.some(
      (a) =>
        a.auctionNumber.trim().toUpperCase() === cleanCode &&
        a.id !== draft.id
    );
    if (isDuplicate) {
      const periodSuffix = options.periodLabel ? ` (${options.periodLabel})` : '';
      pushError(
        'auctionNumber',
        isAr ? 'رقم المزاد' : 'Auction Number',
        isAr
          ? `رقم المزاد (${cleanCode}) مكرر بالفعل في هذا الشهر${periodSuffix}. يرجى إدخال رقم مزاد فريد.`
          : `Auction number (${cleanCode}) already exists in this period${periodSuffix}.`
      );
    }
  }

  // 2. Duration (Arabic primary if required)
  if (options.requireDuration !== false) {
    const cleanDurationAr = String(draft.durationAr || '').trim();
    const cleanDurationEn = String(draft.durationEn || '').trim();
    if (!cleanDurationAr && !cleanDurationEn) {
      pushError(
        'durationAr',
        isAr ? 'مدة المزاد' : 'Duration',
        isAr
          ? 'يرجى تحديد مدة المزاد (مثال: أسبوع (7 أيام)).'
          : 'Please specify the auction duration.'
      );
    }
  }

  // 3. Listed Vehicles (strict positive integer > 0)
  const rawListed = String(draft.listedVehicles ?? '').trim();
  const listedNum = Number(draft.listedVehicles);
  if (rawListed === '' || Number.isNaN(listedNum)) {
    pushError(
      'listedVehicles',
      isAr ? 'المركبات المدرجة' : 'Listed Vehicles',
      isAr
        ? 'يرجى إدخال عدد صحيح صالح للمركبات المدرجة.'
        : 'Please enter a valid whole number for listed vehicles.'
    );
  } else if (!Number.isInteger(listedNum)) {
    pushError(
      'listedVehicles',
      isAr ? 'المركبات المدرجة' : 'Listed Vehicles',
      isAr
        ? 'عدد المركبات المدرجة يجب أن يكون رقماً صحيحاً بدون كسور عشرية.'
        : 'Listed vehicles must be a whole integer without decimals.'
    );
  } else if (listedNum <= 0) {
    pushError(
      'listedVehicles',
      isAr ? 'المركبات المدرجة' : 'Listed Vehicles',
      isAr
        ? 'عدد المركبات المدرجة يجب أن يكون أكبر من صفر.'
        : 'Listed vehicles must be greater than zero.'
    );
  }

  // 4. Sold Vehicles (non-negative integer <= listedVehicles)
  const rawSold = String(draft.soldVehicles ?? '').trim();
  const soldNum = Number(draft.soldVehicles);
  if (rawSold === '' || Number.isNaN(soldNum)) {
    pushError(
      'soldVehicles',
      isAr ? 'المركبات المبيعة' : 'Sold Vehicles',
      isAr
        ? 'يرجى إدخال عدد صحيح صالح للمركبات المبيعة.'
        : 'Please enter a valid whole number for sold vehicles.'
    );
  } else if (!Number.isInteger(soldNum)) {
    pushError(
      'soldVehicles',
      isAr ? 'المركبات المبيعة' : 'Sold Vehicles',
      isAr
        ? 'عدد المركبات المبيعة يجب أن يكون رقماً صحيحاً بدون كسور عشرية.'
        : 'Sold vehicles must be a whole integer without decimals.'
    );
  } else if (soldNum < 0) {
    pushError(
      'soldVehicles',
      isAr ? 'المركبات المبيعة' : 'Sold Vehicles',
      isAr
        ? 'عدد المركبات المبيعة لا يمكن أن يكون قيمة سالبة.'
        : 'Sold vehicles cannot be negative.'
    );
  } else if (
    !fieldErrors.listedVehicles &&
    Number.isInteger(listedNum) &&
    listedNum > 0 &&
    soldNum > listedNum
  ) {
    pushError(
      'soldVehicles',
      isAr ? 'المركبات المبيعة' : 'Sold Vehicles',
      isAr
        ? `عدد المركبات المبيعة (${soldNum}) لا يمكن أن يتجاوز عدد المركبات المدرجة (${listedNum}).`
        : `Sold vehicles (${soldNum}) cannot exceed listed vehicles (${listedNum}).`
    );
  }

  return {
    valid: errors.length === 0,
    fieldErrors,
    errors,
    summaryMessages: errors.map((e) => `${e.label}: ${e.message}`),
  };
}

/**
 * Validates report period metadata dates (`reportDate`, `periodStart`, `periodEnd`).
 */
export function validateReportMetadataDates(
  meta: ReportMetadata,
  lang: Language
): {
  valid: boolean;
  fieldErrors: Partial<Record<keyof ReportMetadata, string>>;
  summaryMessages: string[];
} {
  const isAr = lang === 'ar';
  const fieldErrors: Partial<Record<keyof ReportMetadata, string>> = {};
  const summaryMessages: string[] = [];

  if (!meta.reportDate) {
    const msg = isAr ? 'يرجى تحديد تاريخ التقرير.' : 'Report date is required.';
    fieldErrors.reportDate = msg;
    summaryMessages.push(msg);
  }
  if (!meta.periodStart) {
    const msg = isAr ? 'يرجى تحديد تاريخ بداية الفترة.' : 'Period start date is required.';
    fieldErrors.periodStart = msg;
    summaryMessages.push(msg);
  }
  if (!meta.periodEnd) {
    const msg = isAr ? 'يرجى تحديد تاريخ نهاية الفترة.' : 'Period end date is required.';
    fieldErrors.periodEnd = msg;
    summaryMessages.push(msg);
  }
  if (meta.periodStart && meta.periodEnd && meta.periodStart > meta.periodEnd) {
    const msg = isAr
      ? 'تاريخ بداية الفترة لا يمكن أن يكون بعد تاريخ نهاية الفترة.'
      : 'Period start date cannot be after period end date.';
    fieldErrors.periodStart = msg;
    fieldErrors.periodEnd = msg;
    summaryMessages.push(msg);
  }

  return {
    valid: summaryMessages.length === 0,
    fieldErrors,
    summaryMessages,
  };
}

/**
 * Validates performance rating threshold settings.
 */
export function validatePerformanceThresholds(
  thresholds: PerformanceThresholds,
  lang: Language
): {
  valid: boolean;
  summaryMessages: string[];
} {
  const isAr = lang === 'ar';
  const summaryMessages: string[] = [];

  const checkRange = (val: number, label: string) => {
    if (Number.isNaN(val) || val < 0 || val > 100) {
      summaryMessages.push(
        isAr
          ? `${label}: يجب أن تكون النسبة بين 0 و 100.`
          : `${label}: Percentage must be between 0 and 100.`
      );
    }
  };

  checkRange(
    thresholds.needsImprovementMin,
    isAr ? 'الحد الأدنى لـ (يحتاج إلى تحسين)' : 'Needs Improvement Min'
  );
  checkRange(thresholds.goodMin, isAr ? 'الحد الأدنى لـ (أداء جيد)' : 'Good Performance Min');
  if (thresholds.useDetailedFourTierLabels) {
    checkRange(thresholds.excellentMin, isAr ? 'الحد الأدنى لـ (ممتاز)' : 'Excellent Min');
  }

  if (thresholds.goodMin < thresholds.needsImprovementMin) {
    summaryMessages.push(
      isAr
        ? 'الحد الأدنى للأداء الجيد يجب أن يكون أكبر من أو يساوي حد (يحتاج إلى تحسين).'
        : 'Good Performance threshold must be >= Needs Improvement threshold.'
    );
  }

  if (
    thresholds.useDetailedFourTierLabels &&
    thresholds.excellentMin < thresholds.goodMin
  ) {
    summaryMessages.push(
      isAr
        ? 'الحد الأدنى للأداء الممتاز يجب أن يكون أكبر من أو يساوي حد الأداء الجيد.'
        : 'Excellent threshold must be >= Good Performance threshold.'
    );
  }

  return {
    valid: summaryMessages.length === 0,
    summaryMessages,
  };
}
