import { useEffect } from 'preact/hooks';

export function useReducedMotion(): void {
  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');

    const sync = (matches: boolean) => {
      window.quakeshell.window.setReducedMotion(matches);
    };

    // Send initial value
    sync(mql.matches);

    const handler = (e: MediaQueryListEvent) => sync(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
}
