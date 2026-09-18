const pad2 = (n: number): string => String(n).padStart(2, "0");

/** 90144 → "90,144원" */
export function formatWon(won: number): string {
  return `${Math.floor(won).toLocaleString("ko-KR")}원`;
}

/** 2700 → "00:45:00" */
export function formatHMS(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${pad2(Math.floor(s / 3600))}:${pad2(Math.floor((s % 3600) / 60))}:${pad2(s % 60)}`;
}

/** 45 → "45분" */
export function formatMinutes(minutes: number): string {
  return `${Math.floor(minutes)}분`;
}

/** Date → "MM-DD" (로컬) */
export function formatMonthDay(date: Date): string {
  return `${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** 로컬 날짜 기준 "YYYY-MM-DD" (toISOString 사용 금지) */
export function toLocalDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}
