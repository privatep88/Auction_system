import { jsPDF } from 'jspdf';
import {
  AuctionRecord,
  ComputedAuctionMetrics,
  Language,
  PerformanceThresholds,
  ReportingPeriod,
  ReportMetadata,
} from '../types/auction';
import {
  calculateMetrics,
  evaluateAuctionPerformance,
  getMonthName,
  loadPeriodData,
  loadThresholds,
} from './storageService';
import { PaperSizeOption } from '../components/ExecutiveAuctionPrintReport';
import { formatAuctionDateDisplay } from '../utils/auctionDateUtils';

export type PdfExportStage =
  | 'STAGE_1_DATA_VALIDATION'
  | 'STAGE_2_DOM_MOUNT_AND_HEADER_VERIFY'
  | 'STAGE_3_FONTS_AND_IMAGES'
  | 'STAGE_4_STYLE_AND_RTL_RANGE_SANITIZATION'
  | 'STAGE_5_CANVAS_RENDER'
  | 'STAGE_6_PDF_ASSEMBLY'
  | 'STAGE_7_FILE_DOWNLOAD';

interface LoadedReportAssets {
  font400Base64: string;
  font600Base64: string;
  font700Base64: string;
  saaedLogoDataUrl: string | null;
  headerPhotoDataUrl: string | null;
  yardShowcaseDataUrl: string | null;
  cardDistributionHeroDataUrl: string | null;
  cardComparisonHeroDataUrl: string | null;
  cardSuccessRateHeroDataUrl: string | null;
  opsNotesDataUrl: string | null;
  opsChallengesDataUrl: string | null;
  opsRecommendationsDataUrl: string | null;
}

let cachedAssetsPromise: Promise<LoadedReportAssets> | null = null;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const sub = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(sub));
  }
  if (typeof btoa === 'function') {
    return btoa(binary);
  }
  return Buffer.from(bytes).toString('base64');
}

async function loadBinaryAssetAsBase64(relativePath: string): Promise<string> {
  const cleanRel = relativePath.replace(/^\/+/, '');
  if (typeof window !== 'undefined' && typeof fetch === 'function') {
    const baseUrl =
      (typeof import.meta !== 'undefined' &&
        import.meta.env &&
        import.meta.env.BASE_URL) ||
      './';
    const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    const res = await fetch(`${normalizedBase}${cleanRel}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch asset: ${cleanRel} (${res.status})`);
    }
    const buf = await res.arrayBuffer();
    return arrayBufferToBase64(buf);
  } else {
    // Node.js environment fallback for automated Ghostscript verification
    const fs = await import('fs');
    const path = await import('path');
    const fullPath = path.resolve(process.cwd(), 'public', cleanRel);
    const buf = fs.readFileSync(fullPath);
    return buf.toString('base64');
  }
}

async function loadImageDataUrl(
  relativePath: string,
  mimeType: 'image/png' | 'image/jpeg'
): Promise<string | null> {
  try {
    const b64 = await loadBinaryAssetAsBase64(relativePath);
    return `data:${mimeType};base64,${b64}`;
  } catch {
    return null;
  }
}

async function getLoadedReportAssets(): Promise<LoadedReportAssets> {
  if (!cachedAssetsPromise) {
    cachedAssetsPromise = (async () => {
      const [
        font400Base64,
        font600Base64,
        font700Base64,
        saaedLogoDataUrl,
        headerPhotoDataUrl,
        yardShowcaseDataUrl,
        cardDistributionHeroDataUrl,
        cardComparisonHeroDataUrl,
        cardSuccessRateHeroDataUrl,
        opsNotesDataUrl,
        opsChallengesDataUrl,
        opsRecommendationsDataUrl,
      ] = await Promise.all([
        loadBinaryAssetAsBase64('assets/fonts/IBMPlexSansArabic-400.ttf'),
        loadBinaryAssetAsBase64('assets/fonts/IBMPlexSansArabic-600.ttf'),
        loadBinaryAssetAsBase64('assets/fonts/IBMPlexSansArabic-700.ttf'),
        loadImageDataUrl('assets/saaed_logo.png', 'image/png'),
        loadImageDataUrl('assets/header_top_photo.png', 'image/png'),
        loadImageDataUrl('assets/auction_yard_showcase.jpg', 'image/jpeg'),
        loadImageDataUrl('assets/card_distribution_hero.jpg', 'image/jpeg'),
        loadImageDataUrl('assets/card_comparison_hero.jpg', 'image/jpeg'),
        loadImageDataUrl('assets/card_success_rate_hero.jpg', 'image/jpeg'),
        loadImageDataUrl(
          'assets/operational_notes_inspection.jpg',
          'image/jpeg'
        ),
        loadImageDataUrl(
          'assets/operational_challenges_yard.jpg',
          'image/jpeg'
        ),
        loadImageDataUrl(
          'assets/recommendations_excellence.jpg',
          'image/jpeg'
        ),
      ]);

      return {
        font400Base64,
        font600Base64,
        font700Base64,
        saaedLogoDataUrl,
        headerPhotoDataUrl,
        yardShowcaseDataUrl,
        cardDistributionHeroDataUrl,
        cardComparisonHeroDataUrl,
        cardSuccessRateHeroDataUrl,
        opsNotesDataUrl,
        opsChallengesDataUrl,
        opsRecommendationsDataUrl,
      };
    })();
  }
  return cachedAssetsPromise;
}

/**
 * Draws a panoramic card hero image directly beneath a card header bar and blends
 * its bottom ~48% smoothly into pure white (#FFFFFF) using progressive GState opacity
 * bands so there is zero harsh edge between the photograph and the chart surface.
 */
function drawCardHeroWithWhiteFade(
  doc: jsPDF,
  imgDataUrl: string | null,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  const innerX = x + 0.3;
  const innerW = w - 0.6;
  if (!imgDataUrl) return;

  doc.addImage(imgDataUrl, 'JPEG', innerX, y, innerW, h, undefined, 'FAST');

  // Multi-step progressive white fade across the lower 48% of the photo
  const GStateCtor = (doc as unknown as {
    GState?: new (opts: { opacity: number }) => unknown;
  }).GState;

  if (typeof GStateCtor === 'function' && typeof doc.setGState === 'function') {
    const fadeStartY = y + h * 0.5;
    const fadeH = h * 0.5;
    const steps = 14;
    const bandH = fadeH / steps;

    doc.setFillColor(255, 255, 255);
    for (let i = 0; i < steps; i++) {
      const t = (i + 1) / steps;
      // Smooth ease-in curve matching CSS gradient (0 -> 0.38 -> 0.82 -> 1)
      const alpha = Math.min(1, Math.pow(t, 1.55));
      doc.setGState(new GStateCtor({ opacity: alpha }) as never);
      doc.rect(innerX, fadeStartY + i * bandH, innerW, bandH + 0.15, 'F');
    }
    doc.setGState(new GStateCtor({ opacity: 1 }) as never);
    // Clean white seal along the bottom seam to guarantee zero dark fringe
    doc.setFillColor(255, 255, 255);
    doc.rect(innerX, y + h - 0.45, innerW, 0.7, 'F');
  }
}

function registerArabicFontsInJsPdf(
  doc: jsPDF,
  assets: LoadedReportAssets
): void {
  doc.addFileToVFS('IBMPlexSansArabic-400.ttf', assets.font400Base64);
  doc.addFont('IBMPlexSansArabic-400.ttf', 'IBMPlexSansArabic', 'normal');

  doc.addFileToVFS('IBMPlexSansArabic-600.ttf', assets.font600Base64);
  doc.addFont('IBMPlexSansArabic-600.ttf', 'IBMPlexSansArabic', 'semibold');

  doc.addFileToVFS('IBMPlexSansArabic-700.ttf', assets.font700Base64);
  doc.addFont('IBMPlexSansArabic-700.ttf', 'IBMPlexSansArabic', 'bold');

  doc.setFont('IBMPlexSansArabic', 'bold');
}

/**
 * Normalizes Arabic & bidirectional text before passing to jsPDF:
 * 1. Strips Arabic tashkeel/tanween (U+064B..U+065F, U+0670) so glyphs stay connected.
 * 2. Removes trailing ASCII periods on Arabic sentences so punctuation does not jump to the right.
 * 3. Pre-swaps YYYY-MM-DD groups inside Arabic sentences so jsPDF's BiDi reverses the 3 groups
 *    back into visual YYYY-MM-DD order.
 */
export function normalizeArabicForPdf(rawText: string): string {
  if (!rawText) return '';
  let s = String(rawText)
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/\.+$/g, '')
    .trim();

  if (/[\u0600-\u06FF]/.test(s)) {
    s = s.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, '$3-$2-$1');
  }
  return s;
}

/**
 * Renders single-line Arabic/mixed text with exact BiDi placement for special duration formats:
 * - "10 أيام" / "14 يومًا": places the number on the right and the Arabic unit on the left.
 * - "أسبوع (7 أيام)": places "أسبوع" on the right and "(7 أيام)" on the left with mirrored parentheses.
 */
function drawSmartText(
  doc: jsPDF,
  rawText: string,
  x: number,
  y: number,
  align: 'right' | 'center' | 'left' = 'right'
): void {
  const cleaned = String(rawText || '')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/\.+$/g, '')
    .trim();

  if (!cleaned) return;

  // Case 1: Leading number + Arabic word (e.g., "10 أيام" or "14 يوما")
  const mNumWord = cleaned.match(/^(\d+)\s+([\u0600-\u06FF]+)$/);
  if (mNumWord) {
    const [, num, word] = mNumWord;
    const gap = 1.3;
    const wNum = doc.getTextWidth(num);
    const wWord = doc.getTextWidth(word);
    const totalW = wNum + gap + wWord;
    let rightEdge = x;
    if (align === 'center') rightEdge = x + totalW / 2;
    else if (align === 'left') rightEdge = x + totalW;

    doc.text(num, rightEdge, y, { align: 'right' });
    doc.text(word, rightEdge - wNum - gap, y, { align: 'right' });
    return;
  }

  // Case 2: "أسبوع (7 أيام)" -> "أسبوع" on right, "(7 أيام)" on left
  const mWeekDays = cleaned.match(
    /^([\u0600-\u06FF]+)\s*\((\d+)\s+([\u0600-\u06FF]+)\)$/
  );
  if (mWeekDays) {
    const [, w1, num, w2] = mWeekDays;
    const gap = 1.2;
    const pOpenRtl = ')';
    const pCloseRtl = '(';
    const wFirst = doc.getTextWidth(w1);
    const wOpen = doc.getTextWidth(pOpenRtl);
    const wNum = doc.getTextWidth(num);
    const wSecond = doc.getTextWidth(w2);
    const wClose = doc.getTextWidth(pCloseRtl);
    const totalW = wFirst + gap + wOpen + wNum + gap + wSecond + wClose;

    let rightEdge = x;
    if (align === 'center') rightEdge = x + totalW / 2;
    else if (align === 'left') rightEdge = x + totalW;

    let curRight = rightEdge;
    doc.text(w1, curRight, y, { align: 'right' });
    curRight -= wFirst + gap;
    doc.text(pOpenRtl, curRight, y, { align: 'right' });
    curRight -= wOpen;
    doc.text(num, curRight, y, { align: 'right' });
    curRight -= wNum + gap;
    doc.text(w2, curRight, y, { align: 'right' });
    curRight -= wSecond;
    doc.text(pCloseRtl, curRight, y, { align: 'right' });
    return;
  }

  const normalized = normalizeArabicForPdf(cleaned);
  doc.text(normalized, x, y, { align });
}

/**
 * Word-wraps Arabic/English text to fit within `maxWidthMm` without breaking words or codes.
 */
function wrapTextToLines(
  doc: jsPDF,
  rawText: string,
  maxWidthMm: number
): string[] {
  const cleaned = normalizeArabicForPdf(rawText);
  if (!cleaned) return ['-'];

  const words = cleaned.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (doc.getTextWidth(candidate) <= maxWidthMm || !currentLine) {
      currentLine = candidate;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines.length > 0 ? lines : ['-'];
}

/**
 * Draws a filled polygon ring sector (annular arc) for the vector Doughnut chart.
 */
function drawAnnularSector(
  doc: jsPDF,
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  startAngleRad: number,
  endAngleRad: number,
  rgb: [number, number, number]
): void {
  const span = Math.abs(endAngleRad - startAngleRad);
  if (span <= 0.0001) return;
  const steps = Math.max(24, Math.ceil((span / (2 * Math.PI)) * 96));

  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
  doc.setLineWidth(0.15);

  for (let i = 0; i < steps; i++) {
    const a0 = startAngleRad + ((endAngleRad - startAngleRad) * i) / steps;
    const a1 =
      startAngleRad + ((endAngleRad - startAngleRad) * (i + 1)) / steps;

    const x0o = cx + rOuter * Math.cos(a0);
    const y0o = cy + rOuter * Math.sin(a0);
    const x1o = cx + rOuter * Math.cos(a1);
    const y1o = cy + rOuter * Math.sin(a1);
    const x1i = cx + rInner * Math.cos(a1);
    const y1i = cy + rInner * Math.sin(a1);
    const x0i = cx + rInner * Math.cos(a0);
    const y0i = cy + rInner * Math.sin(a0);

    doc.triangle(x0o, y0o, x1o, y1o, x1i, y1i, 'FD');
    doc.triangle(x0o, y0o, x1i, y1i, x0i, y0i, 'FD');
  }
}

/**
 * Draws crisp vector KPI icons inside each KPI card on Page 1.
 */
function drawKpiVectorIcon(
  doc: jsPDF,
  kind: 'gavel' | 'listed' | 'sold' | 'unsold' | 'rate' | 'avg',
  cx: number,
  cy: number,
  scale: number = 1
): void {
  const r = 6.2 * scale;
  if (kind === 'gavel') {
    doc.setFillColor(254, 247, 230);
    doc.setDrawColor(214, 163, 72);
    doc.setLineWidth(0.35);
    doc.circle(cx, cy, r, 'FD');
    doc.setFillColor(180, 123, 34);
    doc.roundedRect(
      cx - 3.2 * scale,
      cy - 2.6 * scale,
      6.4 * scale,
      2.3 * scale,
      0.6,
      0.6,
      'F'
    );
    doc.roundedRect(
      cx - 0.8 * scale,
      cy - 0.5 * scale,
      1.6 * scale,
      3.8 * scale,
      0.4,
      0.4,
      'F'
    );
  } else if (kind === 'listed') {
    doc.setFillColor(238, 243, 249);
    doc.setDrawColor(18, 59, 112);
    doc.setLineWidth(0.35);
    doc.circle(cx, cy, r, 'FD');
    doc.setFillColor(18, 59, 112);
    doc.roundedRect(
      cx - 3.6 * scale,
      cy - 0.8 * scale,
      7.2 * scale,
      2.4 * scale,
      0.7,
      0.7,
      'F'
    );
    doc.roundedRect(
      cx - 2.2 * scale,
      cy - 2.3 * scale,
      4.4 * scale,
      1.8 * scale,
      0.6,
      0.6,
      'F'
    );
    doc.setFillColor(214, 163, 72);
    doc.circle(cx - 2.1 * scale, cy + 1.9 * scale, 0.9 * scale, 'F');
    doc.circle(cx + 2.1 * scale, cy + 1.9 * scale, 0.9 * scale, 'F');
  } else if (kind === 'sold') {
    doc.setFillColor(236, 253, 243);
    doc.setDrawColor(22, 132, 59);
    doc.setLineWidth(0.35);
    doc.circle(cx, cy, r, 'FD');
    doc.setDrawColor(22, 132, 59);
    doc.setLineWidth(0.8 * scale);
    doc.line(
      cx - 2.5 * scale,
      cy + 0.2 * scale,
      cx - 0.6 * scale,
      cy + 2.1 * scale
    );
    doc.line(
      cx - 0.6 * scale,
      cy + 2.1 * scale,
      cx + 2.8 * scale,
      cy - 1.9 * scale
    );
  } else if (kind === 'unsold') {
    doc.setFillColor(254, 243, 242);
    doc.setDrawColor(197, 43, 54);
    doc.setLineWidth(0.35);
    doc.circle(cx, cy, r, 'FD');
    doc.setDrawColor(197, 43, 54);
    doc.setLineWidth(0.8 * scale);
    doc.line(
      cx - 2.2 * scale,
      cy - 2.2 * scale,
      cx + 2.2 * scale,
      cy + 2.2 * scale
    );
    doc.line(
      cx + 2.2 * scale,
      cy - 2.2 * scale,
      cx - 2.2 * scale,
      cy + 2.2 * scale
    );
  } else if (kind === 'rate') {
    doc.setFillColor(254, 247, 230);
    doc.setDrawColor(214, 163, 72);
    doc.setLineWidth(0.35);
    doc.circle(cx, cy, r, 'FD');
    doc.setDrawColor(22, 132, 59);
    doc.setLineWidth(0.55 * scale);
    doc.circle(cx, cy, 3.4 * scale, 'S');
    doc.setFillColor(22, 132, 59);
    doc.circle(cx, cy, 1.4 * scale, 'F');
  } else if (kind === 'avg') {
    doc.setFillColor(238, 243, 249);
    doc.setDrawColor(23, 90, 156);
    doc.setLineWidth(0.35);
    doc.circle(cx, cy, r, 'FD');
    doc.setFillColor(23, 90, 156);
    doc.rect(cx - 2.8 * scale, cy + 0.2 * scale, 1.4 * scale, 2.4 * scale, 'F');
    doc.rect(cx - 0.7 * scale, cy - 1.1 * scale, 1.4 * scale, 3.7 * scale, 'F');
    doc.setFillColor(22, 132, 59);
    doc.rect(cx + 1.4 * scale, cy - 2.5 * scale, 1.4 * scale, 5.1 * scale, 'F');
  }
}

/**
 * Verifies DOM integrity of `.pdf-report-header` before browser print (Section 5):
 * Ensures strictly 1 logo element, 1 main h1 title, 1 subtitle p, and 1 auction yard image.
 */
export function verifyReportHeaderDomIntegrity(container: HTMLElement): void {
  const headers = Array.from(container.querySelectorAll('.pdf-report-header'));
  for (const header of headers) {
    const titleBox = header.querySelector('.pdf-header-title');
    if (titleBox) {
      const h1List = Array.from(titleBox.querySelectorAll('h1'));
      if (h1List.length > 1) {
        h1List.slice(1).forEach((dup) => dup.remove());
      }
      const pList = Array.from(titleBox.querySelectorAll('p'));
      if (pList.length > 1) {
        pList.slice(1).forEach((dup) => dup.remove());
      }
    }

    const logoBox = header.querySelector('.pdf-header-logo');
    if (logoBox) {
      const imgs = Array.from(logoBox.querySelectorAll('img'));
      if (imgs.length > 1) {
        imgs.slice(1).forEach((dup) => dup.remove());
      }
    }

    const imageBox = header.querySelector('.pdf-header-image');
    if (imageBox) {
      const imgs = Array.from(imageBox.querySelectorAll('img'));
      if (imgs.length > 1) {
        imgs.slice(1).forEach((dup) => dup.remove());
      }
    }
  }
}

/**
 * Explicitly loads Arabic fonts (`IBM Plex Sans Arabic` and `Cairo`) and decodes images
 * before native browser printing.
 */
export async function waitForReportAssets(
  container: HTMLElement,
  targetDoc?: Document
): Promise<void> {
  const doc = targetDoc || container.ownerDocument || document;

  if (doc && 'fonts' in doc) {
    try {
      await doc.fonts.ready;
      await Promise.all([
        doc.fonts.load('700 24px "IBM Plex Sans Arabic"'),
        doc.fonts.load('600 15px "IBM Plex Sans Arabic"'),
        doc.fonts.load('400 13px "IBM Plex Sans Arabic"'),
        doc.fonts.load('800 24px "Cairo"'),
        doc.fonts.load('700 16px "Cairo"'),
      ]);
      await doc.fonts.ready;
    } catch {
      // Ignore font API errors if offline
    }
  }

  const images = Array.from(container.querySelectorAll('img'));
  await Promise.all(
    images.map(async (img) => {
      try {
        if (!img.complete || img.naturalWidth === 0) {
          await new Promise<void>((resolve) => {
            const onDone = () => {
              img.removeEventListener('load', onDone);
              img.removeEventListener('error', onDone);
              resolve();
            };
            img.addEventListener('load', onDone);
            img.addEventListener('error', onDone);
            setTimeout(onDone, 4000);
          });
        }
        if (typeof img.decode === 'function' && img.naturalWidth > 0) {
          await img.decode().catch(() => {});
        }
      } catch {
        // Continue
      }
    })
  );

  if (typeof requestAnimationFrame === 'function') {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );
  }
}

/**
 * Triggers native browser printing exclusively for the official report template
 * (`#saaed-official-print-mount`) using a dedicated same-origin print iframe.
 */
export async function triggerOfficialReportPrint(
  paperSize: PaperSizeOption = 'a4'
): Promise<void> {
  const printMount = document.getElementById('saaed-official-print-mount');
  if (!printMount) {
    window.print();
    return;
  }

  verifyReportHeaderDomIntegrity(printMount);
  await waitForReportAssets(printMount, document);

  const sizeValue = paperSize === 'a3' ? 'A3 landscape' : 'A4 landscape';

  const styleId = 'saaed-dynamic-page-size-style';
  let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = `
    @media print {
      @page {
        size: ${sizeValue};
        margin: 0mm;
      }
    }
  `;

  const iframeId = 'saaed-dedicated-print-iframe';
  let printIframe = document.getElementById(
    iframeId
  ) as HTMLIFrameElement | null;
  if (printIframe) {
    printIframe.remove();
  }

  printIframe = document.createElement('iframe');
  printIframe.id = iframeId;
  printIframe.style.position = 'fixed';
  printIframe.style.right = '0';
  printIframe.style.bottom = '0';
  printIframe.style.width = '0';
  printIframe.style.height = '0';
  printIframe.style.border = '0';
  printIframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(printIframe);

  const iframeDoc =
    printIframe.contentDocument || printIframe.contentWindow?.document;

  if (!iframeDoc || !printIframe.contentWindow) {
    window.print();
    return;
  }

  const headLinksAndStyles = Array.from(
    document.head.querySelectorAll(
      'link[rel="stylesheet"], link[rel="preconnect"], style'
    )
  )
    .map((node) => node.outerHTML)
    .join('\n');

  iframeDoc.open();
  iframeDoc.write(`<!DOCTYPE html>
<html lang="${document.documentElement.lang || 'ar'}" dir="${
    document.documentElement.dir || 'rtl'
  }">
<head>
  <meta charset="UTF-8" />
  <title>SAAED Official Executive Auction Report</title>
  ${headLinksAndStyles}
  <style>
    @page {
      size: ${sizeValue};
      margin: 0mm;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #FFFFFF !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      font-family: "IBM Plex Sans Arabic", "Cairo", "Plus Jakarta Sans", sans-serif !important;
    }
    .report-document, .report-document * {
      letter-spacing: 0px !important;
      text-shadow: none !important;
    }
    .report-document {
      display: block !important;
      gap: 0 !important;
    }
    .official-report-page {
      margin: 0 auto !important;
      page-break-after: always !important;
      break-after: page !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      box-shadow: none !important;
      border: none !important;
    }
    .official-report-page:last-child {
      page-break-after: auto !important;
      break-after: auto !important;
    }
  </style>
</head>
<body>
  ${printMount.innerHTML}
</body>
</html>`);
  iframeDoc.close();

  await waitForReportAssets(iframeDoc.body, iframeDoc);

  try {
    printIframe.contentWindow.focus();
    printIframe.contentWindow.print();
  } catch (iframeErr) {
    try {
      window.print();
    } catch {
      throw iframeErr instanceof Error
        ? iframeErr
        : new Error('Unable to open browser print preview.');
    }
  }
}

export interface ExecutivePdfBuildParams {
  auctions?: AuctionRecord[];
  metrics?: ComputedAuctionMetrics;
  thresholds?: PerformanceThresholds;
  metadata: ReportMetadata;
  selectedPeriod: ReportingPeriod;
  lang: Language;
  paperSize?: PaperSizeOption;
  onProgress?: (stage: 'preparing' | 'building' | 'downloading') => void;
}

/**
 * Builds the complete Native Vector & True-Text `jsPDF` document for the SAAED
 * Vehicle Auction Executive Report.
 *
 * Every title, subtitle, KPI, chart label, table cell, operational insight, and
 * page number (`صفحة X من Y`) is rendered as real selectable/searchable Unicode text
 * using embedded `IBM Plex Sans Arabic` TrueType fonts.
 */
export async function buildExecutivePdfDocument(
  params: ExecutivePdfBuildParams
): Promise<jsPDF> {
  const { selectedPeriod, metadata, lang, paperSize = 'a4' } = params;
  const isAr = lang === 'ar';

  const auctions: AuctionRecord[] =
    params.auctions ??
    loadPeriodData(selectedPeriod.year, selectedPeriod.month).auctions;
  const metrics: ComputedAuctionMetrics =
    params.metrics ?? calculateMetrics(auctions);
  const thresholds: PerformanceThresholds =
    params.thresholds ?? loadThresholds();

  const assets = await getLoadedReportAssets();

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: paperSize,
    compress: true,
  });

  registerArabicFontsInJsPdf(doc, assets);

  const pageW = doc.internal.pageSize.getWidth(); // 297 for A4, 420 for A3
  const pageH = doc.internal.pageSize.getHeight(); // 210 for A4, 297 for A3
  const s = paperSize === 'a3' ? 420 / 297 : 1; // Scale factor for A3 vs A4
  const margin = 8 * s;
  const contentW = pageW - margin * 2;
  const footerH = 8.5 * s;
  const footerTopY = pageH - margin - footerH;

  const monthNameAr = getMonthName(selectedPeriod.month, 'ar');
  const monthNameEn = getMonthName(selectedPeriod.month, 'en');
  const paddedMonth = String(selectedPeriod.month).padStart(2, '0');

  // Track where each page's header badge is located so the 2nd pass stamps "صفحة X من Y"
  const pageHeaderBadgeCoords: Array<{
    pageIndex: number;
    x: number;
    y: number;
    w: number;
    h: number;
    bgRgb: [number, number, number];
  }> = [];

  const paintPageBackground = () => {
    doc.setFillColor(244, 247, 251); // #F4F7FB
    doc.rect(0, 0, pageW, pageH, 'F');
  };

  /**
   * Renders the Page 1 Official Report Header (3-Column RTL Grid + Metadata Sub-bar).
   * Returns the Y coordinate below the header.
   */
  const renderPage1OfficialHeader = (pageIndex: number): number => {
    const headerTop = margin;
    const bannerH = 23 * s;
    const metaBarH = 7.5 * s;
    const totalH = bannerH + metaBarH;

    // Outer card container
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, headerTop, contentW, totalH, 2.5 * s, 2.5 * s, 'FD');

    // RTL 3-Column widths:
    // Right (24%): SAAED Logo | Center (42%): Navy Title Zone | Left (34%): Auction Yard Photo
    const rightLogoW = contentW * 0.24;
    const leftPhotoW = contentW * 0.34;
    const centerTitleW = contentW - rightLogoW - leftPhotoW;

    const leftPhotoX = margin;
    const centerTitleX = margin + leftPhotoW;
    const rightLogoX = centerTitleX + centerTitleW;

    // 1. Center Navy Blue Title Zone (#123B70)
    doc.setFillColor(18, 59, 112);
    doc.rect(centerTitleX, headerTop, centerTitleW, bannerH, 'F');

    // Subtle top gold accent line inside center banner
    doc.setFillColor(214, 163, 72);
    doc.rect(centerTitleX, headerTop, centerTitleW, 1.1 * s, 'F');

    // Main Title (Single clean layer, bold white)
    doc.setFont('IBMPlexSansArabic', 'bold');
    doc.setFontSize(16.5 * s);
    doc.setTextColor(255, 255, 255);
    const mainTitle = isAr
      ? 'التقرير التنفيذي لمزادات المركبات'
      : 'Vehicle Auction Executive Report';
    drawSmartText(
      doc,
      mainTitle,
      centerTitleX + centerTitleW / 2,
      headerTop + 10.8 * s,
      'center'
    );

    // Subtitle (Golden #E2BB70)
    doc.setFont('IBMPlexSansArabic', 'semibold');
    doc.setFontSize(10.5 * s);
    doc.setTextColor(226, 187, 112);
    const subTitle = isAr
      ? `تقرير مزادات شهر ${monthNameAr} ${selectedPeriod.year}`
      : `Monthly Auction Report — ${monthNameEn} ${selectedPeriod.year}`;
    drawSmartText(
      doc,
      subTitle,
      centerTitleX + centerTitleW / 2,
      headerTop + 18.2 * s,
      'center'
    );

    // 2. Right Box: Official SAAED Logo (white background, preserved aspect ratio 600:233 = 2.575)
    doc.setFillColor(255, 255, 255);
    doc.rect(rightLogoX, headerTop, rightLogoW, bannerH, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.line(rightLogoX, headerTop, rightLogoX, headerTop + bannerH);

    if (assets.saaedLogoDataUrl) {
      const maxLogoH = bannerH - 5 * s;
      const maxLogoW = rightLogoW - 8 * s;
      const logoAspect = 600 / 233;
      let drawW = maxLogoH * logoAspect;
      let drawH = maxLogoH;
      if (drawW > maxLogoW) {
        drawW = maxLogoW;
        drawH = drawW / logoAspect;
      }
      const logoX = rightLogoX + (rightLogoW - drawW) / 2;
      const logoY = headerTop + (bannerH - drawH) / 2;
      doc.addImage(
        assets.saaedLogoDataUrl,
        'PNG',
        logoX,
        logoY,
        drawW,
        drawH,
        undefined,
        'FAST'
      );
    }

    // 3. Left Box: Original Panoramic Vehicle Auction Yard & Gavel Photo
    doc.setFillColor(18, 59, 112);
    doc.rect(leftPhotoX, headerTop, leftPhotoW, bannerH, 'F');
    if (assets.headerPhotoDataUrl) {
      doc.addImage(
        assets.headerPhotoDataUrl,
        'PNG',
        leftPhotoX,
        headerTop,
        leftPhotoW,
        bannerH,
        undefined,
        'FAST'
      );
    }
    doc.setDrawColor(214, 163, 72);
    doc.setLineWidth(0.5);
    doc.line(
      centerTitleX,
      headerTop,
      centerTitleX,
      headerTop + bannerH
    );

    // 4. Metadata Sub-bar below the 3-column header
    const metaY = headerTop + bannerH;
    doc.setFillColor(238, 243, 249); // #EEF3F9
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.rect(margin, metaY, contentW, metaBarH, 'FD');

    doc.setFont('IBMPlexSansArabic', 'bold');
    doc.setFontSize(8.8 * s);
    doc.setTextColor(18, 59, 112);

    // Right side of metadata bar: Reporting period
    const periodText = isAr
      ? `الفترة المشمولة بالتقرير: شهر ${monthNameAr} ${selectedPeriod.year} — من ${metadata.periodStart} إلى ${metadata.periodEnd}`
      : `Reporting Period: ${monthNameEn} ${selectedPeriod.year} (${metadata.periodStart} to ${metadata.periodEnd})`;
    drawSmartText(
      doc,
      periodText,
      margin + contentW - 3.5 * s,
      metaY + 5.1 * s,
      'right'
    );

    // Left side of metadata bar: Page badge + Report preparation date
    const badgeW = 24 * s;
    const badgeH = 5.2 * s;
    const badgeX = margin + 3 * s;
    const badgeY = metaY + (metaBarH - badgeH) / 2;

    pageHeaderBadgeCoords.push({
      pageIndex,
      x: badgeX,
      y: badgeY,
      w: badgeW,
      h: badgeH,
      bgRgb: [18, 59, 112],
    });

    const prepText = isAr
      ? `تاريخ إعداد التقرير: ${metadata.reportDate}`
      : `Report Date: ${metadata.reportDate}`;
    drawSmartText(
      doc,
      prepText,
      badgeX + badgeW + 3.5 * s,
      metaY + 5.1 * s,
      'left'
    );

    return headerTop + totalH;
  };

  /**
   * Renders the Compact Official Header for Pages 2..N.
   * Returns the Y coordinate below the compact header.
   */
  const renderCompactHeader = (
    pageIndex: number,
    sectionTitleAr: string,
    sectionTitleEn: string
  ): number => {
    const headerTop = margin;
    const compactH = 15.5 * s;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, headerTop, contentW, compactH, 2 * s, 2 * s, 'FD');

    const rightLogoW = 46 * s;
    const leftMetaW = 58 * s;
    const centerW = contentW - rightLogoW - leftMetaW;

    const leftMetaX = margin;
    const centerX = margin + leftMetaW;
    const rightLogoX = centerX + centerW;

    // Center Navy Section Title Banner
    doc.setFillColor(18, 59, 112);
    doc.rect(centerX, headerTop, centerW, compactH, 'F');
    doc.setFillColor(214, 163, 72);
    doc.rect(centerX, headerTop, centerW, 0.9 * s, 'F');

    doc.setFont('IBMPlexSansArabic', 'bold');
    doc.setFontSize(11.5 * s);
    doc.setTextColor(255, 255, 255);
    drawSmartText(
      doc,
      isAr ? sectionTitleAr : sectionTitleEn,
      centerX + centerW / 2,
      headerTop + 7.2 * s,
      'center'
    );

    doc.setFont('IBMPlexSansArabic', 'semibold');
    doc.setFontSize(8.5 * s);
    doc.setTextColor(226, 187, 112);
    drawSmartText(
      doc,
      isAr
        ? `التقرير التنفيذي لمزادات المركبات — شهر ${monthNameAr} ${selectedPeriod.year}`
        : `Vehicle Auction Executive Report — ${monthNameEn} ${selectedPeriod.year}`,
      centerX + centerW / 2,
      headerTop + 12.8 * s,
      'center'
    );

    // Right Logo Box
    doc.setFillColor(255, 255, 255);
    doc.rect(rightLogoX, headerTop, rightLogoW, compactH, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.line(rightLogoX, headerTop, rightLogoX, headerTop + compactH);

    if (assets.saaedLogoDataUrl) {
      const maxH = compactH - 3.6 * s;
      const maxW = rightLogoW - 6 * s;
      const aspect = 600 / 233;
      let drawW = maxH * aspect;
      let drawH = maxH;
      if (drawW > maxW) {
        drawW = maxW;
        drawH = drawW / aspect;
      }
      doc.addImage(
        assets.saaedLogoDataUrl,
        'PNG',
        rightLogoX + (rightLogoW - drawW) / 2,
        headerTop + (compactH - drawH) / 2,
        drawW,
        drawH,
        undefined,
        'FAST'
      );
    }

    // Left Meta & Page Badge Box
    doc.setFillColor(15, 47, 90);
    doc.rect(leftMetaX, headerTop, leftMetaW, compactH, 'F');

    doc.setFont('IBMPlexSansArabic', 'bold');
    doc.setFontSize(8 * s);
    doc.setTextColor(226, 187, 112);
    doc.text(
      `${selectedPeriod.year}-${paddedMonth}`,
      leftMetaX + leftMetaW - 3 * s,
      headerTop + 6.2 * s,
      { align: 'right' }
    );

    doc.setFont('IBMPlexSansArabic', 'normal');
    doc.setFontSize(7.5 * s);
    doc.setTextColor(226, 232, 240);
    doc.text(
      `Date: ${metadata.reportDate}`,
      leftMetaX + leftMetaW - 3 * s,
      headerTop + 12.4 * s,
      { align: 'right' }
    );

    const badgeW = 23 * s;
    const badgeH = 5.4 * s;
    const badgeX = leftMetaX + 2.8 * s;
    const badgeY = headerTop + (compactH - badgeH) / 2;

    pageHeaderBadgeCoords.push({
      pageIndex,
      x: badgeX,
      y: badgeY,
      w: badgeW,
      h: badgeH,
      bgRgb: [23, 90, 156],
    });

    return headerTop + compactH;
  };

  /* =========================================================================
     PAGE 1: EXECUTIVE SUMMARY, 3×2 KPI GRID & RESULTS DISTRIBUTION
     ========================================================================= */
  paintPageBackground();
  let curY = renderPage1OfficialHeader(1);

  // 1. SIX EXECUTIVE KPI CARDS IN SPACIOUS 3×2 GRID (Section 7)
  curY += 3 * s;
  const kpiCols = 3;
  const kpiRows = 2;
  const kpiGapX = 3.5 * s;
  const kpiGapY = 2.6 * s;
  const kpiCardW = (contentW - kpiGapX * (kpiCols - 1)) / kpiCols;
  const kpiCardH = 16.5 * s;

  const kpiItems: Array<{
    titleAr: string;
    titleEn: string;
    valueText: string;
    subTextAr?: string;
    subTextEn?: string;
    valueRgb: [number, number, number];
    accentRgb: [number, number, number];
    icon: 'gavel' | 'listed' | 'sold' | 'unsold' | 'rate' | 'avg';
  }> = [
    {
      titleAr: 'إجمالي عدد المزادات',
      titleEn: 'Total Auctions',
      valueText: metrics.totalAuctions.toLocaleString('en-US'),
      valueRgb: [143, 36, 44],
      accentRgb: [214, 163, 72],
      icon: 'gavel',
    },
    {
      titleAr: 'إجمالي المركبات المدرجة',
      titleEn: 'Total Listed Vehicles',
      valueText: metrics.totalListed.toLocaleString('en-US'),
      valueRgb: [18, 59, 112],
      accentRgb: [18, 59, 112],
      icon: 'listed',
    },
    {
      titleAr: 'إجمالي المركبات المبيعة',
      titleEn: 'Total Sold Vehicles',
      valueText: metrics.totalSold.toLocaleString('en-US'),
      valueRgb: [22, 132, 59],
      accentRgb: [22, 132, 59],
      icon: 'sold',
    },
    {
      titleAr: 'إجمالي المركبات غير المبيعة',
      titleEn: 'Total Unsold Vehicles',
      valueText: metrics.totalUnsold.toLocaleString('en-US'),
      valueRgb: [197, 43, 54],
      accentRgb: [197, 43, 54],
      icon: 'unsold',
    },
    {
      titleAr: 'نسبة نجاح البيع الإجمالية',
      titleEn: 'Overall Sale Success Rate',
      valueText: `${metrics.overallSaleRate.toFixed(1)}%`,
      valueRgb: [22, 132, 59],
      accentRgb: [22, 132, 59],
      icon: 'rate',
    },
    {
      titleAr: 'متوسط المبيعات لكل مزاد',
      titleEn: 'Average Sold per Auction',
      valueText: metrics.avgSoldPerAuction.toLocaleString('en-US'),
      subTextAr: 'مركبة / مزاد',
      subTextEn: 'Vehicles / Auction',
      valueRgb: [18, 59, 112],
      accentRgb: [23, 90, 156],
      icon: 'avg',
    },
  ];

  kpiItems.forEach((item, idx) => {
    const row = Math.floor(idx / kpiCols);
    const colInRow = idx % kpiCols;
    // RTL ordering: col 0 is rightmost, col 1 is middle, col 2 is leftmost
    const rtlCol = isAr ? kpiCols - 1 - colInRow : colInRow;
    const cardX = margin + rtlCol * (kpiCardW + kpiGapX);
    const cardY = curY + row * (kpiCardH + kpiGapY);

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.roundedRect(cardX, cardY, kpiCardW, kpiCardH, 2.2 * s, 2.2 * s, 'FD');

    // Right accent bar
    doc.setFillColor(item.accentRgb[0], item.accentRgb[1], item.accentRgb[2]);
    doc.roundedRect(
      cardX + kpiCardW - 1.5 * s,
      cardY + 2 * s,
      1.5 * s,
      kpiCardH - 4 * s,
      0.5 * s,
      0.5 * s,
      'F'
    );

    // Vector icon on the left side of the card
    const iconCx = cardX + 9 * s;
    const iconCy = cardY + kpiCardH / 2;
    drawKpiVectorIcon(doc, item.icon, iconCx, iconCy, s);

    // Label on top-right
    doc.setFont('IBMPlexSansArabic', 'bold');
    doc.setFontSize(9.2 * s);
    doc.setTextColor(18, 59, 112);
    drawSmartText(
      doc,
      isAr ? item.titleAr : item.titleEn,
      cardX + kpiCardW - 4.5 * s,
      cardY + 6.1 * s,
      'right'
    );

    // Value on bottom-right
    doc.setFont('IBMPlexSansArabic', 'bold');
    doc.setFontSize(14.5 * s);
    doc.setTextColor(item.valueRgb[0], item.valueRgb[1], item.valueRgb[2]);
    doc.text(
      item.valueText,
      cardX + kpiCardW - 4.5 * s,
      cardY + 13.4 * s,
      { align: 'right' }
    );

    if (item.subTextAr || item.subTextEn) {
      const valW = doc.getTextWidth(item.valueText);
      doc.setFont('IBMPlexSansArabic', 'semibold');
      doc.setFontSize(8 * s);
      doc.setTextColor(100, 116, 139);
      drawSmartText(
        doc,
        isAr ? item.subTextAr! : item.subTextEn!,
        cardX + kpiCardW - 4.5 * s - valW - 2.5 * s,
        cardY + 13.1 * s,
        'right'
      );
    }
  });

  curY += kpiRows * kpiCardH + (kpiRows - 1) * kpiGapY + 3.2 * s;

  // 2. THREE MAIN EXECUTIVE CARDS ON PAGE 1 (3 Equal Columns)
  const mainCardsH = footerTopY - curY - 2.5 * s;
  const mainColGap = 3.5 * s;
  const mainCardW = (contentW - mainColGap * 2) / 3;

  // RTL Positions:
  // Right card: Executive Summary
  // Center card: Results Distribution (Doughnut Chart)
  // Left card: Vehicle Auctions Showcase
  const rightCardX = margin + (mainCardW + mainColGap) * 2;
  const centerCardX = margin + (mainCardW + mainColGap) * 1;
  const leftCardX = margin;

  const drawCardHeaderBar = (
    x: number,
    y: number,
    w: number,
    titleAr: string,
    titleEn: string
  ): number => {
    const h = 8.5 * s;
    doc.setFillColor(18, 59, 112);
    doc.roundedRect(x, y, w, h, 2.2 * s, 2.2 * s, 'F');
    doc.rect(x, y + h - 2.2 * s, w, 2.2 * s, 'F'); // square bottom corners of header
    doc.setFillColor(214, 163, 72);
    doc.circle(x + w - 4.5 * s, y + h / 2, 1.3 * s, 'F');

    doc.setFont('IBMPlexSansArabic', 'bold');
    doc.setFontSize(10 * s);
    doc.setTextColor(255, 255, 255);
    drawSmartText(
      doc,
      isAr ? titleAr : titleEn,
      x + w - 8 * s,
      y + 5.8 * s,
      'right'
    );
    return y + h;
  };

  // --- RIGHT CARD: Executive Summary ---
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(
    rightCardX,
    curY,
    mainCardW,
    mainCardsH,
    2.2 * s,
    2.2 * s,
    'FD'
  );
  let sumY = drawCardHeaderBar(
    rightCardX,
    curY,
    mainCardW,
    'الملخص التنفيذي لنتائج المزادات',
    'Executive Auction Summary'
  );

  const summaryRows: Array<{
    labelAr: string;
    labelEn: string;
    val: string;
    rgb: [number, number, number];
  }> = [
    {
      labelAr: 'إجمالي عدد المزادات المنفذة',
      labelEn: 'Total Executed Auctions',
      val: metrics.totalAuctions.toLocaleString('en-US'),
      rgb: [18, 59, 112],
    },
    {
      labelAr: 'إجمالي المركبات المعروضة',
      labelEn: 'Total Listed Vehicles',
      val: metrics.totalListed.toLocaleString('en-US'),
      rgb: [20, 36, 61],
    },
    {
      labelAr: 'إجمالي المركبات المبيعة',
      labelEn: 'Total Sold Vehicles',
      val: metrics.totalSold.toLocaleString('en-US'),
      rgb: [22, 132, 59],
    },
    {
      labelAr: 'إجمالي المركبات غير المبيعة',
      labelEn: 'Total Unsold Vehicles',
      val: metrics.totalUnsold.toLocaleString('en-US'),
      rgb: [197, 43, 54],
    },
    {
      labelAr: 'النسبة الإجمالية للبيع',
      labelEn: 'Overall Sale Success Rate',
      val: `${metrics.overallSaleRate.toFixed(1)}%`,
      rgb: [22, 132, 59],
    },
  ];

  const rowStep = 10.2 * s;
  summaryRows.forEach((r, idx) => {
    const ry = sumY + 3 * s + idx * rowStep;
    if (idx > 0) {
      doc.setDrawColor(241, 245, 249);
      doc.setLineWidth(0.25);
      doc.line(
        rightCardX + 4 * s,
        ry - 2.2 * s,
        rightCardX + mainCardW - 4 * s,
        ry - 2.2 * s
      );
    }
    doc.setFont('IBMPlexSansArabic', 'semibold');
    doc.setFontSize(9 * s);
    doc.setTextColor(71, 85, 105);
    drawSmartText(
      doc,
      isAr ? r.labelAr : r.labelEn,
      rightCardX + mainCardW - 4.5 * s,
      ry + 3.8 * s,
      'right'
    );

    doc.setFont('IBMPlexSansArabic', 'bold');
    doc.setFontSize(11 * s);
    doc.setTextColor(r.rgb[0], r.rgb[1], r.rgb[2]);
    doc.text(r.val, rightCardX + 4.5 * s, ry + 4 * s, { align: 'left' });
  });

  // Highest & Lowest Sale Highlight Boxes at bottom of Executive Summary card
  const hlBoxH = 10.5 * s;
  const hlLowY = curY + mainCardsH - hlBoxH - 3.5 * s;
  const hlHighY = hlLowY - hlBoxH - 2.5 * s;

  if (metrics.highestSaleAuction) {
    doc.setFillColor(236, 253, 243); // #ECFDF3
    doc.setDrawColor(171, 239, 198);
    doc.roundedRect(
      rightCardX + 3.5 * s,
      hlHighY,
      mainCardW - 7 * s,
      hlBoxH,
      1.8 * s,
      1.8 * s,
      'FD'
    );
    doc.setFont('IBMPlexSansArabic', 'bold');
    doc.setFontSize(8.8 * s);
    doc.setTextColor(20, 36, 61);
    drawSmartText(
      doc,
      isAr ? 'أعلى نسبة بيع' : 'Highest Sale Rate',
      rightCardX + mainCardW - 6 * s,
      hlHighY + 6.7 * s,
      'right'
    );

    doc.setFont('IBMPlexSansArabic', 'bold');
    doc.setFontSize(9.5 * s);
    doc.setTextColor(22, 132, 59);
    doc.text(
      `${metrics.highestSaleAuction.auctionNumber} (${metrics.highestSaleAuction.saleRate.toFixed(1)}%)`,
      rightCardX + 6 * s,
      hlHighY + 6.8 * s,
      { align: 'left' }
    );
  }

  if (metrics.lowestSaleAuction) {
    doc.setFillColor(254, 243, 242); // #FEF3F2
    doc.setDrawColor(254, 205, 202);
    doc.roundedRect(
      rightCardX + 3.5 * s,
      hlLowY,
      mainCardW - 7 * s,
      hlBoxH,
      1.8 * s,
      1.8 * s,
      'FD'
    );
    doc.setFont('IBMPlexSansArabic', 'bold');
    doc.setFontSize(8.8 * s);
    doc.setTextColor(20, 36, 61);
    drawSmartText(
      doc,
      isAr ? 'أقل نسبة بيع' : 'Lowest Sale Rate',
      rightCardX + mainCardW - 6 * s,
      hlLowY + 6.7 * s,
      'right'
    );

    doc.setFont('IBMPlexSansArabic', 'bold');
    doc.setFontSize(9.5 * s);
    doc.setTextColor(197, 43, 54);
    doc.text(
      `${metrics.lowestSaleAuction.auctionNumber} (${metrics.lowestSaleAuction.saleRate.toFixed(1)}%)`,
      rightCardX + 6 * s,
      hlLowY + 6.8 * s,
      { align: 'left' }
    );
  }

  // --- CENTER CARD: Auction Results Distribution (Vector Doughnut Chart) ---
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(
    centerCardX,
    curY,
    mainCardW,
    mainCardsH,
    2.2 * s,
    2.2 * s,
    'FD'
  );
  const distBodyY = drawCardHeaderBar(
    centerCardX,
    curY,
    mainCardW,
    'توزيع نتائج المزادات',
    'Auction Results Distribution'
  );

  // Panoramic hero photo with smooth bottom white fade
  const distHeroH = 18.5 * s;
  drawCardHeroWithWhiteFade(
    doc,
    assets.cardDistributionHeroDataUrl || assets.yardShowcaseDataUrl,
    centerCardX,
    distBodyY,
    mainCardW,
    distHeroH
  );

  const effBarBoxH = 15 * s;
  const effBarBoxY = curY + mainCardsH - effBarBoxH;
  const distChartTop = distBodyY + distHeroH;
  const distChartAvailH = Math.max(36 * s, effBarBoxY - distChartTop);
  const distChartMidY = distChartTop + distChartAvailH / 2;

  const donutCx = centerCardX + 25 * s;
  const donutCy = distChartMidY;
  const rOuter = Math.min(17.2 * s, distChartAvailH * 0.41);
  const rInner = rOuter * 0.61;

  if (metrics.totalListed <= 0) {
    drawAnnularSector(
      doc,
      donutCx,
      donutCy,
      rInner,
      rOuter,
      0,
      2 * Math.PI,
      [226, 232, 240]
    );
  } else {
    const soldRatio = Math.min(1, Math.max(0, metrics.overallSaleRate / 100));
    const startAngle = -Math.PI / 2;
    const soldEndAngle = startAngle + soldRatio * 2 * Math.PI;
    const fullEndAngle = startAngle + 2 * Math.PI;

    drawAnnularSector(
      doc,
      donutCx,
      donutCy,
      rInner,
      rOuter,
      startAngle,
      soldEndAngle,
      [18, 89, 167] // #1259A7
    );
    if (soldRatio < 0.999) {
      drawAnnularSector(
        doc,
        donutCx,
        donutCy,
        rInner,
        rOuter,
        soldEndAngle,
        fullEndAngle,
        [214, 40, 40] // #D62828
      );
    }

    // Percentage labels inside the ring
    const rMid = (rInner + rOuter) / 2;
    if (metrics.overallSaleRate >= 15) {
      const midSoldAngle = (startAngle + soldEndAngle) / 2;
      const tx = donutCx + rMid * Math.cos(midSoldAngle);
      const ty = donutCy + rMid * Math.sin(midSoldAngle) + 1.0 * s;
      doc.setFont('IBMPlexSansArabic', 'bold');
      doc.setFontSize(6.4 * s);
      doc.setTextColor(255, 255, 255);
      doc.text(`${metrics.overallSaleRate.toFixed(1)}%`, tx, ty, {
        align: 'center',
      });
    }
    if (metrics.overallUnsoldRate >= 8) {
      const midUnsoldAngle = (soldEndAngle + fullEndAngle) / 2;
      const tx = donutCx + rMid * Math.cos(midUnsoldAngle);
      const ty = donutCy + rMid * Math.sin(midUnsoldAngle) + 1.0 * s;
      doc.setFont('IBMPlexSansArabic', 'bold');
      doc.setFontSize(6.2 * s);
      doc.setTextColor(255, 255, 255);
      doc.text(`${metrics.overallUnsoldRate.toFixed(1)}%`, tx, ty, {
        align: 'center',
      });
    }
  }

  // Center text inside doughnut hole
  doc.setFont('IBMPlexSansArabic', 'bold');
  doc.setFontSize(9.8 * s);
  doc.setTextColor(20, 36, 61);
  doc.text(
    metrics.totalListed.toLocaleString('en-US'),
    donutCx,
    donutCy - 0.5 * s,
    { align: 'center' }
  );
  doc.setFont('IBMPlexSansArabic', 'semibold');
  doc.setFontSize(6.8 * s);
  doc.setTextColor(100, 116, 139);
  drawSmartText(
    doc,
    isAr ? 'مركبة مدرجة' : 'Vehicles',
    donutCx,
    donutCy + 3.8 * s,
    'center'
  );

  // Breakdown Legend Cards on the right side of the Doughnut
  const legX = centerCardX + 46.5 * s;
  const legW = mainCardW - 50 * s;
  const legBoxGap = 3 * s;
  const legBoxH = Math.min(17.5 * s, (distChartAvailH - legBoxGap - 6 * s) / 2);
  const soldBoxY = distChartMidY - legBoxH - legBoxGap / 2;

  // Sold box
  doc.setFillColor(242, 246, 251);
  doc.setDrawColor(220, 230, 242);
  doc.roundedRect(legX, soldBoxY, legW, legBoxH, 1.8 * s, 1.8 * s, 'FD');
  doc.setFillColor(18, 89, 167);
  doc.rect(
    legX + legW - 5.2 * s,
    soldBoxY + 3.2 * s,
    2.5 * s,
    2.5 * s,
    'F'
  );
  doc.setFont('IBMPlexSansArabic', 'bold');
  doc.setFontSize(8.2 * s);
  doc.setTextColor(20, 36, 61);
  drawSmartText(
    doc,
    isAr ? 'المركبات المبيعة' : 'Sold Vehicles',
    legX + legW - 9 * s,
    soldBoxY + 5.6 * s,
    'right'
  );
  doc.setFont('IBMPlexSansArabic', 'bold');
  doc.setFontSize(10 * s);
  doc.setTextColor(20, 36, 61);
  doc.text(
    metrics.totalSold.toLocaleString('en-US'),
    legX + legW - 3.8 * s,
    soldBoxY + legBoxH - 3.6 * s,
    { align: 'right' }
  );
  doc.setFontSize(8.2 * s);
  doc.setTextColor(18, 89, 167);
  doc.text(
    `(${metrics.overallSaleRate.toFixed(1)}%)`,
    legX + 3.2 * s,
    soldBoxY + legBoxH - 3.6 * s,
    { align: 'left' }
  );

  // Unsold box
  const unsoldBoxY = soldBoxY + legBoxH + legBoxGap;
  doc.setFillColor(254, 244, 244);
  doc.setDrawColor(250, 219, 216);
  doc.roundedRect(legX, unsoldBoxY, legW, legBoxH, 1.8 * s, 1.8 * s, 'FD');
  doc.setFillColor(214, 40, 40);
  doc.rect(
    legX + legW - 5.2 * s,
    unsoldBoxY + 3.2 * s,
    2.5 * s,
    2.5 * s,
    'F'
  );
  doc.setFont('IBMPlexSansArabic', 'bold');
  doc.setFontSize(8.2 * s);
  doc.setTextColor(20, 36, 61);
  drawSmartText(
    doc,
    isAr ? 'المركبات غير المبيعة' : 'Unsold Vehicles',
    legX + legW - 9 * s,
    unsoldBoxY + 5.6 * s,
    'right'
  );
  doc.setFont('IBMPlexSansArabic', 'bold');
  doc.setFontSize(10 * s);
  doc.setTextColor(214, 40, 40);
  doc.text(
    metrics.totalUnsold.toLocaleString('en-US'),
    legX + legW - 3.8 * s,
    unsoldBoxY + legBoxH - 3.6 * s,
    { align: 'right' }
  );
  doc.setFontSize(8.2 * s);
  doc.text(
    `(${metrics.overallUnsoldRate.toFixed(1)}%)`,
    legX + 3.2 * s,
    unsoldBoxY + legBoxH - 3.6 * s,
    { align: 'left' }
  );

  // Overall sale rate bar at bottom of Center Card
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.line(
    centerCardX,
    effBarBoxY,
    centerCardX + mainCardW,
    effBarBoxY
  );
  doc.setFont('IBMPlexSansArabic', 'bold');
  doc.setFontSize(8.2 * s);
  doc.setTextColor(71, 85, 105);
  drawSmartText(
    doc,
    isAr ? 'مؤشر نسبة البيع الإجمالية' : 'Overall Sale Rate Index',
    centerCardX + mainCardW - 4.5 * s,
    effBarBoxY + 5.8 * s,
    'right'
  );
  doc.setTextColor(26, 143, 62);
  doc.text(
    `${metrics.overallSaleRate.toFixed(1)}%`,
    centerCardX + 4.5 * s,
    effBarBoxY + 5.8 * s,
    { align: 'left' }
  );

  const barTrackX = centerCardX + 4.5 * s;
  const barTrackY = effBarBoxY + 8.6 * s;
  const barTrackW = mainCardW - 9 * s;
  const barTrackH = 3.2 * s;
  doc.setFillColor(226, 232, 240);
  doc.roundedRect(
    barTrackX,
    barTrackY,
    barTrackW,
    barTrackH,
    1.5 * s,
    1.5 * s,
    'F'
  );
  const soldFillW =
    barTrackW * Math.min(1, Math.max(0, metrics.overallSaleRate / 100));
  if (soldFillW > 0) {
    doc.setFillColor(26, 143, 62);
    doc.roundedRect(
      barTrackX,
      barTrackY,
      soldFillW,
      barTrackH,
      1.5 * s,
      1.5 * s,
      'F'
    );
  }
  const unsoldFillW =
    barTrackW * Math.min(1, Math.max(0, metrics.overallUnsoldRate / 100));
  if (unsoldFillW > 0 && soldFillW < barTrackW) {
    doc.setFillColor(214, 40, 40);
    doc.roundedRect(
      barTrackX + soldFillW,
      barTrackY,
      Math.min(unsoldFillW, barTrackW - soldFillW),
      barTrackH,
      1.5 * s,
      1.5 * s,
      'F'
    );
  }

  // --- LEFT CARD: Vehicle Auctions Showcase ---
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(
    leftCardX,
    curY,
    mainCardW,
    mainCardsH,
    2.2 * s,
    2.2 * s,
    'FD'
  );
  const showBodyY = drawCardHeaderBar(
    leftCardX,
    curY,
    mainCardW,
    'ساحات مزادات المركبات',
    'Vehicle Auctions Showcase'
  );

  const bottomStatsH = 19 * s;
  const photoAreaH = curY + mainCardsH - bottomStatsH - showBodyY;
  doc.setFillColor(18, 59, 112);
  doc.rect(leftCardX + 0.3, showBodyY, mainCardW - 0.6, photoAreaH, 'F');

  if (assets.yardShowcaseDataUrl) {
    doc.addImage(
      assets.yardShowcaseDataUrl,
      'JPEG',
      leftCardX + 0.3,
      showBodyY,
      mainCardW - 0.6,
      photoAreaH,
      undefined,
      'FAST'
    );
  }

  // Dark navy caption overlay at bottom of showcase photo
  const capBannerH = 13.5 * s;
  const capBannerY = showBodyY + photoAreaH - capBannerH;
  doc.setFillColor(13, 43, 82);
  doc.rect(leftCardX + 0.3, capBannerY, mainCardW - 0.6, capBannerH, 'F');

  doc.setFont('IBMPlexSansArabic', 'bold');
  doc.setFontSize(8.8 * s);
  doc.setTextColor(255, 255, 255);
  drawSmartText(
    doc,
    isAr
      ? `ساحات مزادات شركة ساعد — شهر ${monthNameAr} ${selectedPeriod.year}`
      : `SAAED Official Auction Yards — ${monthNameEn} ${selectedPeriod.year}`,
    leftCardX + mainCardW - 4 * s,
    capBannerY + 5.5 * s,
    'right'
  );

  doc.setFont('IBMPlexSansArabic', 'normal');
  doc.setFontSize(7.4 * s);
  doc.setTextColor(226, 187, 112);
  drawSmartText(
    doc,
    isAr
      ? 'تنظيم وإدارة مزادات المركبات وفق أعلى المعايير التشغيلية'
      : 'Enterprise vehicle auction management & operational analytics',
    leftCardX + mainCardW - 4 * s,
    capBannerY + 10.6 * s,
    'right'
  );

  // Two bottom average boxes inside Left Card
  const statsTopY = showBodyY + photoAreaH;
  const subBoxW = (mainCardW - 9 * s) / 2;
  const subBoxH = bottomStatsH - 4.4 * s;
  const rightSubX = leftCardX + 3 * s + subBoxW + 3 * s;
  const leftSubX = leftCardX + 3 * s;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(
    rightSubX,
    statsTopY + 2.2 * s,
    subBoxW,
    subBoxH,
    1.5 * s,
    1.5 * s,
    'FD'
  );
  doc.roundedRect(
    leftSubX,
    statsTopY + 2.2 * s,
    subBoxW,
    subBoxH,
    1.5 * s,
    1.5 * s,
    'FD'
  );

  const avgListed =
    metrics.totalAuctions > 0
      ? Math.round(metrics.totalListed / metrics.totalAuctions)
      : 0;

  doc.setFont('IBMPlexSansArabic', 'semibold');
  doc.setFontSize(7.6 * s);
  doc.setTextColor(100, 116, 139);
  drawSmartText(
    doc,
    isAr ? 'معدل المركبات لكل مزاد' : 'Avg Listed / Auction',
    rightSubX + subBoxW / 2,
    statsTopY + 7.2 * s,
    'center'
  );
  doc.setFont('IBMPlexSansArabic', 'bold');
  doc.setFontSize(10.5 * s);
  doc.setTextColor(18, 59, 112);
  doc.text(
    avgListed.toLocaleString('en-US'),
    rightSubX + subBoxW / 2,
    statsTopY + 13.8 * s,
    { align: 'center' }
  );

  doc.setFont('IBMPlexSansArabic', 'semibold');
  doc.setFontSize(7.6 * s);
  doc.setTextColor(100, 116, 139);
  drawSmartText(
    doc,
    isAr ? 'معدل المبيعات لكل مزاد' : 'Avg Sold / Auction',
    leftSubX + subBoxW / 2,
    statsTopY + 7.2 * s,
    'center'
  );
  doc.setFont('IBMPlexSansArabic', 'bold');
  doc.setFontSize(10.5 * s);
  doc.setTextColor(22, 132, 59);
  doc.text(
    metrics.avgSoldPerAuction.toLocaleString('en-US'),
    leftSubX + subBoxW / 2,
    statsTopY + 13.8 * s,
    { align: 'center' }
  );

  /* =========================================================================
     PAGE 2 (AND CONTINUATION IF >10 AUCTIONS): VISUAL CHARTS ANALYSIS
     ========================================================================= */
  const chartBatchSize = 10;
  const chartBatches: AuctionRecord[][] = [];
  if (auctions.length === 0) {
    chartBatches.push([]);
  } else {
    for (let i = 0; i < auctions.length; i += chartBatchSize) {
      chartBatches.push(auctions.slice(i, i + chartBatchSize));
    }
  }

  const sortedBySaleRateAll = [...auctions].sort(
    (a, b) => b.saleRate - a.saleRate
  );

  chartBatches.forEach((batch, batchIdx) => {
    doc.addPage(paperSize, 'landscape');
    paintPageBackground();
    const pIdx = doc.getNumberOfPages();

    const headerTitleAr =
      chartBatches.length > 1
        ? `التحليل البياني لأداء المزادات ونسب النجاح — الجزء ${batchIdx + 1} من ${chartBatches.length}`
        : 'التحليل البياني لأداء المزادات ونسب النجاح';
    const headerTitleEn =
      chartBatches.length > 1
        ? `Visual Performance & Sale Rate Analysis (${batchIdx + 1} of ${chartBatches.length})`
        : 'Visual Performance & Sale Success Rate Analysis';

    const topY = renderCompactHeader(pIdx, headerTitleAr, headerTitleEn) + 3.5 * s;
    const chartsH = footerTopY - topY - 2.5 * s;

    // Right Card (58% width): Clustered Bar Chart
    // Left Card (42% width): Horizontal Sale Rate Ranking Chart
    const gapX = 4 * s;
    const rightChartW = (contentW - gapX) * 0.58;
    const leftChartW = contentW - gapX - rightChartW;

    const rightChartX = margin + leftChartW + gapX;
    const leftChartX = margin;

    // --- RIGHT CHART CARD: Clustered Column Comparison ---
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.roundedRect(
      rightChartX,
      topY,
      rightChartW,
      chartsH,
      2.2 * s,
      2.2 * s,
      'FD'
    );
    const barHeaderBottom = drawCardHeaderBar(
      rightChartX,
      topY,
      rightChartW,
      'مقارنة أداء المزادات — المدرجة والمبيعة وغير المبيعة',
      'Auction Performance Comparison — Listed, Sold & Unsold'
    );

    // Panoramic hero photo with smooth bottom white fade
    const chartHeroH = 26 * s;
    drawCardHeroWithWhiteFade(
      doc,
      assets.cardComparisonHeroDataUrl || assets.yardShowcaseDataUrl,
      rightChartX,
      barHeaderBottom,
      rightChartW,
      chartHeroH
    );

    const legendH = 12 * s;
    const plotTop = barHeaderBottom + chartHeroH + 6 * s;
    const plotBottom = topY + chartsH - legendH - 10 * s;
    const plotH = plotBottom - plotTop;
    const plotLeft = rightChartX + 14 * s;
    const plotRight = rightChartX + rightChartW - 6 * s;
    const plotW = plotRight - plotLeft;

    if (batch.length === 0) {
      doc.setFont('IBMPlexSansArabic', 'bold');
      doc.setFontSize(11 * s);
      doc.setTextColor(100, 116, 139);
      drawSmartText(
        doc,
        isAr
          ? `لا توجد مزادات مسجلة لشهر ${monthNameAr} ${selectedPeriod.year}`
          : `No auctions recorded for ${monthNameEn} ${selectedPeriod.year}`,
        rightChartX + rightChartW / 2,
        topY + chartsH / 2,
        'center'
      );
    } else {
      const maxVal = Math.max(
        300,
        ...auctions.map((a) => a.listedVehicles)
      );
      const yMax = Math.max(350, Math.ceil((maxVal + 20) / 50) * 50);
      const tickCount = 7;

      for (let t = 0; t <= tickCount; t++) {
        const val = Math.round((yMax * t) / tickCount);
        const yPos = plotBottom - (t / tickCount) * plotH;

        doc.setDrawColor(t === 0 ? 100 : 226, t === 0 ? 116 : 232, t === 0 ? 139 : 240);
        doc.setLineWidth(t === 0 ? 0.4 : 0.25);
        doc.line(plotLeft, yPos, plotRight, yPos);

        doc.setFont('IBMPlexSansArabic', 'bold');
        doc.setFontSize(8 * s);
        doc.setTextColor(100, 116, 139);
        doc.text(String(val), plotLeft - 2.2 * s, yPos + 1 * s, {
          align: 'right',
        });
      }

      const groupW = plotW / batch.length;
      const barW = Math.min(7.5 * s, Math.max(3.2 * s, groupW * 0.23));
      const barGap = 1.1 * s;

      batch.forEach((auc, idx) => {
        const groupCx = plotLeft + groupW * idx + groupW / 2;
        const listedH = (auc.listedVehicles / yMax) * plotH;
        const soldH = (auc.soldVehicles / yMax) * plotH;
        const unsoldH = (auc.unsoldVehicles / yMax) * plotH;

        const xListed = groupCx - barW * 1.5 - barGap;
        const xSold = groupCx - barW * 0.5;
        const xUnsold = groupCx + barW * 0.5 + barGap;

        // Listed bar (#123B70)
        doc.setFillColor(18, 59, 112);
        doc.rect(
          xListed,
          plotBottom - Math.max(0.8, listedH),
          barW,
          Math.max(0.8, listedH),
          'F'
        );
        doc.setFont('IBMPlexSansArabic', 'bold');
        doc.setFontSize(batch.length > 7 ? 6.5 * s : 7.5 * s);
        doc.setTextColor(18, 59, 112);
        doc.text(
          String(auc.listedVehicles),
          xListed + barW / 2,
          plotBottom - listedH - 1.5 * s,
          { align: 'center' }
        );

        // Sold bar (#16843B)
        doc.setFillColor(22, 132, 59);
        doc.rect(
          xSold,
          plotBottom - Math.max(0.8, soldH),
          barW,
          Math.max(0.8, soldH),
          'F'
        );
        doc.setTextColor(22, 132, 59);
        doc.text(
          String(auc.soldVehicles),
          xSold + barW / 2,
          plotBottom - soldH - 1.5 * s,
          { align: 'center' }
        );

        // Unsold bar (#C52B36)
        doc.setFillColor(197, 43, 54);
        doc.rect(
          xUnsold,
          plotBottom - Math.max(0.8, unsoldH),
          barW,
          Math.max(0.8, unsoldH),
          'F'
        );
        doc.setTextColor(197, 43, 54);
        doc.text(
          String(auc.unsoldVehicles),
          xUnsold + barW / 2,
          plotBottom - unsoldH - 1.5 * s,
          { align: 'center' }
        );

        // X-axis Auction Code (unbroken)
        doc.setFont('IBMPlexSansArabic', 'bold');
        doc.setFontSize(batch.length > 7 ? 7.2 * s : 8.2 * s);
        doc.setTextColor(20, 36, 61);
        doc.text(auc.auctionNumber, groupCx, plotBottom + 5.2 * s, {
          align: 'center',
        });
      });
    }

    // Bottom Legend inside Clustered Column Card
    const legTopY = topY + chartsH - legendH;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.line(rightChartX, legTopY, rightChartX + rightChartW, legTopY);

    const legItems: Array<{
      labelAr: string;
      labelEn: string;
      val: string;
      rgb: [number, number, number];
    }> = [
      {
        labelAr: 'المركبات المدرجة',
        labelEn: 'Listed:',
        val: metrics.totalListed.toLocaleString('en-US'),
        rgb: [18, 59, 112],
      },
      {
        labelAr: 'المركبات المبيعة',
        labelEn: 'Sold:',
        val: metrics.totalSold.toLocaleString('en-US'),
        rgb: [22, 132, 59],
      },
      {
        labelAr: 'المركبات غير المبيعة',
        labelEn: 'Unsold:',
        val: metrics.totalUnsold.toLocaleString('en-US'),
        rgb: [197, 43, 54],
      },
    ];

    const legSlotW = rightChartW / 3;
    legItems.forEach((li, i) => {
      const rtlIdx = isAr ? 2 - i : i;
      const slotRight = rightChartX + (rtlIdx + 1) * legSlotW - 5 * s;
      doc.setFillColor(li.rgb[0], li.rgb[1], li.rgb[2]);
      doc.rect(
        slotRight - 2.8 * s,
        legTopY + 4.3 * s,
        2.8 * s,
        2.8 * s,
        'F'
      );
      doc.setFont('IBMPlexSansArabic', 'bold');
      doc.setFontSize(8.2 * s);
      doc.setTextColor(20, 36, 61);
      const labelStr = isAr ? li.labelAr : li.labelEn;
      drawSmartText(
        doc,
        labelStr,
        slotRight - 4.5 * s,
        legTopY + 7 * s,
        'right'
      );
      const labelW = doc.getTextWidth(normalizeArabicForPdf(labelStr));
      doc.setTextColor(li.rgb[0], li.rgb[1], li.rgb[2]);
      doc.text(
        li.val,
        slotRight - 4.5 * s - labelW - 1.8 * s,
        legTopY + 7 * s,
        { align: 'right' }
      );
    });

    // --- LEFT CHART CARD: Horizontal Sale Success Rate Ranking ---
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.roundedRect(
      leftChartX,
      topY,
      leftChartW,
      chartsH,
      2.2 * s,
      2.2 * s,
      'FD'
    );
    const rankHeaderBottom = drawCardHeaderBar(
      leftChartX,
      topY,
      leftChartW,
      'نسبة نجاح البيع حسب المزاد — تنازليا',
      'Sale Success Rate by Auction — Descending'
    );

    // Panoramic hero photo with smooth bottom white fade
    drawCardHeroWithWhiteFade(
      doc,
      assets.cardSuccessRateHeroDataUrl || assets.yardShowcaseDataUrl,
      leftChartX,
      rankHeaderBottom,
      leftChartW,
      chartHeroH
    );

    const rankBatch = sortedBySaleRateAll.slice(
      batchIdx * chartBatchSize,
      (batchIdx + 1) * chartBatchSize
    );

    const scaleFooterH = 12 * s;
    const rankBodyTop = rankHeaderBottom + chartHeroH + 4 * s;
    const rankBodyBottom = topY + chartsH - scaleFooterH - 2 * s;
    const rankBodyH = rankBodyBottom - rankBodyTop;

    const codeColX = leftChartX + 4 * s;
    const barTrackLeft = leftChartX + 22 * s;
    const barTrackRight = leftChartX + leftChartW - 29 * s;
    const barTrackWidth = barTrackRight - barTrackLeft;

    if (rankBatch.length > 0) {
      const rowStepH = Math.min(
        13 * s,
        rankBodyH / Math.max(1, rankBatch.length)
      );
      const barH = Math.min(6.2 * s, rowStepH * 0.56);

      rankBatch.forEach((auc, idx) => {
        const rowCenterY =
          rankBodyTop + idx * rowStepH + rowStepH / 2;

        // Auction Code (Unbroken LTR)
        doc.setFont('IBMPlexSansArabic', 'bold');
        doc.setFontSize(8.5 * s);
        doc.setTextColor(18, 59, 112);
        doc.text(auc.auctionNumber, codeColX, rowCenterY + 1.2 * s, {
          align: 'left',
        });

        // Track background
        doc.setFillColor(241, 245, 249);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(
          barTrackLeft,
          rowCenterY - barH / 2,
          barTrackWidth,
          barH,
          1.2 * s,
          1.2 * s,
          'FD'
        );

        // Filled green bar
        const fillW =
          barTrackWidth * Math.min(1, Math.max(0.04, auc.saleRate / 100));
        doc.setFillColor(22, 132, 59);
        doc.roundedRect(
          barTrackLeft,
          rowCenterY - barH / 2,
          fillW,
          barH,
          1.2 * s,
          1.2 * s,
          'F'
        );

        // Rate % + (Sold/Listed) on right
        doc.setFont('IBMPlexSansArabic', 'bold');
        doc.setFontSize(8.3 * s);
        doc.setTextColor(22, 132, 59);
        doc.text(
          `${auc.saleRate.toFixed(1)}%`,
          barTrackRight + 2 * s,
          rowCenterY + 1.2 * s,
          { align: 'left' }
        );

        doc.setFont('IBMPlexSansArabic', 'normal');
        doc.setFontSize(7.2 * s);
        doc.setTextColor(100, 116, 139);
        doc.text(
          `(${auc.soldVehicles}/${auc.listedVehicles})`,
          leftChartX + leftChartW - 3.5 * s,
          rowCenterY + 1.2 * s,
          { align: 'right' }
        );
      });
    }

    // Bottom 0% .. 100% scale bar
    const scaleTopY = topY + chartsH - scaleFooterH;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.line(leftChartX, scaleTopY, leftChartX + leftChartW, scaleTopY);

    doc.setFont('IBMPlexSansArabic', 'bold');
    doc.setFontSize(7.5 * s);
    doc.setTextColor(100, 116, 139);
    [0, 20, 40, 60, 80, 100].forEach((pct) => {
      const px = barTrackLeft + (pct / 100) * barTrackWidth;
      doc.text(`${pct}%`, px, scaleTopY + 7 * s, { align: 'center' });
    });
  });

  /* =========================================================================
     PAGE 3+: DETAILED AUCTION DATA TABLE (DYNAMIC MULTI-LINE PAGINATION)
     ========================================================================= */
  // RTL Column widths (total = contentW = 281mm on A4):
  // 1. م | 2. رقم المزاد | 3. تاريخ المزاد | 4. مدة عرض المزاد | 5. المدرجة | 6. المبيعة | 7. غير المبيعة | 8..10 Notes/Challenges/Recommendations
  const colFractions = [
    0.034, // م
    0.078, // رقم المزاد
    0.088, // تاريخ المزاد
    0.094, // مدة عرض المزاد
    0.074, // المركبات المدرجة
    0.074, // المركبات المبيعة
    0.074, // غير المبيعة
    0.161, // الملاحظات
    0.161, // التحديات
    0.162, // التوصيات
  ];
  const colWidths = colFractions.map((f) => f * contentW);

  // Compute X coordinates of each column (RTL: col 0 is on the far right, col 9 on the far left)
  const colXs: number[] = [];
  let runningRight = margin + contentW;
  for (let c = 0; c < colWidths.length; c++) {
    runningRight -= colWidths[c];
    colXs.push(runningRight);
  }

  const tableHeadersAr = [
    'م',
    'رقم المزاد',
    'تاريخ المزاد',
    'مدة عرض المزاد',
    'المركبات المدرجة',
    'المركبات المبيعة',
    'غير المبيعة',
    'الملاحظات',
    'التحديات',
    'التوصيات',
  ];
  const tableHeadersEn = [
    '#',
    'Auction ID',
    'Auction Date',
    'Duration',
    'Listed',
    'Sold',
    'Unsold',
    'Operational Notes',
    'Challenges',
    'Recommendations',
  ];

  // Pre-measure every auction row so we know exact heights and how many table pages exist
  doc.setFont('IBMPlexSansArabic', 'semibold');
  doc.setFontSize(8.5 * s);
  const lineH = 4.3 * s;

  const measuredRows = auctions.map((auc, idx) => {
    const notesLines = wrapTextToLines(
      doc,
      isAr ? auc.notesAr : auc.notesEn,
      colWidths[7] - 4 * s
    );
    const challengesLines = wrapTextToLines(
      doc,
      isAr ? auc.challengesAr : auc.challengesEn,
      colWidths[8] - 4 * s
    );
    const recsLines = wrapTextToLines(
      doc,
      isAr ? auc.recommendationsAr : auc.recommendationsEn,
      colWidths[9] - 4 * s
    );
    const maxLines = Math.max(
      1,
      notesLines.length,
      challengesLines.length,
      recsLines.length
    );
    const rowH = Math.max(9.5 * s, maxLines * lineH + 4.2 * s);
    return {
      auc,
      rowNum: idx + 1,
      notesLines,
      challengesLines,
      recsLines,
      rowH,
    };
  });

  const tableHeaderH = 10 * s;
  const grandTotalRowH = 10.5 * s;
  const maxTableAreaH = footerTopY - (margin + 15.5 * s + 3.5 * s) - 2.5 * s;

  // Group measuredRows into pages so no row or grand total row ever overflows
  const dataPages: Array<typeof measuredRows> = [];
  if (measuredRows.length === 0) {
    dataPages.push([]);
  } else {
    let currentChunk: typeof measuredRows = [];
    let currentUsedH = tableHeaderH;
    for (let i = 0; i < measuredRows.length; i++) {
      const r = measuredRows[i];
      const isLastRow = i === measuredRows.length - 1;
      const neededExtra = isLastRow ? r.rowH + grandTotalRowH : r.rowH;
      if (
        currentChunk.length > 0 &&
        currentUsedH + neededExtra > maxTableAreaH
      ) {
        dataPages.push(currentChunk);
        currentChunk = [r];
        currentUsedH = tableHeaderH + r.rowH;
      } else {
        currentChunk.push(r);
        currentUsedH += r.rowH;
      }
    }
    if (currentChunk.length > 0) {
      dataPages.push(currentChunk);
    }
  }

  dataPages.forEach((chunk, chunkIdx) => {
    doc.addPage(paperSize, 'landscape');
    paintPageBackground();
    const pIdx = doc.getNumberOfPages();
    const isLastChunk = chunkIdx === dataPages.length - 1;

    const secTitleAr =
      dataPages.length > 1
        ? `جدول بيانات المزادات التفصيلي — الجزء ${chunkIdx + 1} من ${dataPages.length}`
        : 'جدول بيانات المزادات التفصيلي';
    const secTitleEn =
      dataPages.length > 1
        ? `Detailed Auction Data Report (${chunkIdx + 1} of ${dataPages.length})`
        : 'Detailed Auction Data Report';

    let tY = renderCompactHeader(pIdx, secTitleAr, secTitleEn) + 3.5 * s;

    // Draw Table Header Row (setFillColor inside loop so every column header cell stays dark navy)
    for (let c = 0; c < colWidths.length; c++) {
      doc.setFillColor(18, 59, 112);
      doc.setDrawColor(36, 82, 138);
      doc.setLineWidth(0.28);
      doc.rect(colXs[c], tY, colWidths[c], tableHeaderH, 'FD');
      doc.setFont('IBMPlexSansArabic', 'bold');
      doc.setFontSize(8.4 * s);
      doc.setTextColor(255, 255, 255);
      drawSmartText(
        doc,
        isAr ? tableHeadersAr[c] : tableHeadersEn[c],
        colXs[c] + colWidths[c] / 2,
        tY + 6.4 * s,
        'center'
      );
    }
    tY += tableHeaderH;

    if (chunk.length === 0) {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(203, 213, 225);
      doc.rect(margin, tY, contentW, 28 * s, 'FD');
      doc.setFont('IBMPlexSansArabic', 'bold');
      doc.setFontSize(10.5 * s);
      doc.setTextColor(100, 116, 139);
      drawSmartText(
        doc,
        isAr
          ? `لا توجد مزادات مسجلة لشهر ${monthNameAr} ${selectedPeriod.year}`
          : `No auctions recorded for ${monthNameEn} ${selectedPeriod.year}`,
        margin + contentW / 2,
        tY + 15 * s,
        'center'
      );
      tY += 28 * s;
    } else {
      chunk.forEach((rowObj, rIdx) => {
        const { auc, rowNum, notesLines, challengesLines, recsLines, rowH } =
          rowObj;
        const isEven = rIdx % 2 === 0;

        for (let c = 0; c < colWidths.length; c++) {
          doc.setFillColor(
            isEven ? 255 : 244,
            isEven ? 255 : 247,
            isEven ? 255 : 251
          );
          doc.setDrawColor(203, 213, 225);
          doc.setLineWidth(0.25);
          doc.rect(colXs[c], tY, colWidths[c], rowH, 'FD');
        }

        const midY = tY + rowH / 2 + 1.3 * s;

        // Col 0: م
        doc.setFont('IBMPlexSansArabic', 'bold');
        doc.setFontSize(8.8 * s);
        doc.setTextColor(20, 36, 61);
        doc.text(String(rowNum), colXs[0] + colWidths[0] / 2, midY, {
          align: 'center',
        });

        // Col 1: رقم المزاد (unbroken badge)
        doc.setFont('IBMPlexSansArabic', 'bold');
        doc.setFontSize(8.8 * s);
        doc.setTextColor(18, 59, 112);
        doc.text(auc.auctionNumber, colXs[1] + colWidths[1] / 2, midY, {
          align: 'center',
        });

        // Col 2: تاريخ المزاد (DD/MM/YYYY or غير محدد)
        const formattedDate = formatAuctionDateDisplay(auc.auctionDate, lang);
        if (auc.auctionDate) {
          doc.setFont('IBMPlexSansArabic', 'bold');
          doc.setFontSize(8.4 * s);
          doc.setTextColor(20, 36, 61);
          doc.text(formattedDate, colXs[2] + colWidths[2] / 2, midY, {
            align: 'center',
          });
        } else {
          doc.setFont('IBMPlexSansArabic', 'semibold');
          doc.setFontSize(8.0 * s);
          doc.setTextColor(100, 116, 139);
          drawSmartText(
            doc,
            formattedDate,
            colXs[2] + colWidths[2] / 2,
            midY,
            'center'
          );
        }

        // Col 3: مدة عرض المزاد (smart Arabic duration)
        doc.setFont('IBMPlexSansArabic', 'semibold');
        doc.setFontSize(8.4 * s);
        doc.setTextColor(20, 36, 61);
        drawSmartText(
          doc,
          isAr ? auc.durationAr : auc.durationEn,
          colXs[3] + colWidths[3] / 2,
          midY,
          'center'
        );

        // Col 4: المركبات المدرجة
        doc.setFont('IBMPlexSansArabic', 'bold');
        doc.setFontSize(9.2 * s);
        doc.setTextColor(20, 36, 61);
        doc.text(
          auc.listedVehicles.toLocaleString('en-US'),
          colXs[4] + colWidths[4] / 2,
          midY,
          { align: 'center' }
        );

        // Col 5: المركبات المبيعة
        doc.setTextColor(22, 132, 59);
        doc.text(
          auc.soldVehicles.toLocaleString('en-US'),
          colXs[5] + colWidths[5] / 2,
          midY,
          { align: 'center' }
        );

        // Col 6: غير المبيعة
        doc.setTextColor(197, 43, 54);
        doc.text(
          auc.unsoldVehicles.toLocaleString('en-US'),
          colXs[6] + colWidths[6] / 2,
          midY,
          { align: 'center' }
        );

        // Cols 7, 8, 9: Multi-line Notes, Challenges, Recommendations
        doc.setFont('IBMPlexSansArabic', 'semibold');
        doc.setFontSize(8.2 * s);
        doc.setTextColor(20, 36, 61);

        const drawMultiLineCell = (lines: string[], colIdx: number) => {
          const totalTextH = lines.length * lineH;
          const startLineY = tY + (rowH - totalTextH) / 2 + 3.2 * s;
          lines.forEach((ln, lIdx) => {
            drawSmartText(
              doc,
              ln,
              colXs[colIdx] + colWidths[colIdx] - 2.2 * s,
              startLineY + lIdx * lineH,
              'right'
            );
          });
        };

        drawMultiLineCell(notesLines, 7);
        drawMultiLineCell(challengesLines, 8);
        drawMultiLineCell(recsLines, 9);

        tY += rowH;
      });
    }

    // Grand Total Row on the final table page
    if (isLastChunk) {
      const spanRightW =
        colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3];
      const spanRightX = colXs[3];

      doc.setFillColor(18, 59, 112);
      doc.setDrawColor(18, 59, 112);
      doc.rect(spanRightX, tY, spanRightW, grandTotalRowH, 'FD');

      doc.setFont('IBMPlexSansArabic', 'bold');
      doc.setFontSize(9.5 * s);
      doc.setTextColor(255, 255, 255);
      drawSmartText(
        doc,
        isAr ? 'الإجمالي العام للشهر' : 'Monthly Grand Total',
        spanRightX + spanRightW / 2,
        tY + 6.8 * s,
        'center'
      );

      // Total Listed cell (#D6A348)
      doc.setFillColor(214, 163, 72);
      doc.setDrawColor(36, 82, 138);
      doc.rect(colXs[4], tY, colWidths[4], grandTotalRowH, 'FD');
      doc.setFont('IBMPlexSansArabic', 'bold');
      doc.setFontSize(10 * s);
      doc.setTextColor(20, 36, 61);
      doc.text(
        metrics.totalListed.toLocaleString('en-US'),
        colXs[4] + colWidths[4] / 2,
        tY + 6.8 * s,
        { align: 'center' }
      );

      // Total Sold cell (#E5BA63)
      doc.setFillColor(229, 186, 99);
      doc.rect(colXs[5], tY, colWidths[5], grandTotalRowH, 'FD');
      doc.text(
        metrics.totalSold.toLocaleString('en-US'),
        colXs[5] + colWidths[5] / 2,
        tY + 6.8 * s,
        { align: 'center' }
      );

      // Total Unsold cell (#D6A348)
      doc.setFillColor(214, 163, 72);
      doc.rect(colXs[6], tY, colWidths[6], grandTotalRowH, 'FD');
      doc.text(
        metrics.totalUnsold.toLocaleString('en-US'),
        colXs[6] + colWidths[6] / 2,
        tY + 6.8 * s,
        { align: 'center' }
      );

      // Summary Sale Rate & Unsold Rate span across cols 7..9
      const spanLeftW = colWidths[7] + colWidths[8] + colWidths[9];
      const spanLeftX = colXs[9];
      doc.setFillColor(18, 59, 112);
      doc.setDrawColor(18, 59, 112);
      doc.rect(spanLeftX, tY, spanLeftW, grandTotalRowH, 'FD');

      doc.setFont('IBMPlexSansArabic', 'bold');
      doc.setFontSize(8.8 * s);
      const midSpanX = spanLeftX + spanLeftW / 2;

      // Right half of span: Overall Sale Rate
      doc.setTextColor(255, 255, 255);
      const saleLabel = isAr ? 'نسبة البيع الإجمالية' : 'Overall Sale Rate:';
      drawSmartText(
        doc,
        saleLabel,
        spanLeftX + spanLeftW - 8 * s,
        tY + 6.8 * s,
        'right'
      );
      const saleLabelW = doc.getTextWidth(normalizeArabicForPdf(saleLabel));
      doc.setTextColor(134, 239, 172); // #86EFAC
      doc.text(
        `${metrics.overallSaleRate.toFixed(1)}%`,
        spanLeftX + spanLeftW - 8 * s - saleLabelW - 2.5 * s,
        tY + 6.8 * s,
        { align: 'right' }
      );

      // Divider pipe
      doc.setTextColor(148, 163, 184);
      doc.text('|', midSpanX, tY + 6.8 * s, { align: 'center' });

      // Left half of span: Unsold Rate
      doc.setTextColor(255, 255, 255);
      const unsoldLabel = isAr ? 'نسبة عدم البيع' : 'Unsold Rate:';
      drawSmartText(
        doc,
        unsoldLabel,
        midSpanX - 6 * s,
        tY + 6.8 * s,
        'right'
      );
      const unsoldLabelW = doc.getTextWidth(normalizeArabicForPdf(unsoldLabel));
      doc.setTextColor(252, 165, 165); // #FCA5A5
      doc.text(
        `${metrics.overallUnsoldRate.toFixed(1)}%`,
        midSpanX - 6 * s - unsoldLabelW - 2.5 * s,
        tY + 6.8 * s,
        { align: 'right' }
      );
    }
  });

  /* =========================================================================
     PAGE 4+: COMPARATIVE ANALYSIS TABLE & 3 OPERATIONAL INSIGHTS CARDS
     ========================================================================= */
  const hasLongOpsText = auctions.some(
    (a) =>
      (a.notesAr?.length || 0) > 100 ||
      (a.challengesAr?.length || 0) > 100 ||
      (a.recommendationsAr?.length || 0) > 100
  );
  const splitOpsToDedicatedPages = auctions.length > 5 || hasLongOpsText;

  const compRowsPerPage = 10;
  const compChunks: AuctionRecord[][] = [];
  if (auctions.length === 0) {
    compChunks.push([]);
  } else {
    for (let i = 0; i < auctions.length; i += compRowsPerPage) {
      compChunks.push(auctions.slice(i, i + compRowsPerPage));
    }
  }

  const drawOperationalCardsGrid = (
    itemsBatch: AuctionRecord[],
    startY: number,
    availH: number
  ) => {
    const gap = 3.5 * s;
    const cardW = (contentW - gap * 2) / 3;

    // RTL order: Right = Notes, Center = Challenges, Left = Recommendations
    const cardsConfig: Array<{
      x: number;
      titleAr: string;
      titleEn: string;
      headerRgb: [number, number, number];
      imgDataUrl: string | null;
      badgeBg: [number, number, number];
      badgeBorder: [number, number, number];
      badgeText: [number, number, number];
      getText: (a: AuctionRecord) => string;
    }> = [
      {
        x: margin + (cardW + gap) * 2,
        titleAr: 'أبرز الملاحظات التشغيلية',
        titleEn: 'Key Operational Notes',
        headerRgb: [23, 90, 156],
        imgDataUrl: assets.opsNotesDataUrl,
        badgeBg: [240, 245, 250],
        badgeBorder: [203, 213, 225],
        badgeText: [23, 90, 156],
        getText: (a) => (isAr ? a.notesAr : a.notesEn),
      },
      {
        x: margin + (cardW + gap) * 1,
        titleAr: 'التحديات التشغيلية الرئيسية',
        titleEn: 'Operational Challenges',
        headerRgb: [18, 59, 112],
        imgDataUrl: assets.opsChallengesDataUrl,
        badgeBg: [254, 243, 242],
        badgeBorder: [254, 205, 202],
        badgeText: [197, 43, 54],
        getText: (a) => (isAr ? a.challengesAr : a.challengesEn),
      },
      {
        x: margin,
        titleAr: 'التوصيات والإجراءات التحسينية',
        titleEn: 'Recommendations & Actions',
        headerRgb: [36, 103, 178],
        imgDataUrl: assets.opsRecommendationsDataUrl,
        badgeBg: [236, 253, 243],
        badgeBorder: [171, 239, 198],
        badgeText: [22, 132, 59],
        getText: (a) => (isAr ? a.recommendationsAr : a.recommendationsEn),
      },
    ];

    cardsConfig.forEach((cfg) => {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.3);
      doc.roundedRect(cfg.x, startY, cardW, availH, 2.2 * s, 2.2 * s, 'FD');

      const hdrH = 8.8 * s;
      doc.setFillColor(cfg.headerRgb[0], cfg.headerRgb[1], cfg.headerRgb[2]);
      doc.roundedRect(cfg.x, startY, cardW, hdrH, 2.2 * s, 2.2 * s, 'F');
      doc.rect(cfg.x, startY + hdrH - 2.2 * s, cardW, 2.2 * s, 'F');

      // Thumbnail photo on left side of card header
      if (cfg.imgDataUrl) {
        const thumbW = 10.5 * s;
        const thumbH = 6 * s;
        doc.addImage(
          cfg.imgDataUrl,
          'JPEG',
          cfg.x + 2.8 * s,
          startY + (hdrH - thumbH) / 2,
          thumbW,
          thumbH,
          undefined,
          'FAST'
        );
      }

      doc.setFillColor(214, 163, 72);
      doc.circle(cfg.x + cardW - 4 * s, startY + hdrH / 2, 1.2 * s, 'F');

      doc.setFont('IBMPlexSansArabic', 'bold');
      doc.setFontSize(9.2 * s);
      doc.setTextColor(255, 255, 255);
      drawSmartText(
        doc,
        isAr ? cfg.titleAr : cfg.titleEn,
        cfg.x + cardW - 7.2 * s,
        startY + 5.9 * s,
        'right'
      );

      let itemY = startY + hdrH + 3.5 * s;
      const badgeW = 15.5 * s;
      const textMaxW = cardW - badgeW - 9.5 * s;
      const itemLineH = 4.1 * s;

      itemsBatch.forEach((auc, idx) => {
        doc.setFont('IBMPlexSansArabic', 'semibold');
        doc.setFontSize(8 * s);
        const wrapped = wrapTextToLines(doc, cfg.getText(auc), textMaxW);
        const blockH = Math.max(6.2 * s, wrapped.length * itemLineH + 2.2 * s);

        if (itemY + blockH > startY + availH - 1.5 * s) return;

        if (idx > 0) {
          doc.setDrawColor(241, 245, 249);
          doc.setLineWidth(0.2);
          doc.line(
            cfg.x + 3 * s,
            itemY - 1.2 * s,
            cfg.x + cardW - 3 * s,
            itemY - 1.2 * s
          );
        }

        // Vector RTL bullet dot on the right + wrapped Arabic text to its left
        doc.setFillColor(cfg.headerRgb[0], cfg.headerRgb[1], cfg.headerRgb[2]);
        doc.circle(cfg.x + cardW - 3.8 * s, itemY + 2.3 * s, 0.75 * s, 'F');

        doc.setFont('IBMPlexSansArabic', 'semibold');
        doc.setFontSize(8 * s);
        doc.setTextColor(20, 36, 61);
        wrapped.forEach((ln, lIdx) => {
          drawSmartText(
            doc,
            ln,
            cfg.x + cardW - 6 * s,
            itemY + 3.4 * s + lIdx * itemLineH,
            'right'
          );
        });

        // Unbroken Auction ID badge on left
        const bX = cfg.x + 3 * s;
        const bY = itemY + 0.4 * s;
        const bH = 4.6 * s;
        doc.setFillColor(cfg.badgeBg[0], cfg.badgeBg[1], cfg.badgeBg[2]);
        doc.setDrawColor(
          cfg.badgeBorder[0],
          cfg.badgeBorder[1],
          cfg.badgeBorder[2]
        );
        doc.roundedRect(bX, bY, badgeW, bH, 1 * s, 1 * s, 'FD');

        doc.setFont('IBMPlexSansArabic', 'bold');
        doc.setFontSize(7.2 * s);
        doc.setTextColor(cfg.badgeText[0], cfg.badgeText[1], cfg.badgeText[2]);
        doc.text(auc.auctionNumber, bX + badgeW / 2, bY + 3.3 * s, {
          align: 'center',
        });

        itemY += blockH + 1.2 * s;
      });
    });
  };

  // Render Comparative Analysis Table Page(s)
  compChunks.forEach((compChunk, cIdx) => {
    doc.addPage(paperSize, 'landscape');
    paintPageBackground();
    const pIdx = doc.getNumberOfPages();

    const titleAr = splitOpsToDedicatedPages
      ? compChunks.length > 1
        ? `التحليل المقارن لأداء المزادات — الجزء ${cIdx + 1} من ${compChunks.length}`
        : 'التحليل المقارن لأداء المزادات'
      : 'التحليل المقارن والملاحظات والتحديات والتوصيات التنفيذية';

    const titleEn = splitOpsToDedicatedPages
      ? compChunks.length > 1
        ? `Comparative Auction Performance Analysis (${cIdx + 1} of ${compChunks.length})`
        : 'Comparative Auction Performance Analysis'
      : 'Comparative Analysis & Executive Operational Insights';

    let yPos = renderCompactHeader(pIdx, titleAr, titleEn) + 3.5 * s;

    // Comparative Table Card
    const compHeaderBarH = 8 * s;
    const compColHeaderH = 8 * s;
    const compRowH = 7.4 * s;
    const compRowsCount = Math.max(1, compChunk.length);
    const compCardH =
      compHeaderBarH + compColHeaderH + compRowsCount * compRowH;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, yPos, contentW, compCardH, 2.2 * s, 2.2 * s, 'FD');

    // Card Title Bar
    doc.setFillColor(18, 59, 112);
    doc.roundedRect(
      margin,
      yPos,
      contentW,
      compHeaderBarH,
      2.2 * s,
      2.2 * s,
      'F'
    );
    doc.rect(
      margin,
      yPos + compHeaderBarH - 2.2 * s,
      contentW,
      2.2 * s,
      'F'
    );
    doc.setFont('IBMPlexSansArabic', 'bold');
    doc.setFontSize(9.5 * s);
    doc.setTextColor(255, 255, 255);
    drawSmartText(
      doc,
      isAr
        ? 'جدول التحليل المقارن لأداء المزادات'
        : 'Comparative Auction Performance Table',
      margin + contentW - 4.5 * s,
      yPos + 5.5 * s,
      'right'
    );

    yPos += compHeaderBarH;

    // 8 Comparative Columns (RTL):
    // رقم المزاد | تاريخ المزاد | المركبات المدرجة | المركبات المبيعة | المركبات غير المبيعة | نسبة البيع | نسبة عدم البيع | تقييم الأداء
    const compFracs = [0.115, 0.115, 0.125, 0.125, 0.125, 0.115, 0.12, 0.16];
    const compWidths = compFracs.map((f) => f * contentW);
    const compXs: number[] = [];
    let curR = margin + contentW;
    for (let c = 0; c < compWidths.length; c++) {
      curR -= compWidths[c];
      compXs.push(curR);
    }

    const compHeadersAr = [
      'رقم المزاد',
      'تاريخ المزاد',
      'المركبات المدرجة',
      'المركبات المبيعة',
      'المركبات غير المبيعة',
      'نسبة البيع',
      'نسبة عدم البيع',
      'تقييم الأداء',
    ];
    const compHeadersEn = [
      'Auction ID',
      'Auction Date',
      'Listed Vehicles',
      'Sold Vehicles',
      'Unsold Vehicles',
      'Sale Rate',
      'Unsold Rate',
      'Performance Rating',
    ];

    for (let c = 0; c < compWidths.length; c++) {
      doc.setFillColor(15, 47, 90);
      doc.setDrawColor(36, 82, 138);
      doc.setLineWidth(0.25);
      doc.rect(compXs[c], yPos, compWidths[c], compColHeaderH, 'FD');
      doc.setFont('IBMPlexSansArabic', 'bold');
      doc.setFontSize(8.1 * s);
      doc.setTextColor(255, 255, 255);
      drawSmartText(
        doc,
        isAr ? compHeadersAr[c] : compHeadersEn[c],
        compXs[c] + compWidths[c] / 2,
        yPos + 5.4 * s,
        'center'
      );
    }
    yPos += compColHeaderH;

    if (compChunk.length === 0) {
      doc.setFont('IBMPlexSansArabic', 'bold');
      doc.setFontSize(9 * s);
      doc.setTextColor(100, 116, 139);
      drawSmartText(
        doc,
        isAr
          ? `لا توجد بيانات مقارنة لشهر ${monthNameAr} ${selectedPeriod.year}`
          : `No comparative data for ${monthNameEn} ${selectedPeriod.year}`,
        margin + contentW / 2,
        yPos + 5 * s,
        'center'
      );
      yPos += compRowH;
    } else {
      compChunk.forEach((auc, idx) => {
        const isEven = idx % 2 === 0;
        for (let c = 0; c < compWidths.length; c++) {
          doc.setFillColor(
            isEven ? 255 : 248,
            isEven ? 255 : 250,
            isEven ? 255 : 252
          );
          doc.setDrawColor(203, 213, 225);
          doc.setLineWidth(0.22);
          doc.rect(compXs[c], yPos, compWidths[c], compRowH, 'FD');
        }

        const midY = yPos + 5 * s;

        doc.setFont('IBMPlexSansArabic', 'bold');
        doc.setFontSize(8.5 * s);
        doc.setTextColor(18, 59, 112);
        doc.text(auc.auctionNumber, compXs[0] + compWidths[0] / 2, midY, {
          align: 'center',
        });

        // Col 1: تاريخ المزاد
        const compFormattedDate = formatAuctionDateDisplay(auc.auctionDate, lang);
        if (auc.auctionDate) {
          doc.setFont('IBMPlexSansArabic', 'bold');
          doc.setFontSize(8.3 * s);
          doc.setTextColor(20, 36, 61);
          doc.text(compFormattedDate, compXs[1] + compWidths[1] / 2, midY, {
            align: 'center',
          });
        } else {
          doc.setFont('IBMPlexSansArabic', 'semibold');
          doc.setFontSize(7.8 * s);
          doc.setTextColor(100, 116, 139);
          drawSmartText(
            doc,
            compFormattedDate,
            compXs[1] + compWidths[1] / 2,
            midY,
            'center'
          );
        }

        doc.setFont('IBMPlexSansArabic', 'bold');
        doc.setFontSize(8.5 * s);
        doc.setTextColor(20, 36, 61);
        doc.text(
          auc.listedVehicles.toLocaleString('en-US'),
          compXs[2] + compWidths[2] / 2,
          midY,
          { align: 'center' }
        );

        doc.setTextColor(22, 132, 59);
        doc.text(
          auc.soldVehicles.toLocaleString('en-US'),
          compXs[3] + compWidths[3] / 2,
          midY,
          { align: 'center' }
        );

        doc.setTextColor(197, 43, 54);
        doc.text(
          auc.unsoldVehicles.toLocaleString('en-US'),
          compXs[4] + compWidths[4] / 2,
          midY,
          { align: 'center' }
        );

        doc.setTextColor(22, 132, 59);
        doc.text(
          `${auc.saleRate.toFixed(1)}%`,
          compXs[5] + compWidths[5] / 2,
          midY,
          { align: 'center' }
        );

        doc.setTextColor(100, 116, 139);
        doc.text(
          `${auc.unsoldRate.toFixed(1)}%`,
          compXs[6] + compWidths[6] / 2,
          midY,
          { align: 'center' }
        );

        // Performance evaluation badge
        const badge = evaluateAuctionPerformance(
          auc.saleRate,
          thresholds,
          lang
        );
        const pillW = compWidths[7] - 8 * s;
        const pillH = 5.2 * s;
        const pillX = compXs[7] + 4 * s;
        const pillY = yPos + (compRowH - pillH) / 2;

        if (auc.saleRate >= thresholds.excellentMin) {
          doc.setFillColor(220, 252, 231);
          doc.setDrawColor(134, 239, 172);
          doc.setTextColor(21, 128, 61);
        } else if (auc.saleRate >= thresholds.goodMin) {
          doc.setFillColor(236, 253, 243);
          doc.setDrawColor(171, 239, 198);
          doc.setTextColor(22, 132, 59);
        } else {
          doc.setFillColor(254, 243, 199);
          doc.setDrawColor(253, 224, 71);
          doc.setTextColor(180, 83, 9);
        }

        doc.roundedRect(pillX, pillY, pillW, pillH, 2.2 * s, 2.2 * s, 'FD');
        doc.setFont('IBMPlexSansArabic', 'bold');
        doc.setFontSize(7.8 * s);
        drawSmartText(
          doc,
          badge.label,
          compXs[7] + compWidths[7] / 2,
          pillY + 3.7 * s,
          'center'
        );

        yPos += compRowH;
      });
    }

    // If compact (<= 5 auctions and normal text), draw the 3 Operational Cards right below on Page 4
    if (!splitOpsToDedicatedPages && cIdx === 0) {
      yPos += 3.5 * s;
      const remH = footerTopY - yPos - 2.5 * s;
      drawOperationalCardsGrid(auctions, yPos, remH);
    }
  });

  // If > 5 auctions or long texts, render dedicated page(s) for the 3 Operational Insights Cards
  if (splitOpsToDedicatedPages) {
    const opsPerPage = hasLongOpsText ? 5 : 7;
    const opsBatches: AuctionRecord[][] = [];
    for (let i = 0; i < auctions.length; i += opsPerPage) {
      opsBatches.push(auctions.slice(i, i + opsPerPage));
    }

    opsBatches.forEach((opsBatch, oIdx) => {
      doc.addPage(paperSize, 'landscape');
      paintPageBackground();
      const pIdx = doc.getNumberOfPages();

      const secAr =
        opsBatches.length > 1
          ? `الملاحظات والتحديات والتوصيات التشغيلية — الجزء ${oIdx + 1} من ${opsBatches.length}`
          : 'الملاحظات والتحديات والتوصيات التشغيلية';
      const secEn =
        opsBatches.length > 1
          ? `Operational Notes, Challenges & Recommendations (${oIdx + 1} of ${opsBatches.length})`
          : 'Operational Notes, Challenges & Recommendations';

      const startY = renderCompactHeader(pIdx, secAr, secEn) + 3.5 * s;
      const availH = footerTopY - startY - 2.5 * s;
      drawOperationalCardsGrid(opsBatch, startY, availH);
    });
  }

  /* =========================================================================
     SECOND PASS: STAMP UNIFIED FOOTER & "صفحة X من Y" ON ALL PAGES (Section 6)
     ========================================================================= */
  const totalPages = doc.getNumberOfPages();

  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    const pageBadgeText = isAr
      ? `صفحة ${p} من ${totalPages}`
      : `Page ${p} of ${totalPages}`;

    // 1. Stamp Header Page Badge
    const hdrBadge = pageHeaderBadgeCoords.find((b) => b.pageIndex === p);
    if (hdrBadge) {
      doc.setFillColor(
        hdrBadge.bgRgb[0],
        hdrBadge.bgRgb[1],
        hdrBadge.bgRgb[2]
      );
      doc.roundedRect(
        hdrBadge.x,
        hdrBadge.y,
        hdrBadge.w,
        hdrBadge.h,
        1.2 * s,
        1.2 * s,
        'F'
      );
      doc.setFont('IBMPlexSansArabic', 'bold');
      doc.setFontSize(8 * s);
      doc.setTextColor(255, 255, 255);
      drawSmartText(
        doc,
        pageBadgeText,
        hdrBadge.x + hdrBadge.w / 2,
        hdrBadge.y + 3.8 * s,
        'center'
      );
    }

    // 2. Stamp Official Corporate Footer
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(margin, footerTopY, margin + contentW, footerTopY);

    // Gold dot + Right company title
    doc.setFillColor(214, 163, 72);
    doc.circle(
      margin + contentW - 1.8 * s,
      footerTopY + 4.8 * s,
      1.1 * s,
      'F'
    );

    doc.setFont('IBMPlexSansArabic', 'bold');
    doc.setFontSize(8.2 * s);
    doc.setTextColor(18, 59, 112);
    drawSmartText(
      doc,
      isAr
        ? 'شركة ساعد للأنظمة المرورية — نظام التقرير التنفيذي لمزادات المركبات'
        : 'SAAED Traffic Systems — Vehicle Auction Executive Reporting System',
      margin + contentW - 4.5 * s,
      footerTopY + 5.8 * s,
      'right'
    );

    // Center Period & Date
    doc.setFont('IBMPlexSansArabic', 'semibold');
    doc.setFontSize(7.8 * s);
    doc.setTextColor(100, 116, 139);
    drawSmartText(
      doc,
      isAr
        ? `تقرير مزادات شهر ${monthNameAr} ${selectedPeriod.year} | تاريخ الإعداد: ${metadata.reportDate}`
        : `${monthNameEn} ${selectedPeriod.year} Auction Report | Prepared: ${metadata.reportDate}`,
      margin + contentW * 0.48,
      footerTopY + 5.8 * s,
      'center'
    );

    // Left Page Number Badge ("صفحة X من Y")
    const fBadgeW = 25 * s;
    const fBadgeH = 5.6 * s;
    const fBadgeX = margin;
    const fBadgeY = footerTopY + 2 * s;
    doc.setFillColor(18, 59, 112);
    doc.roundedRect(fBadgeX, fBadgeY, fBadgeW, fBadgeH, 1.3 * s, 1.3 * s, 'F');

    doc.setFont('IBMPlexSansArabic', 'bold');
    doc.setFontSize(8.2 * s);
    doc.setTextColor(255, 255, 255);
    drawSmartText(
      doc,
      pageBadgeText,
      fBadgeX + fBadgeW / 2,
      fBadgeY + 4 * s,
      'center'
    );

    // Designer & Author Credit (إعداد وتصميم: خالد الهاشمي)
    const authorCreditStr = isAr
      ? 'إعداد وتصميم: خالد الهاشمي'
      : 'Prepared & Designed by: Khalid Al Hashemi';
    doc.setFillColor(214, 163, 72);
    doc.circle(
      fBadgeX + fBadgeW + 4 * s,
      footerTopY + 4.8 * s,
      0.9 * s,
      'F'
    );
    doc.setFont('IBMPlexSansArabic', 'bold');
    doc.setFontSize(8 * s);
    doc.setTextColor(18, 59, 112);
    drawSmartText(
      doc,
      authorCreditStr,
      fBadgeX + fBadgeW + 6.2 * s,
      footerTopY + 5.8 * s,
      'left'
    );
  }

  return doc;
}

/**
 * Generates and downloads a multi-page vector & true-text PDF report directly
 * (`SAAED_Auction_Report_YYYY_MM.pdf`).
 */
export async function exportExecutivePdfReport(
  params: ExecutivePdfBuildParams
): Promise<string> {
  let currentStage: PdfExportStage = 'STAGE_1_DATA_VALIDATION';

  try {
    const { selectedPeriod } = params;
    if (!selectedPeriod || !selectedPeriod.year || !selectedPeriod.month) {
      throw new Error('Invalid reporting period provided for PDF export.');
    }

    const paddedMonth = String(selectedPeriod.month).padStart(2, '0');
    const fileName = `SAAED_Auction_Report_${selectedPeriod.year}_${paddedMonth}.pdf`;

    params.onProgress?.('preparing');
    if (typeof document !== 'undefined') {
      currentStage = 'STAGE_2_DOM_MOUNT_AND_HEADER_VERIFY';
      const printMount = document.getElementById('saaed-official-print-mount');
      if (printMount) {
        verifyReportHeaderDomIntegrity(printMount);
      }
    }

    currentStage = 'STAGE_3_FONTS_AND_IMAGES';
    await getLoadedReportAssets();

    currentStage = 'STAGE_6_PDF_ASSEMBLY';
    params.onProgress?.('building');
    const pdf = await buildExecutivePdfDocument(params);

    currentStage = 'STAGE_7_FILE_DOWNLOAD';
    params.onProgress?.('downloading');
    try {
      pdf.save(fileName);
    } catch {
      if (typeof document !== 'undefined') {
        const blob = pdf.output('blob');
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }
    }

    return fileName;
  } catch (error: unknown) {
    console.error('PDF_EXPORT_FAILED', {
      stage: currentStage,
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}
