const { app, BrowserWindow, Menu, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Amman Billing & Accounting',
    backgroundColor: '#0f172a',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });

  // Maximize by default for a true desktop accounting experience
  mainWindow.maximize();

  // Load production dist if available, else local server
  const distPath = path.join(__dirname, '..', 'dist', 'index.html');
  if (fs.existsSync(distPath)) {
    mainWindow.loadFile(distPath);
  } else {
    mainWindow.loadURL('http://localhost:3000');
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:') || url.startsWith('mailto:') || url.startsWith('tel:') || url.startsWith('https://wa.me')) {
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
          accelerator: 'Ctrl+P',
          click: () => {
            mainWindow?.webContents.print();
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
        {
          label: 'Sale Invoices',
          accelerator: 'Alt+3',
          click: () => mainWindow?.webContents.send('menu:nav', 'sales'),
        },
        {
          label: 'Delivery Challans',
          accelerator: 'Alt+4',
          click: () => mainWindow?.webContents.send('menu:nav', 'delivery_challans'),
        },
        {
          label: 'Purchase Bills',
          accelerator: 'Alt+5',
          click: () => mainWindow?.webContents.send('menu:nav', 'purchases'),
        },
        {
          label: 'GST & Reports',
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
          label: 'Quick Search',
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
              message: 'Amman Billing & Accounting v1.0.0',
              detail:
                'Free, offline-first Vyapar Desktop alternative for Indian businesses. Built with high precision GST tax engines, local IndexedDB persistence, and zero vendor lock-in.',
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
  if (!mainWindow) return false;
  return new Promise((resolve) => {
    mainWindow.webContents.print(options || {}, (success, failureReason) => {
      resolve({ success, failureReason });
    });
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
