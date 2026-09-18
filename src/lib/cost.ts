/**
 * F1: 비용 계산 엔진
 * 모든 계산은 순수 함수로 구현합니다 (부수효과 없음)
 */

export interface CalcHourlyResult {
  perPerson: number;
  team: number;
  perMinute: number;
}

export interface CalcWasteResult {
  overtimeSec: number;
  overtimeCost: number;
  wasteCost: number;
  wasteRate: number;
}

/**
 * 시급 환산
 * @param attendees - 참석자 수
 * @param salaryManwon - 평균 연봉(만 원)
 * @returns { perPerson, team, perMinute }
 */
export function calcHourly(
  attendees: number,
  salaryManwon: number
): CalcHourlyResult {
  // TODO: 구현
  return {
    perPerson: 0,
    team: 0,
    perMinute: 0,
  };
}

/**
 * 누적 비용 계산
 * @param attendees - 참석자 수
 * @param salaryManwon - 평균 연봉(만 원)
 * @param sec - 경과 초
 * @returns 누적 비용(원)
 */
export function calcCost(
  attendees: number,
  salaryManwon: number,
  sec: number
): number {
  // TODO: 구현
  return 0;
}

/**
 * 낭비 추정
 * @param record - 기록 객체 (필요한 필드만)
 * @param outcome - 회의 결과 ('decided' | 'partial' | 'none')
 * @returns 낭비 추정 정보
 */
export function calcWaste(
  record: {
    attendees: number;
    annualSalaryManwon: number;
    plannedMinutes: number;
    durationSec: number;
    totalCost: number;
  },
  outcome: "decided" | "partial" | "none"
): CalcWasteResult {
  // TODO: 구현
  return {
    overtimeSec: 0,
    overtimeCost: 0,
    wasteCost: 0,
    wasteRate: 0,
  };
}
