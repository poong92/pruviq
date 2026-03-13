import { useState, useEffect } from 'preact/hooks';
import { STATIC_DATA, fetchWithFallback } from '../config/api';

type MacroIndicator = {
  id: string;
  name: string;
  value: number;
  change: number | null;
  previous?: number | null;
  unit: string;
  updated: string;
  source: string;
};

type MacroData = {
  indicators: MacroIndicator[];
  generated: string;
};

const POLL_MS = 1_800_000; // 30 minutes

export function useMacro() {
  const [macro, setMacro] = useState<MacroData | null>(null);
  const [error, setError] = useState(false);

  const fetchMacro = () => {
    fetchWithFallback<MacroData>('/macro', STATIC_DATA.macro)
      .then((d) => { setMacro(d); setError(false); })
      .catch(() => setError(true));
  };

  useEffect(() => {
    fetchMacro();
    const id = setInterval(fetchMacro, POLL_MS);
    return () => clearInterval(id);
  }, []);

  return { macro, error, retry: fetchMacro };
}
