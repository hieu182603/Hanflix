import { useEffect, useState, useCallback } from 'react';

interface UseAntiCheatOptions {
  enabled?: boolean;
  onViolation?: (reason: string) => void;
}

export function useAntiCheat({ enabled = true, onViolation }: UseAntiCheatOptions = {}) {
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  const showWarning = useCallback((msg: string) => {
    setWarningMessage(msg);
    onViolation?.(msg);
  }, [onViolation]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    // 1. Chặn phím tắt mở DevTools, View Source, Inspect
    const handleKeyDown = (e: KeyboardEvent) => {
      // Phím F12 (keyCode 123)
      if (e.key === 'F12' || e.keyCode === 123) {
        e.preventDefault();
        e.stopPropagation();
        showWarning('Phím F12 (Công cụ lập trình DevTools) đã bị khóa trong phòng thi HSK để đảm bảo tính công bằng và minh bạch.');
        return false;
      }

      const isCtrlOrMeta = e.ctrlKey || e.metaKey;

      // Ctrl + Shift + I (Inspect)
      // Ctrl + Shift + J (Console)
      // Ctrl + Shift + C (Inspect Element)
      if (isCtrlOrMeta && e.shiftKey) {
        const key = e.key.toUpperCase();
        if (key === 'I' || key === 'J' || key === 'C') {
          e.preventDefault();
          e.stopPropagation();
          showWarning('Tổ hợp phím mở Developer Tools (Inspect / Console) đã bị vô hiệu hóa trong suốt quá trình làm bài thi.');
          return false;
        }
      }

      // Ctrl + U (View Source)
      if (isCtrlOrMeta && e.key.toUpperCase() === 'U') {
        e.preventDefault();
        e.stopPropagation();
        showWarning('Tính năng xem mã nguồn trang (View Source) đã bị vô hiệu hóa trong phòng thi HSK.');
        return false;
      }

      // Ctrl + S (Save Page)
      if (isCtrlOrMeta && e.key.toUpperCase() === 'S') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    // 2. Chặn chuột phải (Context Menu) để ngăn Inspect Element
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      showWarning('Menu chuột phải đã bị khóa trong suốt thời gian làm bài thi nhằm ngăn chặn can thiệp kiểm tra mã nguồn.');
      return false;
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('contextmenu', handleContextMenu, { capture: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('contextmenu', handleContextMenu, { capture: true });
    };
  }, [enabled, showWarning]);

  return {
    warningMessage,
    dismissWarning: () => setWarningMessage(null),
  };
}
