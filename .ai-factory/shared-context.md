# Shared Context (auto-generated — do NOT modify)


## 패킷 간 계약 (src/lib/contract.ts — 자동 생성, 수정 금지)
여기 선언된 이름·인자·반환 타입은 확정이다. 기반 패킷은 이대로 구현하고,
화면 패킷은 이대로 호출하라. 다르게 만들지 마라.

```typescript
/**
 * 패킷 간 인터페이스 계약 — 자동 생성. **수정하지 마라.**
 *
 * 기반 패킷은 여기 선언된 모양 그대로 구현하고, 화면 패킷은 여기 적힌 이름·인자·반환
 * 타입을 그대로 가정해도 된다. 추측이 어긋나 병합에서 무너지는 것을 막기 위한 파일이다.
 */

/** 회의 엔티티, 모든 패킷에서 필요 (구현: 패킷 0001) */
export type Meeting = { id: string; startedAt: string; state: 'active' | 'paused' | 'finalized'; pausedMs: number; hourlyRate: number; timezone: string };

/** 회의 기록, 저장/조회/표시에 필요 (구현: 패킷 0001) */
export type Record = { id: string; meetingId: string; date: string; durationMs: number; costKrw: number; notes?: string };

/** 라우팅 상태 (구현: 패킷 0001) */
export type RouteState = { screen: 'home' | 'setup' | 'meeting' | 'wrapup' | 'report' | 'card' | 'history' | 'challenge'; recordId?: string };

/** 타이머, 리포트에서 실시간 비용 표시 (구현: 패킷 0002) */
export type calculateCostFn = (durationMs: number, hourlyRateKrw: number) => number;

/** 타이머, 기록 목록에서 경과 시간 표시 (구현: 패킷 0002) */
export type formatDurationFn = (durationMs: number) => string;

/** 비용 표시 포맷 (구현: 패킷 0002) */
export type formatPriceFn = (amountKrw: number, opts?: { compact?: boolean }) => string;

/** 저장소 쿼리, 목록/리포트에서 필요 (구현: 패킷 0004) */
export type createQueryFn = (opts: { meetingIds?: string[]; dateFrom?: string; dateTo?: string; limit?: number; offset?: number }) => Promise<Record[]>;

/** 회의 저장 (구현: 패킷 0004) */
export type saveMeetingFn = (meeting: Meeting) => Promise<void>;

/** 기록 저장 (구현: 패킷 0004) */
export type saveRecordFn = (record: Record) => Promise<void>;

/** 회의 조회 (구현: 패킷 0004) */
export type getMeetingByIdFn = (id: string) => Promise<Meeting | null>;

/** 회의 시작 (구현: 패킷 0005) */
export type startMeetingFn = (hourlyRateKrw: number, timezone: string) => Promise<Meeting>;

/** 회의 일시정지 (순수 함수) (구현: 패킷 0005) */
export type pauseMeetingFn = (meeting: Meeting) => Meeting;

/** 회의 재개 (순수 함수) (구현: 패킷 0005) */
export type resumeMeetingFn = (meeting: Meeting) => Meeting;

/** 회의 종료, 회고로 이동 (구현: 패킷 0005) */
export type finalizeMeetingFn = (meeting: Meeting, finalizeMode: 'confirmed' | 'discarded') => Promise<Record | null>;

/** 홈 대시보드 주간 합계 (구현: 패킷 0007) */
export type getWeekSummaryFn = (records: Record[], weekStartDate: string) => { totalMs: number; totalCostKrw: number; count: number };

/** 팀 랭킹 탭 표시 (구현: 패킷 0006) */
export type getTeamRankingFn = (records: Record[]) => { userId: string; totalMinutes: number; rank: number }[];

/** 진행 중 회의 구독, 타이머/회의 페이지에서 필요 (구현: 패킷 0008) */
export type useActiveMeetingFn = () => { meeting: Meeting | null; isLoading: boolean; error?: Error };

/** 라우트 파라미터 record 조회 (구현: 패킷 0008) */
export type useRecordParamFn = () => { recordId: string; record: Record | null; isLoading: boolean; notFound: boolean };

/** 기록 없음 화면 컴포넌트 (구현: 패킷 0008) */
export type RecordNotFoundFn = () => React.ReactElement;

/** 회의 없는 날 선언, 챌린지 페이지에서 (구현: 패킷 0006) */
export type declareNoMeetingDayFn = (date: string) => Promise<void>;

```

## Shared Types Contract (IMPORT these, do NOT redefine)
```typescript
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
      autoClosed: null | "elapsed_cap" | "wall_cap";
    }
  | { ok: false; reason: "no_active" | "too_short" | "quota" };

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
  "/setup": { prefill: Me
// ...truncated
```

## Existing Codebase (import and use these — do NOT recreate)
### File Tree (src/)
  App.tsx
  components/
    AdSlot.tsx
    Amount.tsx
    BottomCTA.tsx
    Card.tsx
    CountUp.tsx
    FloatingTabBar.tsx
    MiniBar.tsx
    PageShell.tsx
    ScreenScaffold.tsx
    Sparkline.tsx
    StateView.tsx
    SummaryHero.tsx
    TossPurchase.tsx
    TossRewardAd.tsx
  hooks/
  lib/
    constants.ts
    contract.ts
    storage.ts
    types.ts
    utils.ts
  main.tsx
  pages/
    Card.tsx
    Challenge.tsx
    History.tsx
    Home.tsx
    Meeting.tsx
    Report.tsx
    Setup.tsx
    Wrapup.tsx
    __TdsGallery.tsx
  styles/
    globals.css
    reward-ad.css
  types/
  vite-env.d.ts

### Exports (src/lib/)
- constants.ts: export const ANNUAL_WORK_HOURS = 2080; export const MAX_DURATION_SEC = 28800; export const MAX_WALL_MS = 43200000; export const MIN_SAVE_SEC = 10; export const HISTORY_PAGE_SIZE = 20; export const RECORDS_MAX = 500; export const OUTCOME_FACTOR =; export const STORAGE_KEY_LAST_SETUP = "mcc:v1:lastSetup"
- contract.ts: export type Meeting =; export type Record =; export type RouteState =; export type calculateCostFn = (durationMs: number, hourlyRateKrw: number) => number; export type formatDurationFn = (durationMs: number) => string; export type formatPriceFn = (amountKrw: number, opts?:; export type createQueryFn = (opts:; export type saveMeetingFn = (meeting: Meeting) => Promise<void>
- storage.ts: export function getItem<T>(key: string): T | null; export function setItem<T>(key: string, value: T): void; export function removeItem(key: string): void
- types.ts: export type MeetingOutcome = "decided" | "partial" | "none"; export type BadgeId = | "first_free_day" | "streak_3" | "total_5" | "total_10" | "total_20"; export interface Page<T>; export interface TeamRank; export interface MeetingSetupInput; export interface MeetingSetup extends MeetingSetupInput; export interface ActiveMeeting; export interface MeetingRecord
- utils.ts: export function cn(...classes: (string | boolean | undefined | null)[]): string; export function formatNumber(n: number): string; export function formatCurrency(n: number, currency = 'KRW'): string

### Components (src/components/)
- AdSlot.tsx: AdSlot
- Amount.tsx: Amount
- BottomCTA.tsx: SubmitFooter, ButtonStack
- Card.tsx: Card
- CountUp.tsx: CountUp
- FloatingTabBar.tsx: FloatingTabBar
- MiniBar.tsx: MiniBar
- PageShell.tsx: PageShell
- ScreenScaffold.tsx: ScreenScaffold
- Sparkline.tsx: Sparkline
- StateView.tsx: EmptyState, LoadingState
- SummaryHero.tsx: SummaryHero
- TossPurchase.tsx: TossPurchase
- TossRewardAd.tsx: TossRewardAd
CRITICAL: Before creating any new function, type, or component, check the list above. If something similar exists, import and use it.

## Already Implemented (do NOT duplicate or overwrite)
- 0001: 엔티티 타입, RouteState 계약, 전역 상수 (files: src/lib/types.ts, src/lib/constants.ts)