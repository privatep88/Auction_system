<div align="center">
  <img width="260" alt="SAAED Official Logo - شعار شركة ساعد" src="./public/assets/saaed_logo.png" />
  <h1>SAAED Vehicle Auction Executive Reporting System</h1>
  <h2>نظام التقرير التنفيذي لمزادات المركبات — شركة ساعد</h2>
  <p><strong>نظام ويب مؤسسي متكامل لإدارة تقارير مزادات المركبات ولوحة التحليل التنفيذي لأداء المزادات</strong></p>
  <p><em>Enterprise Web Reporting &amp; Executive Business Intelligence System for Vehicle Auctions</em></p>
</div>

---

## نظرة عامة | Overview

### بالعربية
**نظام التقرير التنفيذي لمزادات المركبات (SAAED Vehicle Auction Executive Reporting System)** هو تطبيق ويب مؤسسي متكامل صُمّم لإدارة تقارير مزادات المركبات وتحليل نتائجها التشغيلية والتنفيذية بدقة عالية، وفق الهوية البصرية الرسمية لشركة **ساعد (SAAED)**.

يتضمن النظام واجهتين رئيسيتين مترابطتين بالكامل من حيث البيانات والمؤشرات والحسابات التلقائية:
1. **الواجهة الأولى — تقرير بيانات المزادات (`Vehicle Auction Data Report`):**
   - عرض وإدارة سجلات المزادات (الإضافة، التعديل المباشر أو عبر النوافذ، الحذف بتأكيد، الفرز، والبحث الفوري).
   - حساب تلقائي فوري لعدد المركبات غير المبيعة، ونسبة البيع الإجمالية، ونسبة عدم البيع، ومجاميع الأعمدة.
   - إدارة تواريخ إعداد التقرير والفترة المشمولة بالتقرير.
2. **الواجهة الثانية — لوحة التحليل التنفيذي لأداء المزادات (`Executive Auction Performance Dashboard`):**
   - بطاقات مؤشرات الأداء الرئيسية (KPIs) شاملة متوسط المركبات المبيعة لكل مزاد ونسبة نجاح البيع.
   - الملخص التنفيذي لنتائج المزادات مع تحديد أعلى وأقل مزاد من حيث نسبة البيع تلقائياً.
   - رسوم بيانية تفاعلية وديناميكية: مخطط توزيع نتائج المزادات (Doughnut Chart)، ومخطط مقارنة أداء المزادات (Clustered Bar Chart)، ومخطط نسبة نجاح البيع حسب المزاد مرتباً تنازلياً (Horizontal Bar Chart).
   - جدول التحليل المقارن لأداء المزادات مع شارات تقييم الأداء اللونية القابلة للتخصيص، وبطاقات الملاحظات التشغيلية والتحديات الرئيسية والتوصيات التحسينية.

### In English
The **SAAED Vehicle Auction Executive Reporting System** is a production-grade enterprise reporting and executive analytics web application built with React, TypeScript, Vite, and Tailwind CSS. It provides real-time KPI tracking, interactive auction record management, dynamic visual analytics, persistent storage (`LocalStorage` + optional `Firebase Firestore` cloud synchronization), and one-click executive exports to **Microsoft Excel (`.xlsx`)** with live formulas and embedded branding, as well as high-resolution **PDF (`.pdf`)** and print layouts.

---

## المزايا والتقنيات الرئيسية | Key Features & Tech Stack

- **Frontend Architecture:** React 19 + TypeScript + Vite + Tailwind CSS v4 + Lucide Icons.
- **Executive Data Export:**
  - **Excel Export (`SAAED_Auction_Executive_Report.xlsx`):** Powered by `ExcelJS`, generating two RTL worksheets (`تقرير بيانات المزادات` and `التحليل التنفيذي`) with embedded SAAED logo, auction photography, corporate styling, and real Excel formulas (`SUM`, subtraction, ratios, and `IF` evaluation formulas).
  - **PDF Export (`SAAED_Auction_Executive_Report.pdf`):** High-resolution multi-page landscape A4 PDF generation using `html2canvas` and `jsPDF` with full Arabic typography support.
- **Data Persistence:** Unified storage layer supporting immediate browser persistence (`LocalStorage`) and optional real-time cloud synchronization via **Firebase Firestore**.
- **Bilingual Support:** Full RTL Arabic (`العربية`) and LTR English (`English`) interface switching.

---

## التشغيل المحلي والإعداد | Local Development & Setup

### المتطلبات الأساسية | Prerequisites
- **Node.js** (v18 or v20+ recommended)
- **npm** (v9+ recommended)

### خطوات التشغيل | Installation & Run Steps

1. **تثبيت الحزم الاعتمادية | Install dependencies:**
   ```bash
   npm install
   ```

2. **إعداد متغيرات البيئة (اختياري) | Configure environment variables (optional):**
   انسخ ملف `.env.example` إلى `.env.local` عند الحاجة إلى ضبط إعدادات الربط السحابي (دون تضمين أي مفاتيح سرية داخل المستودع العام):
   ```bash
   cp .env.example .env.local
   ```

3. **تشغيل خادم التطوير | Start the development server:**
   ```bash
   npm run dev
   ```
   سيعمل النظام محلياً على الرابط: `http://localhost:3000`

4. **فحص الأنواع البرمجية | Run TypeScript type checking:**
   ```bash
   npm run lint
   ```

5. **بناء نسخة الإنتاج | Build for production:**
   ```bash
   npm run build
   ```
   يتم توليد ملفات الإنتاج الجاهزة للنشر داخل مجلد `dist/`.

---

## النشر على GitHub Pages | Deploying to GitHub Pages

تم إعداد المشروع مسبقاً للنشر التلقائي على **GitHub Pages** باستخدام:
- إعداد `base: './'` في ملف `vite.config.ts` لضمان توافق مسارات جميع ملفات JavaScript وCSS والصور والشعار سواء تم النشر على نطاق رئيسي أو مسار فرعي للمستودع.
- سير عمل GitHub Actions الموجود في `.github/workflows/deploy.yml` الذي يقوم بتثبيت الحزم، وبناء نسخة الإنتاج (`npm run build`)، ورفع محتويات مجلد `dist` مباشرة إلى GitHub Pages.
