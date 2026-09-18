/**
 * F1: 표시 포맷 함수들
 * SPEC: 표시 규칙
 * - 금액: toLocaleString('ko-KR') + "원"
 * - 시간: HH:MM:SS 형식
 * - 날짜: 로컬 시간 기준 YYYY-MM-DD
 */

/**
 * 금액을 한국 원화 형식으로 표시
 * @param won - 원화 금액
 * @returns "원" 단위 문자열 (예: "90,144원")
 */
export function formatWon(won: number): string {
  // TODO: 구현
  return "";
}

/**
 * 초를 HH:MM:SS 형식으로 표시
 * @param seconds - 초 단위 시간
 * @returns "HH:MM:SS" 형식 문자열 (예: "00:45:00")
 */
export function formatHMS(seconds: number): string {
  // TODO: 구현
  return "";
}

/**
 * 분을 "분" 단위 문자열로 표시
 * @param minutes - 분 단위
 * @returns "분" 단위 문자열 (예: "30분")
 */
export function formatMinutes(minutes: number): string {
  // TODO: 구현
  return "";
}

/**
 * Date를 MM-DD 형식으로 표시
 * @param date - Date 객체
 * @returns "MM-DD" 형식 문자열
 */
export function formatMonthDay(date: Date): string {
  // TODO: 구현
  return "";
}

/**
 * 로컬 날짜를 YYYY-MM-DD 키로 변환
 * 주의: 로컬 시간 기준이며, toISOString() 호출 금지 (AC-5)
 * @param date - Date 객체
 * @returns "YYYY-MM-DD" 형식 문자열
 */
export function toLocalDateKey(date: Date): string {
  // TODO: 구현 (toISOString 호출 0회)
  return "";
}
