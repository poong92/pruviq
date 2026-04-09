import { useState, useEffect } from "preact/hooks";

interface Props {
  postId: string;
  href: string;
  title: string;
  description: string;
  tags?: string[];
  tagMap?: Record<string, string>;
  isEnglish?: boolean;
  levelLabel?: string;
  levelColor?: string;
  readTime?: number;
  readTimeLabel?: string;
}

const STORAGE_KEY = "pruviq_learn_read";

function isRead(id: string): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw).includes(id) : false;
  } catch {
    return false;
  }
}

const levelColorMap: Record<string, string> = {
  green: "bg-[--color-up]/10 text-[--color-up] border-[--color-up]/20",
  yellow:
    "bg-[--color-warning]/10 text-[--color-warning] border-[--color-warning]/20",
  red: "bg-[--color-down]/10 text-[--color-down] border-[--color-down]/20",
};

export default function LearnCard({
  postId,
  href,
  title,
  description,
  tags,
  tagMap,
  isEnglish,
  levelLabel,
  levelColor,
  readTime,
  readTimeLabel,
}: Props) {
  const [read, setRead] = useState(false);

  useEffect(() => {
    setRead(isRead(postId));
  }, [postId]);

  return (
    <a
      href={href}
      class="border border-[--color-border] rounded-xl p-5 bg-[--color-bg-card] card-hover shadow-[0_1px_3px_rgba(0,0,0,0.2)] block group relative transition-all duration-200"
    >
      {read && (
        <span
          class="absolute top-3 right-3 w-5 h-5 rounded-full bg-[--color-accent]/20 flex items-center justify-center"
          title={isEnglish !== false ? "Read" : "읽음"}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M2.5 6L5 8.5L9.5 3.5"
              stroke="var(--color-accent)"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </span>
      )}
      <div class="flex items-center gap-2 mb-2 flex-wrap">
        {levelLabel && levelColor && (
          <span
            class={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${levelColorMap[levelColor] ?? ""}`}
          >
            {levelLabel}
          </span>
        )}
        {readTime != null && readTime > 0 && (
          <span class="text-[10px] font-mono text-[--color-text-muted]">
            {readTime} {readTimeLabel || "min read"}
          </span>
        )}
      </div>
      <div class="flex items-center gap-2 mb-1 pr-6">
        <h3 class="font-bold group-hover:text-[--color-accent] transition-colors text-sm">
          {title}
        </h3>
        {isEnglish && (
          <span class="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[--color-border] text-[--color-text-muted] shrink-0">
            EN
          </span>
        )}
      </div>
      <p class="text-[--color-text-muted] text-xs line-clamp-2">
        {description}
      </p>
      {tags && tags.length > 0 && (
        <div class="flex flex-wrap gap-1 mt-2">
          {tags.slice(0, 3).map((tag) => (
            <span class="text-[10px] font-mono text-[--color-text-muted] bg-[--color-border]/50 px-1.5 py-0.5 rounded">
              {tagMap?.[tag] || tag}
            </span>
          ))}
        </div>
      )}
    </a>
  );
}
