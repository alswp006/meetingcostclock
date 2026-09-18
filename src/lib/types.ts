// 타입 정의 전용 파일 — 런타임 코드(const/let/function/class)를 두지 않는다.
//
// RouteState 수신 규칙 (/setup의 prefill):
//   1. useLocation().state as RouteState['/setup'] ?? null 로 받는다.
//   2. null 확인 후 isMeetingSetupInput 가드를 통과시킨다.
//   3. 구조 분해(const { prefill } = state as X)는 금지한다.

export type MeetingOutcome = "decided" | "partial" | "none";

export type BadgeId =
  | "first_free_day"
  | "streak_3"
  | "total_5"
  | "total_10"
  | "total_20";

export interface Page<T> {
  items: T[];
  total: number;
  page: number; // 1부터 시작
  error?: "corrupted" | "unavailable";
}

export interface TeamRank {
  rank: number;
  teamName: string;
  totalCost: number;
  count: number;
  sharePercent: number;
}

export interface MeetingSetupInput {
  title: string;
  teamName: string;
  attendees: number;
  annualSalaryManwon: number;
  plannedMinutes: number;
}

export interface MeetingSetup extends MeetingSetupInput {
  id: "lastSetup";
  createdAt: string;
  updatedAt: string;
}

// AC-2: ActiveMeeting.startedAt must be number (milliseconds)
export interface ActiveMeeting {
  id: string;
  setup: MeetingSetupInput;
  startedAt: number; // milliseconds
  pausedAt: number | null;
  totalPausedMs: number;
  createdAt: string;
  updatedAt: string;
}

// AC-2: MeetingRecord.startedAt must be string (ISO datetime), outcome must be MeetingOutcome | null
export interface MeetingRecord {
  id: string;
  title: string;
  teamName: string;
  attendees: number;
  annualSalaryManwon: number;
  plannedMinutes: number;
  startedAt: string; // ISO datetime
  endedAt: string;
  durationSec: number;
  totalCost: number;
  outcome: MeetingOutcome | null;
  wasteCost: number | null;
  reportUnlocked: boolean;
  shareUnlocked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NoMeetingDay {
  id: string;
  date: string;
  createdAt: string;
  updatedAt: string;
}

export interface EarnedBadge {
  id: string;
  badgeId: BadgeId;
  createdAt: string;
  updatedAt: string;
}

export type SaveResult =
  | { ok: true }
  | { ok: false; reason: "quota" | "unknown" | "not_found" };

export type FinalizeResult =
  | {
      ok: true;
      record: MeetingRecord;
      cancelledNoMeetingDates: string[];
      noMeetingCancelled: boolean;
      autoClosed: null | "elapsed_cap" | "wall_cap";
    }
  | { ok: false; reason: "no_active" | "too_short" | "quota" | "unknown" };

export type StaleResult =
  | { stale: false }
  | { stale: true; reason: "elapsed_cap" | "wall_cap" };

export type AutoFinalizeResult =
  | { status: "not_stale" }
  | { status: "suppressed" }
  | {
      status: "done";
      staleReason: "elapsed_cap" | "wall_cap";
      result: FinalizeResult;
      showQuotaToast: boolean;
    };

export type DeclareResult =
  | { ok: true; day: NoMeetingDay; newBadges: EarnedBadge[] }
  | {
      ok: false;
      reason: "weekend" | "already_declared" | "has_meeting" | "quota" | "unknown";
    };

// /setup만 prefill을 받고("같은 설정으로 다시 시작"), 나머지 라우트는 state가 없다.
export type RouteState = {
  "/": null;
  "/setup": { prefill: MeetingSetupInput } | null;
  "/meeting": null;
  "/wrapup/:id": null;
  "/report/:id": null;
  "/report/:id/card": null;
  "/history": null;
  "/challenge": null;
};

export type RecordRouteParams = { id: string };
