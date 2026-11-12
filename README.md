# Amman Billing & Accounting (Vyapar GST Billing)

A free, offline-first, desktop-grade GST billing and accounting web application inspired by Vyapar Desktop for small businesses, retailers, and distributors in India.

## Features

- **100% Offline-First Architecture**: All accounting records (parties, inventory, sales invoices, delivery challans, purchases, and settings) are stored locally on your device in the browser's IndexedDB (`VyaparGST_DB`). Zero cloud dependencies or vendor lock-in.
- **Indian GST Compliance**: All 36 Indian States and Union Territories with official state codes. Auto-calculation of CGST, SGST, IGST, reverse charge (RCM), and composition scheme bills of supply.
- **Invoicing & Print Templates**:
  - Full A4 GST Tax Invoices with HSN/SAC summary breakdown, bank details, and dynamic UPI QR code.
  - 3-inch (80mm) and 2-inch (58mm) POS Thermal receipts for retail billing.
  - e-Way Bill NIC JSON export ready for the Government GST portal.
- **Inventory & Barcodes**: Stock tracking, batch numbers, low-stock warnings, negative stock prevention, and custom barcode sticker label generator (single label & 24-label A4 sheets).
- **Desktop Keyboard Shortcuts**: Accelerated desktop hotkeys (`F1` for cheatsheet, `Alt+S` Sale, `Alt+P` Purchase, `Alt+C` Challan, `Ctrl+K` Search, `Ctrl+Enter` Save in modals).
- **Data Backup & Restore**: Full JSON database backup and merge/clean restore, snapshot rollbacks, transfer sync codes, and database health audit.

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Installation

```bash
npm install
```

### Development Server

```bash
npm run dev
```

Open `http://localhost:3000` in your web browser.

### Production Build

```bash
npm run build
```

The compiled static assets will be output to the `dist/` directory.

### Desktop App Packaging (Windows)

The application includes Electron configuration for packaging as a standalone native Windows desktop application:

```bash
# Package Windows NSIS installer
npm run electron:build:win

# Package portable Windows executable (run from USB drive)
npm run electron:build:portable
```

## Data Storage

All data is stored purely in the user's local browser via **IndexedDB** (`VyaparGST_DB`). To protect your data, always use the built-in **Backup & Restore** feature (`Alt + 7`) to export regular JSON backups to your local drive.
