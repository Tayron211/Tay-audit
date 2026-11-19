import { useState, useEffect, useRef, useCallback } from 'react';

let activeModalCount = 0;

function syncGlobalModalBlur(shouldBeActive: boolean) {
  if (typeof document === 'undefined') return;
  if (shouldBeActive) {
    activeModalCount++;
    document.body.classList.add('modal-backdrop-blur-active');
    document.documentElement.setAttribute('data-modal-open', 'true');
  } else {
    activeModalCount = Math.max(0, activeModalCount - 1);
    if (activeModalCount === 0) {
      document.body.classList.remove('modal-backdrop-blur-active');
      document.documentElement.removeAttribute('data-modal-open');
    }
  }
}

export function useFadeModal<T = any>(
  isOpen: boolean | T | null | undefined,
  onClose?: () => void,
  duration = 200,
  options: { isModal?: boolean } = {}
) {
  const isModal = Boolean(options?.isModal);
  const [shouldRender, setShouldRender] = useState(Boolean(isOpen));
  const [isClosing, setIsClosing] = useState(false);
  const [cachedData, setCachedData] = useState<T | null>(isOpen ? (isOpen as T) : null);
  const timerRef = useRef<any>(null);
  const wasActiveRef = useRef(false);

  useEffect(() => {
    if (Boolean(isOpen)) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setCachedData(isOpen as T);
      setShouldRender(true);
      setIsClosing(false);
    } else if (shouldRender && !isClosing) {
      setIsClosing(true);
      timerRef.current = setTimeout(() => {
        setShouldRender(false);
        setIsClosing(false);
        setCachedData(null);
      }, duration);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isOpen, duration, shouldRender, isClosing]);

  useEffect(() => {
    if (!isModal || typeof document === 'undefined') return;
    const isActive = shouldRender && !isClosing;
    if (isActive && !wasActiveRef.current) {
      wasActiveRef.current = true;
      syncGlobalModalBlur(true);
    } else if (!isActive && wasActiveRef.current) {
      wasActiveRef.current = false;
      syncGlobalModalBlur(false);
    }
  }, [shouldRender, isClosing, isModal]);

  useEffect(() => {
    if (!isModal) return;
    return () => {
      if (wasActiveRef.current) {
        wasActiveRef.current = false;
        syncGlobalModalBlur(false);
      }
    };
  }, [isModal]);

  const requestClose = useCallback((callback?: () => void) => {
    if (isClosing) return;
    setIsClosing(true);
    timerRef.current = setTimeout(() => {
      setShouldRender(false);
      setIsClosing(false);
      setCachedData(null);
      if (callback) callback();
      if (onClose) onClose();
    }, duration);
  }, [isClosing, onClose, duration]);

  return {
    shouldRender,
    isClosing,
    cachedData: cachedData || (isOpen as T),
    requestClose,
    backdropClass: isClosing ? 'animate-backdrop-fade-out pointer-events-none' : 'animate-backdrop-fade',
    modalClass: isClosing ? 'animate-modal-fade-out pointer-events-none' : 'animate-modal-fade',
    dropdownClass: isClosing ? 'animate-dropdown-fade-out pointer-events-none' : 'animate-dropdown-fade',
    slideRightClass: isClosing ? 'animate-notification-slide-out pointer-events-none' : 'animate-notification-slide-in',
    slideDownClass: isClosing ? 'animate-toast-slide-up pointer-events-none' : 'animate-toast-slide-down',
  };
}
