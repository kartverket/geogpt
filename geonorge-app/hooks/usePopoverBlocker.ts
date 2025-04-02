import { useState, useCallback } from 'react';

/**
 * A hook for managing a blocking state that can prevent popovers from closing.
 * Useful when interacting with modals that shouldn't allow underlying popovers to close.
 * 
 * @param initialState 
 * @returns 
 */
export const usePopoverBlocker = (initialState = false) => {
  const [isBlocked, setIsBlocked] = useState(initialState);

  const block = useCallback(() => {
    setIsBlocked(true);
  }, []);

  const unblock = useCallback(() => {
    setIsBlocked(false);
  }, []);

  const toggle = useCallback(() => {
    setIsBlocked(prev => !prev);
  }, []);

  const safeClosePopover = useCallback((closeFunc: () => void) => {
    if (!isBlocked) {
      closeFunc();
    }
  }, [isBlocked]);

  return {
    isBlocked,
    setIsBlocked,
    block,
    unblock,
    toggle,
    safeClosePopover
  };
};
