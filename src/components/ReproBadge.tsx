import { useState, useEffect } from 'preact/hooks';

interface ReproMeta {
  data_version?: string;
  engine_version?: string;
  result_hash?: string;
  package_url?: string;
  created?: string;
}

interface Props {
  strategy: string;
  lang?: 'en' | 'ko';
}

export default function ReproBadge({ strategy, lang = 'en' }: Props) {
  const [meta, setMeta] = useState<ReproMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const url = `/data/reproducible/${strategy}.json`;
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error('no-repro-data');
        return res.json();
      })
      .then((json: ReproMeta) => {
        if (!mounted) return;
        setMeta(json);
        setLoading(false);
      })
      .catch(() => {
        if (!mounted) return;
        setLoading(false);
        setError('not found');
      });
    return () => { mounted = false; };
  }, [strategy]);

  if (loading) return null;
  if (!meta) return null; // no reproducible package available

  const label = lang === 'ko' ? '재현 가능 패키지' : 'Reproducible Package';

  return (
    <div class="mt-3 mb-3 flex items-center gap-3">
      <div class="px-2 py-1 rounded border border-[--color-border] bg-[--color-bg-card] text-sm flex items-center gap-3">
        <span class="font-mono text-xs text-[--color-accent] border border-[--color-accent] px-2 py-0.5 rounded">VERIFIED</span>
        <div class="text-sm text-[--color-text-muted]">
          <div class="font-semibold text-[--color-text]">{label}</div>
          <div class="text-[--color-text-muted] text-[12px]">Data v{meta.data_version || 'N/A'} • Engine {meta.engine_version || 'N/A'}</div>
        </div>
      </div>

      <div class="ml-auto flex items-center gap-3">
        {meta.package_url ? (
          <a href={meta.package_url} class="inline-block border border-[--color-border] text-[--color-text] px-3 py-2 rounded font-mono text-sm hover:border-[--color-accent]" target="_blank" rel="noopener">{lang === 'ko' ? '패키지 다운로드' : 'Download package'}</a>
        ) : (
          <a href={`/data/reproducible/${strategy}.zip`} class="inline-block border border-[--color-border] text-[--color-text] px-3 py-2 rounded font-mono text-sm hover:border-[--color-accent]" target="_blank" rel="noopener">{lang === 'ko' ? '패키지 다운로드' : 'Download package'}</a>
        )}
      </div>
    </div>
  );
}
