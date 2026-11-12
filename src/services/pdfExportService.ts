import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Language, ReportingPeriod, ReportMetadata } from '../types/auction';
import { PaperSizeOption } from '../components/ExecutiveAuctionPrintReport';

export type PdfExportStage =
  | 'STAGE_1_DATA_VALIDATION'
  | 'STAGE_2_DOM_MOUNT'
  | 'STAGE_3_FONTS_AND_IMAGES'
  | 'STAGE_4_STYLE_SANITIZATION'
  | 'STAGE_5_CANVAS_RENDER'
  | 'STAGE_6_PDF_ASSEMBLY'
  | 'STAGE_7_FILE_DOWNLOAD';

let colorConverterCtx: CanvasRenderingContext2D | null = null;

function getColorConverterCtx(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  if (!colorConverterCtx) {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    colorConverterCtx = canvas.getContext('2d', { willReadFrequently: true });
  }
  return colorConverterCtx;
}

/**
 * Converts a single modern CSS color function (oklch, oklab, color-mix, lab, lch, color)
 * into a standard rgba(r, g, b, a) or #hex string that html2canvas 1.4.1 can parse.
 */
function singleColorTokenToRgb(token: string): string {
  const ctx = getColorConverterCtx();
  if (!ctx) return '#14243D';
  try {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000000';
    ctx.fillStyle = token;
    const normalized = ctx.fillStyle;
    // If browser already serialized to #hex or rgb/rgba, return directly
    if (
      normalized.startsWith('#') ||
      normalized.startsWith('rgb(') ||
      normalized.startsWith('rgba(')
    ) {
      return normalized;
    }
    // Otherwise sample the 1x1 pixel from canvas
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    if (a === 0) return 'rgba(0, 0, 0, 0)';
    if (a === 255) return `rgb(${r}, ${g}, ${b})`;
    return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
  } catch {
    return '#14243D';
  }
}

/**
 * Sanitizes any CSS property value string by:
 * 1. Stripping Tailwind v4 gradient interpolation tokens like `in oklab`, `in oklch`, `in srgb`.
 * 2. Replacing all `oklch(...)`, `oklab(...)`, `color-mix(...)`, `lab(...)`, `lch(...)`, `color(...)`
 *    calls with standard `rgb(...)` / `rgba(...)` values.
 */
export function sanitizeCssValueForHtml2Canvas(value: string): string {
  if (!value || typeof value !== 'string') return value;
  if (
    !value.includes('oklch') &&
    !value.includes('oklab') &&
    !value.includes('color-mix') &&
    !value.includes('lab(') &&
    !value.includes('lch(') &&
    !value.includes('color(')
  ) {
    return value;
  }

  // 1. Remove gradient color-space interpolation tokens (e.g. "linear-gradient(to right in oklab, ...)")
  let cleaned = value.replace(
    /\s+in\s+(?:oklab|oklch|srgb|srgb-linear|display-p3|hsl|hwb|lab|lch)(?:\s+(?:shorter|longer|increasing|decreasing)\s+hue)?/gi,
    ''
  );

  // 2. Replace nested color-mix(...) first if present
  cleaned = cleaned.replace(
    /color-mix\([^()]*(?:\([^()]*\)[^()]*)*\)/gi,
    (match) => singleColorTokenToRgb(match)
  );

  // 3. Replace oklch(...), oklab(...), lab(...), lch(...), color(...)
  cleaned = cleaned.replace(
    /(?:oklch|oklab|lab|lch|color)\([^()]+\)/gi,
    (match) => singleColorTokenToRgb(match)
  );

  return cleaned;
}

/**
 * Walks the cloned DOM subtree inside html2canvas `onclone` and converts all modern
 * CSS color functions on every element and pseudo-state into standard RGB/HEX inline styles.
 * This completely eliminates html2canvas 1.4.1's `Attempting to parse an unsupported color function "oklch"` crash.
 */
function sanitizeClonedDomForHtml2Canvas(
  clonedDoc: Document,
  clonedPageEl: HTMLElement
): void {
  // 1. Ensure the cloned print mount container is positioned at (0,0) in the cloned document
  const clonedMount = clonedDoc.getElementById('saaed-official-print-mount');
  if (clonedMount) {
    clonedMount.style.position = 'static';
    clonedMount.style.left = '0px';
    clonedMount.style.top = '0px';
    clonedMount.style.zIndex = '1';
    clonedMount.style.opacity = '1';
    clonedMount.style.visibility = 'visible';
    clonedMount.style.transform = 'none';
  }

  // 2. Also sanitize all <style> tags inside clonedDoc so html2canvas's stylesheet parser never sees oklch/oklab
  const styleElements = Array.from(clonedDoc.querySelectorAll('style'));
  for (const styleEl of styleElements) {
    if (styleEl.textContent) {
      styleEl.textContent = sanitizeCssValueForHtml2Canvas(styleEl.textContent);
    }
  }

  // 3. Walk every element inside clonedPageEl and its ancestors and enforce RGB inline styles
  const win = clonedDoc.defaultView || window;
  const allElements: HTMLElement[] = [
    clonedDoc.documentElement,
    clonedDoc.body,
    ...(clonedMount ? [clonedMount] : []),
    clonedPageEl,
    ...(Array.from(clonedPageEl.querySelectorAll('*')) as HTMLElement[]),
  ];

  const colorProperties: (keyof CSSStyleDeclaration)[] = [
    'color',
    'backgroundColor',
    'backgroundImage',
    'borderTopColor',
    'borderRightColor',
    'borderBottomColor',
    'borderLeftColor',
    'outlineColor',
    'textDecorationColor',
    'boxShadow',
    'fill',
    'stroke',
  ];

  for (const el of allElements) {
    if (!el || !el.style) continue;
    const computed = win.getComputedStyle(el);
    for (const prop of colorProperties) {
      const val = computed[prop];
      if (
        typeof val === 'string' &&
        (val.includes('oklch') ||
          val.includes('oklab') ||
          val.includes('color-mix') ||
          val.includes('lab(') ||
          val.includes('lch(') ||
          val.includes('color('))
      ) {
        try {
          (el.style as unknown as Record<string, string>)[prop as string] =
            sanitizeCssValueForHtml2Canvas(val);
        } catch {
          // Ignore read-only style properties
        }
      }
    }
  }
}

/**
 * Waits for web fonts (`document.fonts.ready`) and decodes all images (`img.decode()`)
 * inside a report container before printing or capturing.
 */
export async function waitForReportAssets(container: HTMLElement): Promise<void> {
  // 1. Wait for web fonts (Cairo, Plus Jakarta Sans)
  if (typeof document !== 'undefined' && 'fonts' in document) {
    try {
      await document.fonts.ready;
    } catch {
      // Ignore font API errors
    }
  }

  // 2. Wait for all images inside the container to finish loading & decoding
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
        // Continue even if a fallback image was triggered
      }
    })
  );

  // Allow browser layout & SVG charts to settle across two animation frames
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  );
}

/**
 * Triggers native browser printing exclusively for the official report template
 * (`#saaed-official-print-mount`) using a dedicated same-origin print iframe
 * (with automatic fallback to main window print) so the interactive app UI is never printed.
 */
export async function triggerOfficialReportPrint(
  paperSize: PaperSizeOption = 'a4'
): Promise<void> {
  const printMount = document.getElementById('saaed-official-print-mount');
  if (!printMount) {
    window.print();
    return;
  }

  await waitForReportAssets(printMount);

  const sizeValue = paperSize === 'a3' ? 'A3 landscape' : 'A4 landscape';

  // Update main document @page rule
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

  // Create or reuse a dedicated hidden print iframe so printing works cleanly
  // even inside sandboxed preview containers and only prints the official report pages
  const iframeId = 'saaed-dedicated-print-iframe';
  let printIframe = document.getElementById(iframeId) as HTMLIFrameElement | null;
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

  // Collect all <link rel="stylesheet"> and <style> elements from main document
  const headLinksAndStyles = Array.from(
    document.head.querySelectorAll('link[rel="stylesheet"], style')
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
      font-family: 'Cairo', 'Plus Jakarta Sans', sans-serif !important;
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

  await waitForReportAssets(iframeDoc.body);

  try {
    printIframe.contentWindow.focus();
    printIframe.contentWindow.print();
  } catch {
    window.print();
  }
}

/**
 * Generates and downloads a multi-page high-resolution PDF directly from the
 * unified ExecutiveAuctionPrintReport pages (`#saaed-official-print-mount`).
 */
export async function exportExecutivePdfReport(params: {
  metadata: ReportMetadata;
  selectedPeriod: ReportingPeriod;
  lang: Language;
  paperSize?: PaperSizeOption;
}): Promise<string> {
  let currentStage: PdfExportStage = 'STAGE_1_DATA_VALIDATION';

  try {
    const { selectedPeriod, paperSize = 'a4' } = params;
    if (!selectedPeriod || !selectedPeriod.year || !selectedPeriod.month) {
      throw new Error('Invalid reporting period provided for PDF export.');
    }

    const paddedMonth = String(selectedPeriod.month).padStart(2, '0');
    const fileName = `SAAED_Auction_Report_${selectedPeriod.year}_${paddedMonth}.pdf`;

    currentStage = 'STAGE_2_DOM_MOUNT';
    const printMount = document.getElementById('saaed-official-print-mount');
    if (!printMount) {
      throw new Error('Official report container (#saaed-official-print-mount) not found in DOM.');
    }

    currentStage = 'STAGE_3_FONTS_AND_IMAGES';
    await waitForReportAssets(printMount);

    const pageNodes = Array.from(
      printMount.querySelectorAll('.official-report-page')
    ) as HTMLElement[];

    if (pageNodes.length === 0) {
      throw new Error('No official report pages (.official-report-page) found to export.');
    }

    currentStage = 'STAGE_6_PDF_ASSEMBLY';
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: paperSize,
      compress: true,
    });

    const pdfPageWidth = pdf.internal.pageSize.getWidth(); // 297 for A4, 420 for A3
    const pdfPageHeight = pdf.internal.pageSize.getHeight(); // 210 for A4, 297 for A3

    for (let i = 0; i < pageNodes.length; i++) {
      const pageEl = pageNodes[i];
      if (i > 0) {
        pdf.addPage(paperSize, 'landscape');
      }

      const targetW = pageEl.offsetWidth || (paperSize === 'a3' ? 1587 : 1122);
      const targetH = pageEl.offsetHeight || (paperSize === 'a3' ? 1122 : 794);

      currentStage = 'STAGE_5_CANVAS_RENDER';
      const canvas = await html2canvas(pageEl, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#F4F7FB',
        logging: false,
        width: targetW,
        height: targetH,
        windowWidth: targetW + 40,
        windowHeight: targetH + 40,
        scrollX: 0,
        scrollY: 0,
        x: 0,
        y: 0,
        onclone: (clonedDoc, clonedElement) => {
          currentStage = 'STAGE_4_STYLE_SANITIZATION';
          sanitizeClonedDomForHtml2Canvas(clonedDoc, clonedElement);
        },
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);

      currentStage = 'STAGE_6_PDF_ASSEMBLY';
      pdf.addImage(
        imgData,
        'JPEG',
        0,
        0,
        pdfPageWidth,
        pdfPageHeight,
        undefined,
        'FAST'
      );
    }

    currentStage = 'STAGE_7_FILE_DOWNLOAD';
    try {
      pdf.save(fileName);
    } catch {
      // Fallback blob download for sandboxed environments
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
