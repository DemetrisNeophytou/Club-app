import type { AppLang } from "@portal/shared";

const LOCALE: Record<AppLang, string> = { el: "el-GR", en: "en-GB" };

/** "Παρ 4 Ιουλ · 23:00" */
export function formatEventTime(iso: string, lang: AppLang): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString(LOCALE[lang], {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return `${day} · ${formatClock(iso, lang)}`;
}

/** "23:00" */
export function formatClock(iso: string, lang: AppLang): string {
  return new Date(iso).toLocaleTimeString(LOCALE[lang], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

export function isTomorrow(iso: string): boolean {
  const d = new Date(iso);
  const t = new Date();
  t.setDate(t.getDate() + 1);
  return d.toDateString() === t.toDateString();
}

/** Fri/Sat/Sun of the current week (or next weekend if past). */
export function isThisWeekend(iso: string): boolean {
  const d = new Date(iso);
  const day = d.getDay(); // 0 Sun … 6 Sat
  if (day !== 5 && day !== 6 && day !== 0) return false;
  const diffDays = (d.getTime() - Date.now()) / 86_400_000;
  return diffDays > -1 && diffDays < 8;
}
