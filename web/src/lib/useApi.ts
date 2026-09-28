import { type DependencyList, useCallback, useEffect, useState } from "react";

/**
 * Load data for a page: { data, error, loading, reload }.
 * Ignores late responses from an older request (e.g. fast typing in a search box).
 */
export function useApi<T>(load: () => Promise<T>, deps: DependencyList) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  // The caller lists what the request depends on, like useEffect.
  const run = useCallback(load, deps);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(null);
    run()
      .then((d) => current && setData(d))
      .catch((e) => current && setError(e))
      .finally(() => current && setLoading(false));
    return () => {
      current = false;
    };
  }, [run, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data, error, loading, reload, setData };
}
