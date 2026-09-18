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
