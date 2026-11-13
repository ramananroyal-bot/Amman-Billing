import { FirmInfo } from '../types';

const FIRMS_REGISTRY_KEY = 'vyapar_firms_registry_v1';
const ACTIVE_FIRM_ID_KEY = 'vyapar_active_firm_id_v1';
const PASSCODE_STORAGE_KEY = 'vyapar_passcode_lock_v1';
const DARK_MODE_STORAGE_KEY = 'vyapar_dark_mode_v1';

export const DEFAULT_FIRM_ID = 'firm_default';
export const DEFAULT_DB_NAME = 'VyaparGST_DB';

/**
 * Multi-firm registry persisted in localStorage so the right IndexedDB database
 * is opened immediately on app boot before querying records.
 */
export function getFirmsList(): FirmInfo[] {
  try {
    const raw = localStorage.getItem(FIRMS_REGISTRY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // Fallback to default firm if localStorage cannot be parsed
  }

  const fallback: FirmInfo = {
    id: DEFAULT_FIRM_ID,
    name: 'Primary Firm',
    dbName: DEFAULT_DB_NAME,
    createdAt: new Date().toISOString(),
  };
  saveFirmsList([fallback]);
  return [fallback];
}

export function saveFirmsList(firms: FirmInfo[]): void {
  try {
    localStorage.setItem(FIRMS_REGISTRY_KEY, JSON.stringify(firms));
  } catch {
    // Ignore storage quota errors
  }
}

export function getActiveFirmId(): string {
  try {
    return localStorage.getItem(ACTIVE_FIRM_ID_KEY) || DEFAULT_FIRM_ID;
  } catch {
    return DEFAULT_FIRM_ID;
  }
}

export function setActiveFirmId(firmId: string): void {
  try {
    localStorage.setItem(ACTIVE_FIRM_ID_KEY, firmId);
  } catch {
    // Ignore
  }
}

export function getActiveFirm(): FirmInfo {
  const firms = getFirmsList();
  const activeId = getActiveFirmId();
  return firms.find((f) => f.id === activeId) || firms[0];
}

export function getActiveDBName(): string {
  return getActiveFirm().dbName || DEFAULT_DB_NAME;
}

export function registerNewFirmMeta(name: string, gstin?: string): FirmInfo {
  const firms = getFirmsList();
  const id = `firm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const newFirm: FirmInfo = {
    id,
    name: name.trim(),
    dbName: `VyaparGST_DB_${id}`,
    gstin: gstin?.trim().toUpperCase(),
    createdAt: new Date().toISOString(),
  };
  saveFirmsList([...firms, newFirm]);
  return newFirm;
}

export function updateFirmMeta(firmId: string, updates: Partial<FirmInfo>): void {
  const firms = getFirmsList();
  const updated = firms.map((f) => (f.id === firmId ? { ...f, ...updates } : f));
  saveFirmsList(updated);
}

/**
 * Simple deterministic hash for 4-6 digit PIN storage so the raw PIN isn't stored in plain text.
 * Uses Web Crypto SHA-256 when available, with a deterministic synchronous fallback.
 */
export async function hashPin(pin: string): Promise<string> {
  const normalized = pin.trim();
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(`vyapar_salt_${normalized}`);
      const hashBuf = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(hashBuf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    } catch {
      // Fallback below
    }
  }
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv_${(hash >>> 0).toString(16)}`;
}

export interface PasscodeConfig {
  enabled: boolean;
  pinHash: string;
  requireForEditDelete: boolean;
}

export function getPasscodeConfig(): PasscodeConfig {
  try {
    const raw = localStorage.getItem(PASSCODE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        enabled: Boolean(parsed.enabled),
        pinHash: parsed.pinHash || '',
        requireForEditDelete: Boolean(parsed.requireForEditDelete),
      };
    }
  } catch {
    // Ignore
  }
  return { enabled: false, pinHash: '', requireForEditDelete: false };
}

export function savePasscodeConfig(config: PasscodeConfig): void {
  try {
    localStorage.setItem(PASSCODE_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Ignore
  }
}

export async function verifyPasscode(pin: string): Promise<boolean> {
  const cfg = getPasscodeConfig();
  if (!cfg.pinHash) return true;
  const candidate = await hashPin(pin);
  return candidate === cfg.pinHash;
}

/**
 * Applies dark mode class on <html> and caches preference for instant boot application.
 */
export function applyDarkModeClass(enabled: boolean): void {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', Boolean(enabled));
  }
  try {
    localStorage.setItem(DARK_MODE_STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    // Ignore
  }
}

export function getCachedDarkMode(): boolean {
  try {
    return localStorage.getItem(DARK_MODE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}
