# Amman Billing & Accounting (Vyapar GST Billing)

An offline-first GST billing and accounting web & Windows desktop application for small businesses, retailers, and distributors in India.

## Features

- **100% Offline-First Architecture**: All accounting records (parties, inventory, invoices, challans, returns, payments, expenses, audit logs, and settings) are stored locally in IndexedDB (`VyaparGST_DB`). Multi-firm mode creates isolated databases per firm.
- **Indian GST Compliance**: All 36 Indian States and Union Territories with official codes. Auto-calculation of CGST, SGST, IGST, RCM, composition bills of supply, GSTR-1 style reports, and NIC e-Way Bill JSON export.
- **Full Voucher Suite**: Sale Invoices, Estimates/Quotations, Payment-In & Payment-Out with invoice allocation, Credit/Debit Notes, Delivery Challans, Job Work Out/In Challans, and Business Expenses.
- **Invoicing, Barcodes & Print**: A4 GST Invoices with HSN/SAC summary and dynamic UPI payment QR code, 80mm/58mm POS thermal receipts, barcode lookup, batch/serial tracking, weight unit conversions (`GM`/`KG`/`QUINTAL`/`TONNE`), and English/Tamil bilingual printing.
- **Security & Controls**: Startup & transaction PIN lock, dark mode, full Audit Trail, and v4.0 JSON Backup & Restore (backwards-compatible with older backups).

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Installation & Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

### Production Web Build

```bash
npm run build
```

Static production assets are output to `dist/`.

## Packaging Standalone Windows `.EXE` (Electron)

Everything needed for native Windows desktop packaging is preconfigured (`electron/main.cjs`, `electron/preload.cjs`, `electron-builder.json`, `public/icon-512.png`, and `build-windows-exe.bat`).

### One-Click Build on Windows

Double-click **`build-windows-exe.bat`** in Windows Explorer, or run from Command Prompt / PowerShell:

```bat
build-windows-exe.bat
```

### Manual CLI Commands

```bash
# Install Electron & Builder (first time on Windows build machine)
npm install --no-save electron electron-builder

# Build web bundle + NSIS Windows Setup Installer
npm run electron:build:win

# Build web bundle + Portable single-file EXE
npm run electron:build:portable

# Build both Setup Installer and Portable EXE together
npm run electron:build:all
```

Generated executables appear inside `release/`:
- `release/Amman-Billing-Setup-1.0.0.exe` (Windows Installer with Desktop & Start Menu shortcuts)
- `release/Amman-Billing-1.0.0-portable.exe` (Portable executable)

## Data Storage & Portability

All data is stored locally in IndexedDB (and per Windows user inside `%APPDATA%\Amman Billing & Accounting` when running the `.exe`). Use **Sync, Share & Backup (`Alt + 7`)** to export regular v4.0 JSON backups and transfer data between browser and `.exe`.
