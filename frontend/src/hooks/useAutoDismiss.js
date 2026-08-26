import { useState, useEffect, useRef, useCallback } from "react";

/**
 * A drop-in replacement for useState for inline messages/errors that auto-dismiss after a duration.
 *
 * @template T
 * @param {T} initialValue - Initial state value (default: "")
 * @param {number} [duration=5000] - Duration in ms before auto-clearing (default: 5000ms). Set <= 0 to disable.
 * @returns {[T, (value: T | ((prev: T) => T)) => void, () => void]}
 */
export function useAutoDismiss(initialValue = "", duration = 5000) {
  const [state, setState] = useState(initialValue);
  const timerRef = useRef(null);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setState(typeof initialValue === "string" ? "" : null);
  }, [initialValue]);

  const setAutoDismissState = useCallback((value) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    setState((prev) => {
      const nextValue = typeof value === "function" ? value(prev) : value;
      if (nextValue && duration > 0) {
        timerRef.current = setTimeout(() => {
          setState(typeof initialValue === "string" ? "" : null);
        }, duration);
      }
      return nextValue;
    });
  }, [duration, initialValue]);

  useEffect(() => {
    // Also handle case where initialValue is already truthy on mount
    if (initialValue && duration > 0) {
      timerRef.current = setTimeout(() => {
        setState(typeof initialValue === "string" ? "" : null);
      }, duration);
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [initialValue, duration]);

  return [state, setAutoDismissState, clear];
}

export default useAutoDismiss;
