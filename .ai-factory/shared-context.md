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
export type RouteS
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
    RecordNotFound.tsx
    ScreenScaffold.tsx
    Sparkline.tsx
    StateView.tsx
    SummaryHero.tsx
    TossPurchase.tsx
    TossRewardAd.tsx
    meeting/
    setup/
  hooks/
    useActiveMeeting.ts
    useNow.ts
    useRecordParam.ts
    useToastQueue.ts
  lib/
    __tests__/
    autoFinalize.ts
    challenge.ts
    challengeRules.ts
    constants.ts
    contract.ts
    cost.ts
    finalize.ts
    format.ts
    meetingLifecycle.ts
    meetingTime.ts
    messages.ts
    ranking.ts
    schema.ts
    shareCard.ts
    storage.ts
    storageBase.ts
    storageRecords.ts
    types.ts
    utils.ts
    weekSummary.ts
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
- __tests__/failSetItemOnNth.ts: export function failSetItemOnNth(n: number, errorName = "QuotaExceededError")
- autoFinalize.ts: export function resetAutoFinalizeRetries(): void; export function autoFinalizeStale(now: number): AutoFinalizeResult
- challenge.ts: export function declareNoMeetingDay(now: Date): DeclareResult
- challengeRules.ts: export function isWeekday(date: Date): boolean; export function toDateKey(d: Date): string; export function hasMeetingOn(records: MeetingRecord[], date: Date, hasActive: boolean): boolean; export function canDeclareToday(date: Date):; export function trailingStreak(dates: string[]): number; export function badgesFor(dates: string[]): BadgeId[]
- constants.ts: export const ANNUAL_WORK_HOURS = 2080; export const MAX_DURATION_SEC = 28800; export const MAX_WALL_MS = 43200000; export const MIN_SAVE_SEC = 10; export const HISTORY_PAGE_SIZE = 20; export const RECORDS_MAX = 500; export const OUTCOME_FACTOR =; export const STORAGE_KEY_LAST_SETUP = "mcc:v1:lastSetup"
- contract.ts: export type Meeting =; export type Record =; export type RouteState =; export type calculateCostFn = (durationMs: number, hourlyRateKrw: number) => number; export type formatDurationFn = (durationMs: number) => string; export type formatPriceFn = (amountKrw: number, opts?:; export type createQueryFn = (opts:; export type saveMeetingFn = (meeting: Meeting) => Promise<void>
- cost.ts: export interface CalcHourlyResult; export interface CalcWasteResult; export function calcHourly( attendees: number, salaryManwon: number ): CalcHourlyResult; export function calcCost( attendees: number, salaryManwon: number, sec: number ): number; export function calcWaste( record:; export function calculateCost(durationMs: number, hourlyRateKrw: number): number
- finalize.ts: export function finalizeAt( active: ActiveMeeting, endMs: number, autoClosed: "elapsed_cap" | "wall_cap" | null, ): Fina; export function finalizeActive(now: number): FinalizeResult; export async function finalizeMeeting( meeting: ContractMeeting, finalizeMode: "confirmed" | "discarded", ): Promise<Con
- format.ts: export function formatWon(won: number): string; export function formatHMS(seconds: number): string; export function formatMinutes(minutes: number): string; export function formatMonthDay(date: Date): string; export function toLocalDateKey(date: Date): string; export function formatDuration(durationMs: number): string; export function formatPrice(amountKrw: number, opts?:
- meetingLifecycle.ts: export type StartResult = |; export function startMeeting(setup: MeetingSetupInput, now: number): StartResult; export function pauseMeeting(now: number): SaveResult; export function resumeMeeting(now: number): SaveResult
- meetingTime.ts: export type CapReason = "elapsed_cap" | "wall_cap"; export type StaleDetail = |; export function getElapsedSec(active: TimeFields, now: number): number; export function getCapAt(active: TimeFields):; export function resolveStale(active: TimeFields, now: number): StaleResult & StaleDetail; export function localDateKeysBetween( startMs: number | Date, endMs: number | Date, ): string[]
- messages.ts: export const QUOTA_TOAST = "저장 공간이 부족해요. 오래된 기록을 삭제해주세요"; export const TOO_SHORT = "10초 미만 회의는 저장되지 않아요"; export const NO_MEETING_CANCELLED = "오늘 회의가 기록되어 '회의 없는 날'이 취소됐어요"; export const AUTO_CLOSED_8H = "8시간이 지나 회의를 자동 종료했어요"; export const AUTO_CLOSED_12H = "12시간이 지나 회의를 자동 종료했어요"; export const RESTART_SAVED = "이전 회의를 저장했어요. 회고는 기록 탭에서 입력할 수 있어요"; export const NO_ACTIVE_MEETING = "진행 중인 회의가 없어요"; export const RECORD_DELETED = "기록을 삭제했어요"
- ranking.ts: export function rankTeams(records: MeetingRecord[], now: Date): TeamRank[]
- schema.ts: export function isMeetingSetupInput(v: unknown): v is MeetingSetupInput; export function isMeetingSetup(v: unknown): v is MeetingSetup; export function isActiveMeeting(v: unknown): v is Acti...
CRITICAL: Before creating any new function, type, or component, check the list above. If something similar exists, import and use it.

## Already Implemented (do NOT duplicate or overwrite)
- 0001: 엔티티 타입, RouteState 계약, 전역 상수 (files: src/lib/types.ts, src/lib/constants.ts)
- 0002: 비용 계산, 표시 포맷, 사용자 문구 순수 함수 (files: src/lib/cost.ts, src/lib/format.ts, src/lib/messages.ts, src/lib/__tests__/cost-format.test.ts)
- 0003: 회의 시간 상한/날짜 범위 함수와 스키마 검증 (files: src/lib/meetingTime.ts, src/lib/schema.ts, src/lib/__tests__/meetingTime.test.ts, src/lib/__tests__/schema.test.ts)
- 0004: 저장소 계층 (안전 읽기/쓰기, CRUD, 페이지 조회, storage.ts 공개 모듈) (files: src/lib/storageBase.ts, src/lib/storageRecords.ts, src/lib/storage.ts, src/lib/__tests__/storage.test.ts, src/lib/__tests__/failSetItemOnNth.ts)
- 0005: 회의 수명주기 (startMeeting, 일시정지/재개, finalizeActive 롤백, autoFinalizeStale) (files: src/lib/finalize.ts, src/lib/autoFinalize.ts, src/lib/meetingLifecycle.ts, src/lib/__tests__/meetingLifecycle.test.ts)
- 0007: 홈 이번 주 합계와 공유 카드 텍스트/캔버스 렌더러 (files: src/lib/weekSummary.ts, src/lib/shareCard.ts, src/lib/__tests__/weekSummary-shareCard.test.ts)
- 0008: 상태 훅 (useActiveMeeting, useNow, useToastQueue, useRecordParam, RecordNotFound) (files: src/hooks/useNow.ts, src/hooks/useActiveMeeting.ts, src/hooks/useToastQueue.ts, src/hooks/useRecordParam.ts, src/components/RecordNotFound.tsx)
- 0009: S2 설정 폼 조각 (입력, 범위 검증, 시급 미리보기) (files: src/components/setup/SetupForm.tsx, src/components/setup/__tests__/SetupForm.test.tsx)
- 0011: S3 타이머 표시 조각 (실시간 비용, 경과 시간, 초과 표시) (files: src/components/meeting/TimerDisplay.tsx, src/components/meeting/__tests__/TimerDisplay.test.tsx)

## Available exports from existing files
// src/App.tsx
export default function App() {

// src/components/AdSlot.tsx
export function AdSlot({ adGroupId, className, variant, theme }: AdSlotProps) {

// src/components/Amount.tsx
export function Amount({

// src/components/BottomCTA.tsx
export function SubmitFooter({
export function ButtonStack({

// src/components/Card.tsx
export function Card({

// src/components/CountUp.tsx
export function CountUp({

// src/components/FloatingTabBar.tsx
export type TabItem = {
export function FloatingTabBar({ items }: { items: TabItem[] }) {

// src/components/MiniBar.tsx
export function MiniBar({

// src/components/PageShell.tsx
export function PageShell({ children, style }: { children: ReactNode; style?: CSSProperties }) {

// src/components/RecordNotFound.tsx
export function RecordNotFound() {
export default RecordNotFound;

// src/components/ScreenScaffold.tsx
export function ScreenScaffold({

// src/components/Sparkline.tsx
export function Sparkline({

// src/components/StateView.tsx
export function EmptyState({
export function LoadingState({

// src/components/SummaryHero.tsx
export function SummaryHero({

// src/components/TossPurchase.tsx
export interface TossPurchaseResult {
export function TossPurchase({

// src/components/TossRewardAd.tsx
export function TossRewardAd({

// src/components/meeting/TimerDisplay.tsx
export function TimerDisplay({ active, now }: { active: ActiveMeeting; now: number }) {
export default TimerDisplay;

// src/components/setup/SetupForm.tsx
export function SetupForm({
export default SetupForm;

// src/hooks/useActiveMeeting.ts
export function useActiveMeeting(): {

// src/hooks/useNow.ts
export function useNow(intervalMs = 1000): number {

// src/hooks/useRecordParam.ts
export function useRecordParam(): MeetingRecord | null {

// src/hooks/useToastQueue.ts
export function useToastQueue(): {

// src/lib/autoFinalize.ts
export function resetAutoFinalizeRetries(): void {
export function autoFinalizeStale(now: number): AutoFinalizeResult {


## Memory Index (자동 학습 — 힌트로만 사용, 실제 코드 확인 필수)

Available topics: deploy(4), general(13), testing(2), ui(3)

Key lessons (verify against actual code before applying):
- [general] 파일 생성 전 디렉토리 구조 확인 — mkdir -p로 경로 보장 (60% · 타 앱 1회 — 맹신 금지)
- [general] 화면·라우팅 등 소비자 모듈은 그것이 import하는 생산자 모듈이 병합된 뒤에만 병합하고, 순서를 지킬 수 없으면 소비자 병합과 동시에 최소 플레이스홀더를 만들어 매 병합 직후 타입체크와 빌드가 항상 통과하도록 유지하라. (60% · 타 앱 1회 — 맹신 금지)
- [general] 전역 라우팅·탭바·Provider 배선은 개별 화면보다 먼저(초반 20% 안에) 완료하고 미구현 화면은 스텁 라우트로 연결해, 시간 예산이 소진돼도 앱이 항상 실행 가능한 상태를 유지하라. (60% · 타 앱 1회 — 맹신 금지)
- [general] 저장·데이터 접근 등 기반 계층 패킷은 이를 import 하는 화면 패킷보다 반드시 먼저 완료·병합하고, 미완료면 상위 화면 패킷 병합을 차단하라 — 빈 기반 모듈 하나가 전 라우트 스모크를 무너뜨린다. (60% · 타 앱 1회 — 맹신 금지)
- [general] 외부에서 들어온 모든 값(라우터 state, 로컬 저장소, 부분 입력 폼)은 사용 직전에 배열·객체 기본값으로 정규화하고, 테이블/맵 조회 결과는 존재 확인 후에만 하위 속성이나 length에 접근하라. (60% · 타 앱 1회 — 맹신 금지)