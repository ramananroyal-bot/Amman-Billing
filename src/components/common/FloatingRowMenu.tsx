import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface FloatingMenuItem {
  action?: string;
  dataId?: string | number;
  dataType?: string;
  label: string;
  icon?: React.ReactNode;
  onClick: (dataId?: string | number, dataType?: string) => void;
  danger?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  dividerBefore?: boolean;
}

interface FloatingRowMenuProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRect: DOMRect | null;
  items: FloatingMenuItem[];
  minWidth?: number;
}

export const FloatingRowMenu: React.FC<FloatingRowMenuProps> = ({
  isOpen,
  onClose,
  anchorRect,
  items,
  minWidth = 260,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top?: number; bottom?: number; left?: number; right?: number }>({});
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  // Compute position relative to viewport
  useEffect(() => {
    if (!isOpen || !anchorRect) return;

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const menuWidth = minWidth;
    // Estimate menu height based on item count (~36px per item + divider heights + padding)
    const dividersCount = items.filter((i) => i.dividerBefore).length;
    const estimatedHeight = items.length * 36 + dividersCount * 8 + 20;

    const spaceBelow = windowHeight - anchorRect.bottom;
    const spaceAbove = anchorRect.top;

    const newPos: { top?: number; bottom?: number; left?: number; right?: number } = {};

    // Vertical placement: prefer downward unless insufficient space
    if (spaceBelow >= estimatedHeight || spaceBelow >= 220 || spaceBelow >= spaceAbove) {
      newPos.top = anchorRect.bottom + 4;
    } else {
      newPos.bottom = windowHeight - anchorRect.top + 4;
    }

    // Horizontal placement: align right edge of menu to right edge of anchor button
    const rightEdge = windowWidth - anchorRect.right;
    if (anchorRect.right - menuWidth < 12) {
      newPos.left = Math.max(12, anchorRect.left);
    } else {
      newPos.right = Math.max(12, rightEdge);
    }

    setPosition(newPos);
    setFocusedIndex(-1);
  }, [isOpen, anchorRect, items.length, minWidth, items]);

  // Dismiss listeners: outside click, escape, page scroll, window resize
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleScroll = (e: Event) => {
      if (menuRef.current && menuRef.current.contains(e.target as Node)) {
        return;
      }
      onClose();
    };

    const handleResize = () => {
      onClose();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      const enabledIndices = items
        .map((item, idx) => (!item.disabled ? idx : -1))
        .filter((idx) => idx !== -1);

      if (enabledIndices.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((prev) => {
          const currentPos = enabledIndices.indexOf(prev);
          const nextPos = (currentPos + 1) % enabledIndices.length;
          return enabledIndices[nextPos];
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) => {
          const currentPos = enabledIndices.indexOf(prev);
          const prevPos = (currentPos - 1 + enabledIndices.length) % enabledIndices.length;
          return enabledIndices[prevPos];
        });
      } else if (e.key === 'Enter') {
        if (focusedIndex >= 0 && items[focusedIndex] && !items[focusedIndex].disabled) {
          e.preventDefault();
          const target = items[focusedIndex];
          const actionFn = target.onClick;
          const targetId = target.dataId;
          const targetType = target.dataType;
          onClose();
          actionFn(targetId, targetType);
        }
      } else if (e.key === 'Tab') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, focusedIndex, items]);

  if (!isOpen || !anchorRect) return null;

  // Delegated click handler on the menu container
  const handleDelegatedClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const btn = (e.target as HTMLElement).closest('button[data-item-index]') as HTMLButtonElement | null;
    if (!btn) return;

    const indexStr = btn.getAttribute('data-item-index');
    if (indexStr === null) return;
    const index = parseInt(indexStr, 10);
    const item = items[index];

    if (!item || item.disabled) return;

    // Save target data in local variables before closing menu
    const actionFn = item.onClick;
    const targetId = item.dataId;
    const targetType = item.dataType;

    onClose();

    // Execute the action immediately with saved arguments
    actionFn(targetId, targetType);
  };

  return createPortal(
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: position.top !== undefined ? `${position.top}px` : undefined,
        bottom: position.bottom !== undefined ? `${position.bottom}px` : undefined,
        left: position.left !== undefined ? `${position.left}px` : undefined,
        right: position.right !== undefined ? `${position.right}px` : undefined,
        width: `${minWidth}px`,
        maxWidth: '300px',
        zIndex: 9999,
      }}
      className="bg-white rounded-xl shadow-2xl border border-slate-200/95 py-1.5 text-slate-800 text-xs animate-in fade-in zoom-in-95 duration-100 select-none overflow-hidden"
      onClick={handleDelegatedClick}
    >
      {items.map((item, index) => {
        const isFocused = focusedIndex === index;
        return (
          <React.Fragment key={`${item.label}-${index}`}>
            {item.dividerBefore && <div className="my-1 border-t border-slate-100" />}
            <button
              type="button"
              data-item-index={index}
              data-action={item.action || item.label}
              data-id={item.dataId !== undefined ? String(item.dataId) : undefined}
              data-type={item.dataType || ''}
              disabled={item.disabled}
              title={item.disabled ? item.disabledReason || 'Action not available' : undefined}
              className={`w-full px-3.5 py-2 text-left flex items-center justify-between gap-2.5 transition-colors cursor-pointer group disabled:cursor-not-allowed ${
                item.disabled
                  ? 'opacity-40 text-slate-400 bg-transparent'
                  : item.danger
                  ? isFocused
                    ? 'bg-rose-100 text-rose-700 font-medium'
                    : 'text-rose-600 hover:bg-rose-50 font-medium'
                  : isFocused
                  ? 'bg-slate-100 text-slate-900 font-medium'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                {item.icon && (
                  <span
                    className={`shrink-0 ${
                      item.disabled
                        ? 'text-slate-300'
                        : item.danger
                        ? 'text-rose-500'
                        : 'text-slate-400 group-hover:text-slate-600'
                    }`}
                  >
                    {item.icon}
                  </span>
                )}
                <span className="truncate">{item.label}</span>
              </div>
              {item.disabled && item.disabledReason && (
                <span className="text-[10px] text-slate-400 italic shrink-0">
                  {item.disabledReason}
                </span>
              )}
            </button>
          </React.Fragment>
        );
      })}
    </div>,
    document.body
  );
};
