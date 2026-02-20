import { useState, useEffect, useRef, useCallback } from 'react';
import { extractDomain } from '../api/controld';

export function useClipboard() {
  const [clipboardDomain, setClipboardDomain] = useState(null);
  const lastCheckedText = useRef(null);
  const lastAddedDomain = useRef(null);

  const checkClipboard = useCallback(async () => {
    if (!navigator.clipboard?.readText) return;
    try {
      const text = await navigator.clipboard.readText();
      // Don't re-trigger if clipboard hasn't changed
      if (text === lastCheckedText.current) return;
      lastCheckedText.current = text;

      const domain = extractDomain(text);
      if (domain && domain !== lastAddedDomain.current) {
        setClipboardDomain(domain);
      } else {
        setClipboardDomain(null);
      }
    } catch {
      // Permission denied or clipboard unavailable — degrade silently
    }
  }, []);

  const dismiss = useCallback(() => {
    setClipboardDomain(null);
  }, []);

  const markAdded = useCallback((domain) => {
    lastAddedDomain.current = domain;
    setClipboardDomain(null);
  }, []);

  useEffect(() => {
    // Check on mount
    checkClipboard();

    // Re-check when window regains focus (user switches back from Brave)
    const onFocus = () => checkClipboard();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkClipboard();
    });

    return () => {
      window.removeEventListener('focus', onFocus);
    };
  }, [checkClipboard]);

  return { clipboardDomain, dismiss, markAdded };
}
