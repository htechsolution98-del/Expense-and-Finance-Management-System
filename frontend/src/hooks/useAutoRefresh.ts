import { useEffect, useRef } from 'react';

/**
 * useAutoRefresh
 * 
 * A lightweight hook that automatically calls a refresh callback every
 * intervalMs milliseconds. Also calls it immediately on mount.
 *
 * @param callback  - The async function to call on each poll tick
 * @param intervalMs - Polling interval in ms (default: 30000 = 30s)
 * @param deps       - Extra dependencies that should restart the timer (like filter states)
 */
export function useAutoRefresh(
  callback: () => void | Promise<void>,
  intervalMs = 30000,
  deps: React.DependencyList = []
) {
  const callbackRef = useRef(callback);

  // Always keep latest callback ref without restarting timer
  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    // Poll every intervalMs (initial load handled by page's own useEffect)
    const id = setInterval(() => {
      callbackRef.current();
    }, intervalMs);

    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, ...deps]);
}
