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
// Domain types — add your app-specific types here
export {};

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
- storage.ts: export function getItem<T>(key: string): T | null; export function setItem<T>(key: string, value: T): void; export function removeItem(key: string): void
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

// src/lib/contract.ts
export type Meeting = { id: string; startedAt: string; state: 'active' | 'paused' | 'finalized'; pausedMs: number; hourlyRate: number; timezone: string };
export type Record = { id: string; meetingId: string; date: string; durationMs: number; costKrw: number; notes?: string };
export type RouteState = { screen: 'home' | 'setup' | 'meeting' | 'wrapup' | 'report' | 'card' | 'history' | 'challenge'; recordId?: string };
export type calculateCostFn = (durationMs: number, hourlyRateKrw: number) => number;
export type formatDurationFn = (durationMs: number) => string;
export type formatPriceFn = (amountKrw: number, opts?: { compact?: boolean }) => string;
export type createQueryFn = (opts: { meetingIds?: string[]; dateFrom?: string; dateTo?: string; limit?: number; offset?: number

## Memory Index (자동 학습 — 힌트로만 사용, 실제 코드 확인 필수)

Available topics: deploy(4), general(13), testing(2), ui(3)

Key lessons (verify against actual code before applying):
- [general] 파일 생성 전 디렉토리 구조 확인 — mkdir -p로 경로 보장 (60% · 타 앱 1회 — 맹신 금지)
- [general] 화면·라우팅 등 소비자 모듈은 그것이 import하는 생산자 모듈이 병합된 뒤에만 병합하고, 순서를 지킬 수 없으면 소비자 병합과 동시에 최소 플레이스홀더를 만들어 매 병합 직후 타입체크와 빌드가 항상 통과하도록 유지하라. (60% · 타 앱 1회 — 맹신 금지)
- [general] 전역 라우팅·탭바·Provider 배선은 개별 화면보다 먼저(초반 20% 안에) 완료하고 미구현 화면은 스텁 라우트로 연결해, 시간 예산이 소진돼도 앱이 항상 실행 가능한 상태를 유지하라. (60% · 타 앱 1회 — 맹신 금지)
- [general] 저장·데이터 접근 등 기반 계층 패킷은 이를 import 하는 화면 패킷보다 반드시 먼저 완료·병합하고, 미완료면 상위 화면 패킷 병합을 차단하라 — 빈 기반 모듈 하나가 전 라우트 스모크를 무너뜨린다. (60% · 타 앱 1회 — 맹신 금지)
- [general] 외부에서 들어온 모든 값(라우터 state, 로컬 저장소, 부분 입력 폼)은 사용 직전에 배열·객체 기본값으로 정규화하고, 테이블/맵 조회 결과는 존재 확인 후에만 하위 속성이나 length에 접근하라. (60% · 타 앱 1회 — 맹신 금지)