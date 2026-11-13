import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import {
  getPasscodeConfig,
  getCachedDarkMode,
  applyDarkModeClass,
  getActiveFirm,
} from '../utils/security';
import { PasscodeLockScreen, PinVerifyModal } from '../components/modals/PasscodeLockScreen';

interface SecurityContextValue {
  isLocked: boolean;
  lockApp: () => void;
  unlockApp: () => void;
  /**
   * Checks if PIN is required before editing/deleting transactions.
   * Resolves true if disabled in Settings or once the user enters the correct PIN.
   */
  requirePin: (actionDescription?: string) => Promise<boolean>;
}

const SecurityContext = createContext<SecurityContextValue>({
  isLocked: false,
  lockApp: () => {},
  unlockApp: () => {},
  requirePin: async () => true,
});

export const useSecurity = () => useContext(SecurityContext);

export const SecurityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Check immediately on boot whether passcode lock is armed with a PIN hash
  const [isLocked, setIsLocked] = useState<boolean>(() => {
    const cfg = getPasscodeConfig();
    return Boolean(cfg.enabled && cfg.pinHash);
  });

  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinModalDesc, setPinModalDesc] = useState('Enter your PIN to edit or delete this transaction.');
  const resolverRef = useRef<((allowed: boolean) => void) | null>(null);

  // Sync dark mode class cleanly on mount before children render
  useEffect(() => {
    applyDarkModeClass(getCachedDarkMode());
  }, []);

  const lockApp = useCallback(() => {
    const cfg = getPasscodeConfig();
    if (cfg.pinHash) {
      setIsLocked(true);
    }
  }, []);

  const unlockApp = useCallback(() => {
    setIsLocked(false);
  }, []);

  const requirePin = useCallback((actionDescription?: string): Promise<boolean> => {
    const cfg = getPasscodeConfig();
    // Skip prompt unless "Require PIN to Edit/Delete Transactions" is active and a PIN exists
    if (!cfg.requireForEditDelete || !cfg.pinHash) {
      return Promise.resolve(true);
    }

    // Cancel any stale pending check
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }

    setPinModalDesc(
      actionDescription || 'Enter your security PIN to authorize editing or deleting this transaction.'
    );
    setPinModalOpen(true);

    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const handlePinVerified = () => {
    setPinModalOpen(false);
    if (resolverRef.current) {
      resolverRef.current(true);
      resolverRef.current = null;
    }
  };

  const handlePinCancelled = () => {
    setPinModalOpen(false);
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }
  };

  const activeFirm = getActiveFirm();

  return (
    <SecurityContext.Provider value={{ isLocked, lockApp, unlockApp, requirePin }}>
      {children}

      {isLocked && (
        <PasscodeLockScreen
          businessName={activeFirm?.name}
          onUnlock={unlockApp}
        />
      )}

      <PinVerifyModal
        isOpen={pinModalOpen}
        description={pinModalDesc}
        onClose={handlePinCancelled}
        onVerified={handlePinVerified}
      />
    </SecurityContext.Provider>
  );
};
