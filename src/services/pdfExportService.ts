import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Language, ReportMetadata } from '../types/auction';

export async function exportExecutivePdfReport(params: {
  metadata: ReportMetadata;
  lang: Language;
}): Promise<void> {
  const { metadata, lang } = params;
  const isAr = lang === 'ar';

  const sheet1El = document.getElementById('sheet1-report-container');
  const sheet2El = document.getElementById('sheet2-dashboard-container');

  // Create landscape A4 PDF document (297mm x 210mm)
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = pdf.internal.pageSize.getWidth(); // 297
  const pageHeight = pdf.internal.pageSize.getHeight(); // 210
  const margin = 8;
  const usableWidth = pageWidth - margin * 2;
  const usableHeight = pageHeight - margin * 2 - 7; // Leave 7mm footer for page numbers and date

  const elementsToRender: HTMLElement[] = [];
  if (sheet1El) elementsToRender.push(sheet1El);
  if (sheet2El) elementsToRender.push(sheet2El);

  for (let i = 0; i < elementsToRender.length; i++) {
    const el = elementsToRender[i];
    if (i > 0) {
      pdf.addPage('a4', 'landscape');
    }

    const canvas = await html2canvas(el, {
      scale: 2.2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#F4F7FB',
      ignoreElements: (node) => node.classList?.contains('no-print') || false,
    });

    const imgData = canvas.toDataURL('image/png', 1.0);
    const imgRatio = canvas.width / canvas.height;
    let renderWidth = usableWidth;
    let renderHeight = renderWidth / imgRatio;

    if (renderHeight > usableHeight) {
      renderHeight = usableHeight;
      renderWidth = renderHeight * imgRatio;
    }

    const offsetX = margin + (usableWidth - renderWidth) / 2;
    const offsetY = margin + (usableHeight - renderHeight) / 2;

    pdf.addImage(
      imgData,
      'PNG',
      offsetX,
      offsetY,
      renderWidth,
      renderHeight,
      undefined,
      'FAST'
    );

    // Executive Footer (Page Number + Report Date)
    pdf.setFontSize(8.5);
    pdf.setTextColor(18, 59, 112);
    const footerLeft = `SAAED Vehicle Auction Executive Reporting System | Date: ${metadata.reportDate}`;
    const footerRight = isAr
      ? `Page ${i + 1} of ${elementsToRender.length}`
      : `Page ${i + 1} of ${elementsToRender.length}`;

    pdf.text(footerLeft, margin, pageHeight - 4);
    pdf.text(
      footerRight,
      pageWidth - margin,
      pageHeight - 4,
      { align: 'right' }
    );
  }

  pdf.save('SAAED_Auction_Executive_Report.pdf');
}
