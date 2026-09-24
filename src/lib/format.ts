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

/**
 * 화면에 보이는 회의 길이 — 회고·리포트·기록·홈이 모두 이 함수 하나로 같은 값을 말한다.
 * 12 → "12초", 2700 → "45분", 3600 → "1시간", 5400 → "1시간 30분" (단위 아래는 내림 — 공유 카드의
 * formatDuration "00:12"·"01:59"와 같은 값을 가리킨다. 반올림하면 12초 회의가 "1분"이 된다).
 */
export function formatDurationLabel(durationSec: number): string {
  const s = Number.isFinite(durationSec) ? Math.max(0, Math.floor(durationSec)) : 0;
  if (s < 60) return `${s}초`;
  const totalMin = Math.floor(s / 60);
  if (totalMin < 60) return `${totalMin}분`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
}

/** 계약 함수: 12345000 → "03:25:45" (1시간 미만은 "MM:SS") */
export function formatDuration(durationMs: number): string {
  const s = Number.isFinite(durationMs) ? Math.max(0, Math.floor(durationMs / 1000)) : 0;
  const h = Math.floor(s / 3600);
  const mmss = `${pad2(Math.floor((s % 3600) / 60))}:${pad2(s % 60)}`;
  return h > 0 ? `${pad2(h)}:${mmss}` : mmss;
}

/** 계약 함수: 90144 → "90,144원", compact: 1_250_000 → "125만원", 15_000 → "1.5만원" */
export function formatPrice(amountKrw: number, opts?: { compact?: boolean }): string {
  const won = Number.isFinite(amountKrw) ? Math.max(0, Math.floor(amountKrw)) : 0;
  if (opts?.compact && won >= 10000) {
    const man = Math.floor(won / 1000) / 10;
    return `${man.toLocaleString("ko-KR")}만원`;
  }
  return formatWon(won);
}
