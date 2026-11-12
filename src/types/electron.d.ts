export interface ElectronAPI {
  isDesktop: boolean;
  platform: string;
  getVersion: () => Promise<string>;
  print: (options?: any) => Promise<{ success: boolean; failureReason?: string }>;
  showSaveDialog: (options?: any) => Promise<{ canceled: boolean; filePath?: string }>;
  showOpenDialog: (options?: any) => Promise<{ canceled: boolean; filePaths: string[] }>;
  onMenuNewSale: (callback: () => void) => () => void;
  onMenuNewPurchase: (callback: () => void) => () => void;
  onMenuNewChallan: (callback: () => void) => () => void;
  onMenuNavigate: (callback: (view: string) => void) => () => void;
  onMenuSearch: (callback: () => void) => () => void;
  onMenuShortcuts: (callback: () => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
