const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  platform: process.platform,
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  print: (options) => ipcRenderer.invoke('app:print', options),
  showSaveDialog: (options) => ipcRenderer.invoke('file:save-dialog', options),
  showOpenDialog: (options) => ipcRenderer.invoke('file:open-dialog', options),

  // Menu IPC listeners
  onMenuNewSale: (callback) => {
    const subscription = () => callback();
    ipcRenderer.on('menu:new-sale', subscription);
    return () => ipcRenderer.removeListener('menu:new-sale', subscription);
  },
  onMenuNewPurchase: (callback) => {
    const subscription = () => callback();
    ipcRenderer.on('menu:new-purchase', subscription);
    return () => ipcRenderer.removeListener('menu:new-purchase', subscription);
  },
  onMenuNewChallan: (callback) => {
    const subscription = () => callback();
    ipcRenderer.on('menu:new-challan', subscription);
    return () => ipcRenderer.removeListener('menu:new-challan', subscription);
  },
  onMenuNavigate: (callback) => {
    const subscription = (event, view) => callback(view);
    ipcRenderer.on('menu:nav', subscription);
    return () => ipcRenderer.removeListener('menu:nav', subscription);
  },
  onMenuSearch: (callback) => {
    const subscription = () => callback();
    ipcRenderer.on('menu:search', subscription);
    return () => ipcRenderer.removeListener('menu:search', subscription);
  },
  onMenuShortcuts: (callback) => {
    const subscription = () => callback();
    ipcRenderer.on('menu:shortcuts', subscription);
    return () => ipcRenderer.removeListener('menu:shortcuts', subscription);
  },
});
