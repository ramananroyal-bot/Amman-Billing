const { app, BrowserWindow, Menu, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;

// Set Windows Application User Model ID so taskbar pinning and notifications group properly
if (process.platform === 'win32') {
  app.setAppUserModelId('com.amman.billing');
}

// Enforce single instance so two windows never contend over the local IndexedDB folder
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function resolveAppIcon() {
  const candidates = [
    path.join(__dirname, '..', 'dist', 'icon-512.png'),
    path.join(__dirname, '..', 'public', 'icon-512.png'),
  ];
  return candidates.find((p) => fs.existsSync(p));
}

function createWindow() {
  const iconPath = resolveAppIcon();

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Amman Billing & Accounting',
    backgroundColor: '#0f172a',
    icon: iconPath,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });

  // Maximize window on launch for desktop billing workflow
  mainWindow.maximize();

  const useDevServer = process.argv.includes('--dev') || process.env.ELECTRON_DEV === 'true';
  const distPath = path.join(__dirname, '..', 'dist', 'index.html');

  if (!useDevServer && fs.existsSync(distPath)) {
    mainWindow.loadFile(distPath);
  } else {
    mainWindow.loadURL('http://localhost:3000').catch(() => {
      dialog.showErrorBox(
        'Amman Billing - Startup Error',
        'Production build (dist/index.html) was not found and the local dev server (http://localhost:3000) is not running. Run "npm run build" first.'
      );
    });
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open WhatsApp Web links and external portals in the system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (
      url.startsWith('http:') ||
      url.startsWith('https:') ||
      url.startsWith('mailto:') ||
      url.startsWith('tel:')
    ) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  setupAppMenu();
}

function setupAppMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Sale Invoice',
          accelerator: 'Alt+S',
          click: () => {
            mainWindow?.webContents.send('menu:new-sale');
          },
        },
        {
          label: 'New Purchase Bill',
          accelerator: 'Alt+P',
          click: () => {
            mainWindow?.webContents.send('menu:new-purchase');
          },
        },
        {
          label: 'New Delivery Challan',
          accelerator: 'Alt+C',
          click: () => {
            mainWindow?.webContents.send('menu:new-challan');
          },
        },
        { type: 'separator' },
        {
          label: 'Print Active Document',
          click: () => {
            mainWindow?.webContents.print({ printBackground: true });
          },
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit', label: 'Exit Amman Billing' },
      ],
    },
    {
      label: 'Navigate',
      submenu: [
        {
          label: 'Home Dashboard',
          accelerator: 'Alt+H',
          click: () => mainWindow?.webContents.send('menu:nav', 'home'),
        },
        {
          label: 'Parties Directory',
          accelerator: 'Alt+1',
          click: () => mainWindow?.webContents.send('menu:nav', 'parties'),
        },
        {
          label: 'Items & Inventory',
          accelerator: 'Alt+2',
          click: () => mainWindow?.webContents.send('menu:nav', 'items'),
        },
        { type: 'separator' },
        {
          label: 'Sale Invoices',
          accelerator: 'Alt+3',
          click: () => mainWindow?.webContents.send('menu:nav', 'sales'),
        },
        {
          label: 'Estimates & Quotations',
          click: () => mainWindow?.webContents.send('menu:nav', 'estimates'),
        },
        {
          label: 'Payment-In Receipts',
          click: () => mainWindow?.webContents.send('menu:nav', 'payments_in'),
        },
        {
          label: 'Sale Returns (Credit Notes)',
          click: () => mainWindow?.webContents.send('menu:nav', 'sale_returns'),
        },
        {
          label: 'Delivery Challans',
          accelerator: 'Alt+4',
          click: () => mainWindow?.webContents.send('menu:nav', 'delivery_challans'),
        },
        {
          label: 'Job Work Challans (Out & In)',
          click: () => mainWindow?.webContents.send('menu:nav', 'job_work'),
        },
        { type: 'separator' },
        {
          label: 'Purchase Bills',
          accelerator: 'Alt+5',
          click: () => mainWindow?.webContents.send('menu:nav', 'purchases'),
        },
        {
          label: 'Payment-Out Vouchers',
          click: () => mainWindow?.webContents.send('menu:nav', 'payments_out'),
        },
        {
          label: 'Business Expenses',
          click: () => mainWindow?.webContents.send('menu:nav', 'expenses'),
        },
        {
          label: 'Purchase Returns (Debit Notes)',
          click: () => mainWindow?.webContents.send('menu:nav', 'purchase_returns'),
        },
        { type: 'separator' },
        {
          label: 'GST & Audit Reports',
          accelerator: 'Alt+6',
          click: () => mainWindow?.webContents.send('menu:nav', 'reports'),
        },
        {
          label: 'Backup & Restore',
          accelerator: 'Alt+7',
          click: () => mainWindow?.webContents.send('menu:nav', 'sync_backup'),
        },
        {
          label: 'Application Settings',
          accelerator: 'Alt+8',
          click: () => mainWindow?.webContents.send('menu:nav', 'settings'),
        },
        { type: 'separator' },
        {
          label: 'Quick Search (Open Anything)',
          accelerator: 'Ctrl+K',
          click: () => mainWindow?.webContents.send('menu:search'),
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Keyboard Shortcuts Cheatsheet',
          accelerator: 'F1',
          click: () => mainWindow?.webContents.send('menu:shortcuts'),
        },
        {
          label: 'GST Portal (India)',
          click: () => shell.openExternal('https://www.gst.gov.in'),
        },
        {
          label: 'e-Way Bill System',
          click: () => shell.openExternal('https://ewaybillgst.gov.in'),
        },
        { type: 'separator' },
        {
          label: 'About Amman Billing & Accounting',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Amman Billing & Accounting',
              message: `Amman Billing & Accounting v${app.getVersion()}`,
              detail:
                'Offline-first GST billing & accounting application for Indian small businesses. Data is stored privately on your PC in local IndexedDB.',
              buttons: ['OK'],
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC Handlers
ipcMain.handle('app:get-version', () => app.getVersion());
ipcMain.handle('app:is-desktop', () => true);

ipcMain.handle('file:save-dialog', async (event, options) => {
  if (!mainWindow) return null;
  return await dialog.showSaveDialog(mainWindow, options);
});

ipcMain.handle('file:open-dialog', async (event, options) => {
  if (!mainWindow) return null;
  return await dialog.showOpenDialog(mainWindow, options);
});

ipcMain.handle('app:print', async (event, options) => {
  if (!mainWindow) return { success: false, failureReason: 'No active window' };
  return new Promise((resolve) => {
    mainWindow.webContents.print(
      { printBackground: true, ...(options || {}) },
      (success, failureReason) => {
        resolve({ success, failureReason });
      }
    );
  });
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
