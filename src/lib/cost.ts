import { ANNUAL_WORK_HOURS, OUTCOME_FACTOR } from "@/lib/constants";
import type { MeetingOutcome } from "@/lib/types";

export interface CalcHourlyResult {
  perPerson: number;
  team: number;
  perMinute: number;
}

export interface CalcWasteResult {
  overtimeSec: number;
  overtimeCost: number;
  baseCost: number;
  totalCost: number;
  wasteCost: number;
  wasteRate: number;
}

/** 시급 환산 (SPEC 수식, 나눗셈은 모두 floor) */
export function calcHourly(
  attendees: number,
  salaryManwon: number
): CalcHourlyResult {
  const annualWon = salaryManwon * 10000;
  const perPerson = Math.floor(annualWon / ANNUAL_WORK_HOURS);
  return {
    perPerson,
    team: Math.floor((attendees * annualWon) / ANNUAL_WORK_HOURS),
    perMinute: Math.floor((attendees * annualWon) / (ANNUAL_WORK_HOURS * 60)),
  };
}

/** 경과 sec초 누적 비용 */
export function calcCost(
  attendees: number,
  salaryManwon: number,
  sec: number
): number {
  return Math.floor(
    (attendees * salaryManwon * 10000 * sec) / (ANNUAL_WORK_HOURS * 3600)
  );
}

/** 낭비 추정 = 초과 비용 + floor(기본 비용 × 결과 계수) */
export function calcWaste(
  record: {
    attendees: number;
    annualSalaryManwon: number;
    plannedMinutes: number;
    durationSec: number;
    totalCost?: number;
  },
  outcome: MeetingOutcome
): CalcWasteResult {
  const overtimeSec = Math.max(0, record.durationSec - record.plannedMinutes * 60);
  const overtimeCost = calcCost(
    record.attendees,
    record.annualSalaryManwon,
    overtimeSec
  );
  const totalCost =
    record.totalCost ??
    calcCost(record.attendees, record.annualSalaryManwon, record.durationSec);
  const baseCost = Math.max(0, totalCost - overtimeCost);
  const wasteCost = overtimeCost + Math.floor(baseCost * OUTCOME_FACTOR[outcome]);
  const wasteRate =
    totalCost > 0 ? Math.round((wasteCost / totalCost) * 100) : 0;
  return { overtimeSec, overtimeCost, baseCost, totalCost, wasteCost, wasteRate };
}

/** 계약 함수: 경과 ms × 시급(원) → 누적 비용(원, floor). 잘못된 입력은 0 */
export function calculateCost(durationMs: number, hourlyRateKrw: number): number {
  if (!Number.isFinite(durationMs) || !Number.isFinite(hourlyRateKrw)) return 0;
  if (durationMs <= 0 || hourlyRateKrw <= 0) return 0;
  return Math.floor((durationMs * hourlyRateKrw) / 3_600_000);
}
