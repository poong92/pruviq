import { useState, useEffect } from 'preact/hooks';

interface Props {
  postIds: string[];
  lang?: 'en' | 'ko';
}

const STORAGE_KEY = 'pruviq_learn_read';

const L = {
  en: {
    progress: 'Your Progress',
    of: 'of',
    articles: 'articles read',
    complete: 'All complete!',
  },
  ko: {
    progress: '학습 진행도',
    of: '/',
    articles: '개 읽음',
    complete: '전부 완료!',
  },
};

function getRead(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export default function LearnProgress({ postIds, lang = 'en' }: Props) {
  const t = L[lang] || L.en;
  const [read, setRead] = useState<Set<string>>(new Set());

  useEffect(() => {
    setRead(getRead());
  }, []);

  const total = postIds.length;
  const count = postIds.filter(id => read.has(id)).length;
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;

  if (total === 0) return null;

  return (
    <div class="mb-8 p-4 rounded-lg bg-[--color-bg-card] border border-[--color-border]">
      <div class="flex items-center justify-between mb-2">
        <span class="font-mono text-xs text-[--color-text-muted] uppercase tracking-wider">{t.progress}</span>
        <span class="font-mono text-xs text-[--color-text]">
          {count === total
            ? t.complete
            : `${count} ${t.of} ${total} ${t.articles}`}
        </span>
      </div>
      <div class="h-2 rounded-full bg-[--color-border] overflow-hidden">
        <div
          class="h-full rounded-full transition-[width] duration-500"
          style={{
            width: `${pct}%`,
            backgroundColor: pct === 100 ? 'var(--color-accent)' : 'var(--color-accent)',
            opacity: pct === 100 ? 1 : 0.8,
          }}
        />
      </div>
    </div>
  );
}

/** Mark a post as read (call from blog post pages) */
export function markAsRead(postId: string) {
  try {
    const read = getRead();
    if (!read.has(postId)) {
      read.add(postId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...read]));
    }
  } catch { /* ignore */ }
}
