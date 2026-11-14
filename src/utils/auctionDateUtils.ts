import { Language } from '../types/auction';

const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface IsoDateParts {
  year: number;
  month: number; // 1..12
  day: number; // 1..31
}

/**
 * Parses a YYYY-MM-DD string safely without browser/UTC timezone shift.
 * Returns null if the format or calendar date is invalid (e.g., 2026-02-30).
 */
export function parseIsoDateParts(
  value?: string | null
): IsoDateParts | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  const match = ISO_DATE_REGEX.exec(trimmed);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  // Verify actual calendar date (e.g. rejects Feb 30, Apr 31)
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() + 1 !== month ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

/**
 * Strict validator for YYYY-MM-DD auction date strings.
 */
export function isValidIsoDate(value?: string | null): boolean {
  return parseIsoDateParts(value) !== null;
}

/**
 * Normalizes a valid YYYY-MM-DD string or returns undefined.
 */
export function normalizeIsoDate(value?: string | null): string | undefined {
  const parts = parseIsoDateParts(value);
  if (!parts) return undefined;
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(
    2,
    '0'
  )}-${String(parts.day).padStart(2, '0')}`;
}

/**
 * Formats YYYY-MM-DD for display as DD/MM/YYYY (e.g., 14/11/2026).
 * For legacy records with no auctionDate, returns "غير محدد" / "Not specified" without fabricating dates.
 */
export function formatAuctionDateDisplay(
  value?: string | null,
  lang: Language = 'ar'
): string {
  const parts = parseIsoDateParts(value);
  if (!parts) {
    return lang === 'ar' ? 'غير محدد' : 'Not specified';
  }
  const dd = String(parts.day).padStart(2, '0');
  const mm = String(parts.month).padStart(2, '0');
  return `${dd}/${mm}/${parts.year}`;
}

/**
 * Returns today's date in YYYY-MM-DD format in UAE Timezone (Asia/Dubai).
 */
export function getDefaultUaeTodayIso(now: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Dubai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);

    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const d = parts.find((p) => p.type === 'day')?.value;
    if (y && m && d) {
      const candidate = `${y}-${m}-${d}`;
      if (isValidIsoDate(candidate)) return candidate;
    }
  } catch {
    // Fallback below
  }
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Converts a valid YYYY-MM-DD string into a UTC Date object for Excel date cells (no timezone shift).
 */
export function isoDateToExcelDate(value?: string | null): Date | null {
  const parts = parseIsoDateParts(value);
  if (!parts) return null;
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
}

/**
 * Compares two optional auctionDate strings chronologically.
 * Records without a date are always placed at the end regardless of sort direction.
 */
export function compareAuctionDates(
  aDate?: string,
  bDate?: string,
  ascending: boolean = true
): number {
  const aValid = normalizeIsoDate(aDate);
  const bValid = normalizeIsoDate(bDate);
  if (!aValid && !bValid) return 0;
  if (!aValid) return 1;
  if (!bValid) return -1;
  return ascending
    ? aValid.localeCompare(bValid)
    : bValid.localeCompare(aValid);
}
