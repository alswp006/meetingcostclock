# SPEC — MeetingCostClock

> 참석자 수와 평균 연봉을 입력하면 회의가 진행되는 동안 쌓이는 인건비를 실시간으로 보여주는 직장인용 회의비용 계산기입니다 (앱인토스 미니앱).

---

## Common Principles

### 기술 스택 및 범위
- 기술 스택
  - Vite + React + TypeScript를 씁니다.
  - UI는 모두 `@toss/tds-mobile`로 만듭니다.
  - 라우팅은 `react-router-dom`을 씁니다.
  - 데이터는 `localStorage`에만 저장합니다.
- 서버와 외부 API는 **없습니다**. 모든 계산은 클라이언트의 순수 함수로 처리합니다.
- 템플릿에 이미 있는 다음 컴포넌트는 다시 설계하지 않고 그대로 씁니다.
  - `AdSlot`, `TossRewardAd`, `TossPurchase`
  - localStorage helper
  - `FloatingTabBar`, `ScreenScaffold`, `SubmitFooter`, `Card`
  - `SummaryHero`, `CountUp`, `Sparkline`, `MiniBar`
- 로그인은 토스 앱 세션을 그대로 씁니다. 사용자를 식별할 필요가 없으므로 `getIsTossLoginIntegratedService()`를 호출하지 않습니다.
- **생성형 AI를 쓰지 않습니다.**
  - "낭비 추정"은 아래에 정의한 **고정 규칙(결정적 수식)** 으로 계산합니다.
  - 그래서 AI 고지 의무 대상이 아니며, 화면에 "AI"라는 표현을 쓰지 않습니다.
- 인앱결제(IAP)와 프로모션 리워드(`grantPromotionReward`)는 이번 MVP 범위에서 뺍니다. 수익 모델은 광고만 씁니다.

### 비용 계산 규칙 (모든 기능 공통, F1에서 구현)
| 항목 | 정의 |
|---|---|
| 연간 근로시간 상수 | `ANNUAL_WORK_HOURS = 2080` (주 40시간 × 52주) |
| 1인 시급 | `floor(annualSalaryManwon × 10000 / 2080)` |
| 팀 시급 | `floor(attendees × annualSalaryManwon × 10000 / 2080)` |
| 분당 비용 | `floor(attendees × annualSalaryManwon × 10000 / (2080 × 60))` |
| 경과 N초 누적 비용 | `floor(attendees × annualSalaryManwon × 10000 × N / (2080 × 3600))` |
| 초과 시간(초) | `max(0, durationSec − plannedMinutes × 60)` |
| 초과 비용 | `costFor(overtimeSec)` (누적 비용 수식과 같음) |
| 기본 비용 | `totalCost − overtimeCost` |
| 결과 계수 | `decided`(결론 남) = 0, `partial`(일부 결론) = 0.25, `none`(결론 없음) = 0.5 |
| 낭비 추정액 | `overtimeCost + floor(baseCost × 결과 계수)` |
| 낭비율(%) | `round(wasteCost / totalCost × 100)` (totalCost가 0이면 0) |

**기준 예시 (테스트 픽스처):** 참석자 5명, 평균 연봉 5,000만 원, 예정 시간 30분, 실제 2,700초(45분)
- 1인 시급 24,038원, 팀 시급 120,192원, 분당 2,003원
- totalCost 90,144원, overtimeCost 30,048원, baseCost 60,096원
- 결과별 낭비 추정
  - `none`: 60,096원(67%)
  - `partial`: 45,072원(50%)
  - `decided`: 30,048원(33%)

### 회의 시간 상한 규칙 (모든 기능 공통, F1에서 구현)
| 항목 | 정의 |
|---|---|
| 최대 회의 시간 | `MAX_DURATION_SEC = 28800` (8시간, 일시정지 제외 경과) |
| 최대 벽시계 시간 | `MAX_WALL_MS = 43_200_000` (12시간, `startedAt`부터 일시정지 포함) |
| 경과 초 | `clamp(floor((now − startedAt − totalPausedMs − (pausedAt ? now − pausedAt : 0)) / 1000), 0, 28800)` |
| 경과 상한 도달 시각 `tA` | `startedAt + totalPausedMs + 28_800_000`. `pausedAt !== null`이고 `tA > pausedAt`이면 무효(∞)로 봅니다. |
| 벽시계 상한 도달 시각 `tB` | `startedAt + 43_200_000` |
| 종료 상한 시각 `capAt` | `min(tA, tB)` |
| 만료(stale) 판정 | `now ≥ capAt`. reason은 `capAt === tA`이면 `'elapsed_cap'`, 아니면 `'wall_cap'`입니다. |
| 종료 저장 시각 | `endAt = min(now, capAt)`, `durationSec = getElapsedSec(active, endAt)` → 항상 28,800 이하 |

### 날짜 범위 규칙 (모든 기능 공통, F1에서 구현)
- 회의가 "어떤 날짜에 걸쳐 있는가"는 **모든 곳에서** `localDateKeysBetween(startMs, endMs)` 하나로 판정합니다.
  - 반환값: `startMs`와 `endMs`의 로컬 날짜를 양 끝으로 포함하는 `YYYY-MM-DD` 배열 (오름차순)
  - `endMs < startMs`(기기 시계 역행)이면 `[startMs의 날짜 키]`를 반환합니다.
- 사용처
  - 저장된 기록: `localDateKeysBetween(Date.parse(startedAt), Date.parse(endedAt))`
  - 진행 중인 active: `localDateKeysBetween(active.startedAt, max(active.startedAt, now))`
  - F1 `finalizeActive`의 NoMeetingDay 취소(F7 AC-6)와 F7 AC-4의 선언 차단이 같은 함수를 쓰므로, 두 규칙은 항상 같은 날짜 집합을 봅니다.

### 표시 규칙
- 금액은 `toLocaleString('ko-KR')` 뒤에 "원"을 붙입니다. 예: `90,144원`
- 시간은 `HH:MM:SS` 형식으로 씁니다. 예: `00:45:00`
- 날짜와 시간은 기기의 로컬 시간을 기준으로 합니다. 날짜 키 형식은 `YYYY-MM-DD`입니다.

### UI 및 검수 공통
- 모든 화면은 `ScreenScaffold`로 감쌉니다. raw `div`로 페이지 골격을 만들지 않습니다.
- 1차 액션은 `SubmitFooter`(하단 고정) 또는 `Button display="block"`으로 만듭니다.
- 간격은 TDS `Spacing`(size prop 필수)으로만 조절합니다. TDS 컴포넌트의 padding/margin을 덮어쓰지 않습니다.
- 색상은 `var(--tds-color-*)` 또는 TDS 컴포넌트로만 지정합니다. **HEX 하드코딩은 금지**하며, 다크모드를 지원해야 합니다.
- 터치할 수 있는 요소는 모두 44×44px 이상이어야 합니다.
- 하단 탭(홈 / 기록 / 챌린지)은 템플릿의 `src/components/FloatingTabBar`를 씁니다. 탭은 `/`, `/history`, `/challenge`에서만 노출합니다.
- 광고 배치
  - 배너(`AdSlot`): `/meeting` 하단, `/history` 목록 사이
  - 보상형(`TossRewardAd`): 리포트 첫 열람, 공유 카드 생성
  - 광고는 콘텐츠와 겹치지 않아야 합니다.

---

## Data Models

### 공통 규칙
- **테이블(저장 엔티티)은 아래 5개뿐입니다.** 각 테이블은 localStorage 키 1개에 대응하며, 모든 행은 다음 3개 필드를 **필수(NOT NULL)** 로 가집니다.
  - `id: string` — 기본키(PK). 빈 문자열은 허용하지 않습니다.
  - `createdAt: string` — ISO 8601. 처음 저장할 때 한 번만 정합니다.
  - `updatedAt: string` — ISO 8601. 해당 행을 쓸 때마다 `new Date().toISOString()`으로 갱신합니다. 항상 `updatedAt ≥ createdAt`입니다.
- 새 id는 `newId()`로 만듭니다(F1). `crypto.randomUUID`가 있으면 쓰고, 없으면 `` `${Date.now()}-${Math.random().toString(36).slice(2,8)}` ``를 씁니다.
- 테이블이 아닌 타입(`MeetingSetupInput`, `Page<T>`, `TeamRank`, 열거형)은 아래 **"비저장 타입"** 절에 따로 정의합니다. 이 타입들은 localStorage 키가 없고 행으로 저장되지 않으므로 id/createdAt/updatedAt을 두지 않으며, 스키마(테이블) 검증 대상이 아닙니다.
- localStorage에는 DB 엔진이 없습니다. 그래서 PK 고유성, CHECK 제약, 정렬(인덱스)은 **저장소 계층(`src/lib/storage.ts`)이 쓰기와 읽기에서 모두 강제**합니다. 아래 "제약 조건과 강제 방식", "인덱스와 조회 경로" 절을 따릅니다.

### 테이블 목록
| 테이블 | 저장 키 | PK | 고유 제약 | 저장 순서 (기본 인덱스) | 행 수 | 크기 |
|---|---|---|---|---|---|---|
| MeetingSetup | `mcc:v1:lastSetup` | `id = 'lastSetup'` | 싱글턴 (행 1개) | — | 0~1 | 약 300B |
| ActiveMeeting | `mcc:v1:active` | `id` (`newId()`) | 행 최대 1개 | — | 0~1 | 약 400B |
| MeetingRecord | `mcc:v1:records` | `id` (= 원래 ActiveMeeting.id) | `id` 고유 | `endedAt` 내림차순, 같으면 `id` 오름차순 | 0~500 (강제) | 약 260KB |
| NoMeetingDay | `mcc:v1:noMeetingDays` | `id` (= `date`, 자연키) | `id` 고유, `id === date` | `date` 오름차순 | 추정 상한 약 1,000 (삭제 강제 없음) | 약 150KB |
| EarnedBadge | `mcc:v1:badges` | `id` (= `badgeId`, 자연키) | `id` 고유, `id === badgeId` | `createdAt` 오름차순 | 0~5 | 약 500B |

### MeetingSetup — 마지막 설정 (싱글턴)
```ts
interface MeetingSetup extends MeetingSetupInput {
  id: 'lastSetup';            // PK. 싱글턴 고정 id
  createdAt: string;          // ISO 8601, 최초 저장 시각
  updatedAt: string;          // ISO 8601, "회의 시작"마다 갱신
}
```
- 저장 키: `mcc:v1:lastSetup` → `MeetingSetup | 키 없음` (마지막 입력값, 폼 프리필용)
- CHECK: 상속 필드는 `MeetingSetupInput`의 범위를 따릅니다.

### ActiveMeeting — 진행 중인 회의 (최대 1개)
```ts
interface ActiveMeeting {
  id: string;                 // PK. newId(). 종료 저장 시 MeetingRecord.id로 그대로 이어짐
  setup: MeetingSetupInput;   // 값 스냅샷 (FK 아님)
  startedAt: number;          // epoch ms (경과 계산용), 정수
  pausedAt: number | null;    // 일시정지 시작 epoch ms, 진행 중이면 null. null이 아니면 ≥ startedAt
  totalPausedMs: number;      // 누적 일시정지 ms, 정수 ≥ 0, 초기값 0
  createdAt: string;          // ISO 8601, 회의 시작 시각 (= new Date(startedAt).toISOString())
  updatedAt: string;          // ISO 8601, 일시정지/재개마다 갱신
}
```
- 저장 키: `mcc:v1:active` → `ActiveMeeting | null`
- 경과 초와 상한은 "회의 시간 상한 규칙"을 따릅니다(28,800으로 clamp).

### MeetingRecord — 종료된 회의 기록
```ts
interface MeetingRecord {
  id: string;                 // PK. = 원래 ActiveMeeting.id
  title: string;              // 1~30자 (저장 시 빈 값은 "이름 없는 회의")
  teamName: string;           // 1~20자 (저장 시 빈 값은 "우리 팀"). 랭킹 그룹 키
  attendees: number;          // 정수 2~100
  annualSalaryManwon: number; // 정수 1,000~50,000
  plannedMinutes: number;     // 정수 5~480
  startedAt: string;          // ISO 8601
  endedAt: string;            // ISO 8601 (= min(종료 시각, capAt)), Date.parse(endedAt) ≥ Date.parse(startedAt)
  durationSec: number;        // 정수 10 ~ 28,800
  totalCost: number;          // 원, 정수 ≥ 0
  outcome: MeetingOutcome | null;  // 회고 입력 전이면 null
  wasteCost: number | null;        // outcome이 null이면 null, 아니면 정수 ≥ 0 (둘은 함께 null이거나 함께 non-null)
  reportUnlocked: boolean;    // 리포트용 보상형 광고 시청 완료 여부
  shareUnlocked: boolean;     // 공유 카드용 보상형 광고 시청 완료 여부
  createdAt: string;          // ISO 8601, 기록 저장 시각
  updatedAt: string;          // ISO 8601, outcome/unlock 갱신마다 갱신
}
```
- 저장 키: `mcc:v1:records` → `MeetingRecord[]`
  - `endedAt` 내림차순(같으면 `id` 오름차순)으로 저장합니다. 이 순서가 기본 인덱스입니다.
  - `saveRecord`는 **id 기준 upsert**입니다. 같은 id가 있으면 그 항목을 교체하고(기존 `createdAt` 유지), 없으면 추가합니다.
  - 최대 500개까지 보관하며, 넘으면 가장 오래된 것(배열 끝)부터 삭제합니다. (기존 id를 교체하는 upsert는 개수가 늘지 않으므로 삭제가 일어나지 않습니다.)

### NoMeetingDay — 회의 없는 날 선언
```ts
interface NoMeetingDay {
  id: string;         // PK. = date ('YYYY-MM-DD'). 자연키
  date: string;       // 'YYYY-MM-DD' (로컬, 월~금만). CHECK: id === date
  createdAt: string;  // ISO 8601, 선언 시각
  updatedAt: string;  // ISO 8601, 선언 후 수정하지 않으므로 createdAt과 같음
}
```
- 저장 키: `mcc:v1:noMeetingDays` → `NoMeetingDay[]` (`date` 오름차순, 중복 없음)
- 쓰기 경로는 `declareNoMeetingDay`(추가, F7)와 `finalizeActive`(삭제, F1) 두 곳뿐입니다.

### EarnedBadge — 획득한 배지
```ts
interface EarnedBadge {
  id: string;         // PK. = badgeId (배지당 최대 1개)
  badgeId: BadgeId;   // CHECK: id === badgeId
  createdAt: string;  // ISO 8601, 획득 시각
  updatedAt: string;  // ISO 8601, 획득 후 수정하지 않으므로 createdAt과 같음
}
```
- 저장 키: `mcc:v1:badges` → `EarnedBadge[]` (`createdAt` 오름차순. 한 번 획득하면 삭제하지 않음)
- 쓰기 경로는 `declareNoMeetingDay`(F7) 한 곳뿐입니다.

### 참조 관계 (논리적 FK)
- **어떤 테이블도 다른 테이블의 id를 컬럼으로 저장하지 않습니다.** 그래서 삭제 후에 존재하지 않는 행을 가리키는 참조(dangling FK)가 생길 수 없습니다.
- 테이블 사이의 관계는 모두 아래 표의 논리적 관계이며, 참조 대상은 모두 위 5개 테이블 안에 있습니다.

| 참조하는 쪽 | 참조 대상 (테이블.컬럼) | 관계 종류 | 무결성 규칙 |
|---|---|---|---|
| `MeetingRecord.id` | `ActiveMeeting.id` | 계보(lineage), 1 : 0..1 | `finalizeActive`가 같은 id로 기록을 만든 뒤 active를 null로 둡니다. 같은 id가 records와 active에 동시에 있는 상태는 "2단계 후 중단" 복구 상태에서만 허용되며, 다음 `finalizeActive`의 upsert로 해소됩니다(F1 AC-12). |
| `ActiveMeeting.setup`, `MeetingRecord`의 설정 필드 | `MeetingSetup`의 입력 필드 | 값 복사(스냅샷). FK 아님 | lastSetup이 바뀌어도 active와 기록은 영향이 없습니다. |
| `NoMeetingDay.date` | `MeetingRecord.startedAt ~ endedAt`의 로컬 날짜 범위 | 파생 관계 (저장된 참조 없음) | 기록 저장 시 겹치는 날짜의 선언을 삭제합니다(연쇄). 기록 삭제 시 복원하지 않습니다. |
| `EarnedBadge.badgeId` | `NoMeetingDay` 집합 | 파생 관계 (획득 시점 평가) | 선언 취소나 기록 삭제로 회수하지 않습니다. |
| 라우트 파라미터 `:id` | `MeetingRecord.id` | 조회 참조 | `getRecord(id)`가 null이면 F4 AC-7 화면을 표시합니다. |

### 제약 조건과 강제 방식
| 제약 | 대상 | 쓰기 시 강제 | 읽기 시 강제 (F1 AC-20) |
|---|---|---|---|
| PK 고유 | MeetingRecord.id | `saveRecord` upsert | 중복 id는 `updatedAt`이 가장 늦은 행 1개만 남김 (같으면 배열 앞쪽) |
| PK 고유 | NoMeetingDay.id | `declareNoMeetingDay`가 이미 있으면 `already_declared` | 중복 id는 `createdAt`이 가장 이른 행 1개만 남김 |
| PK 고유 | EarnedBadge.id | `evaluateBadges`가 이미 받은 배지를 반환하지 않음 | 중복 id는 `createdAt`이 가장 이른 행 1개만 남김 |
| 자연키 일치 | NoMeetingDay `id === date`, EarnedBadge `id === badgeId` | 생성 함수가 같은 값으로 채움 | 불일치 행은 버림 |
| 싱글턴 id | MeetingSetup `id === 'lastSetup'` | `saveLastSetup`이 고정 | 불일치면 `null` |
| 필수 필드·타입 | 모든 테이블 (id, createdAt, updatedAt 포함) | 타입이 있는 저장 함수만 사용 | 필드 누락, 타입 불일치, `Date.parse`가 NaN인 ISO 값이 있는 행은 버림 |
| 범위 CHECK | 위 각 인터페이스 주석의 범위 | F2 폼 검증, `finalizeActive`의 `too_short` | 범위를 벗어난 행은 버림 |
| 짝 CHECK | MeetingRecord `outcome`/`wasteCost` | F4 AC-2가 두 필드를 함께 patch | 한쪽만 null인 행은 버림 |
| 정렬 | records, noMeetingDays, badges | 쓰기 전에 정렬 | 읽을 때 다시 정렬 |
| 상한 | records 500건 | `saveRecord`가 끝에서 제거 | 500건 초과분은 앞 500건만 사용 |

- 읽기 시 강제는 **메모리의 반환값에만** 적용합니다. 읽기 함수는 `setItem`/`removeItem`을 호출하지 않습니다. 정규화된 배열은 해당 키의 다음 쓰기 때 저장됩니다.
- 버린 행이 있어도 `console.error`를 호출하지 않고, `Page.error`도 넣지 않습니다(`error`는 JSON 파싱 실패, 배열 아님, `getItem` 예외에만 씀).
- `loadActive()`와 `loadLastSetup()`은 값이 제약을 어기면 `null`을 반환합니다.

### 인덱스와 조회 경로
localStorage에는 보조 인덱스를 만들 수 없습니다. 대신 **저장 순서를 기본 인덱스로 쓰고**, 기간 조회는 정렬을 이용해 앞부분(prefix)만 읽습니다. 별도 인덱스 키는 만들지 않습니다(여러 키 쓰기로 인한 불일치를 피하기 위함).

| 조회 | 사용 컬럼 | 접근 경로 | 비용 (n ≤ 500) |
|---|---|---|---|
| `loadRecordsPage(page, size)` | `endedAt` 내림차순 | 정렬된 배열을 `slice` | O(size) (파싱 제외) |
| `getRecord` / `updateRecord` / `deleteRecord` / `saveRecord` upsert | `id` | `findIndex` 선형 탐색 | O(n) |
| `rankTeams(..., 'thisMonth')` | `endedAt`, `teamName` | `takeEndedSince(records, 이번 달 1일 00:00)` prefix → `teamName` 기준 `Map` 1회 집계 | O(prefix) |
| `rankTeams(..., 'all')` | `teamName` | `Map` 1회 집계 | O(n) |
| 홈 이번 주 합계 (F8 AC-1) | `endedAt` | `takeEndedSince(records, 이번 주 월요일 00:00)` prefix | O(prefix) |
| `hasMeetingOn(dateKey, ...)` | `startedAt`, `endedAt` | `takeEndedSince(records, dateKey의 00:00)` prefix 안에서 `localDateKeysBetween` 검사 | O(prefix) |
| 오늘 선언 여부, 배지 획득 여부 | NoMeetingDay `date`, EarnedBadge `badgeId` | 화면 진입 시 `Set`으로 변환 | O(1) 조회 |
| `outcome` 분기 (F4 AC-9, F5 AC-2) | `outcome` | 단건 조회 후 필드 확인 (목록 필터 없음) | O(1) |

- `takeEndedSince`가 정확하려면 입력 배열이 `endedAt` 내림차순이어야 합니다. `loadRecords()`는 이 순서를 보장합니다(F1 AC-20). `endedAt`이 `sinceMs`보다 이른 기록은 그 날짜 이후를 포함할 수 없으므로 prefix만 보면 충분합니다.

### 비저장 타입 (테이블 아님)
이 타입들은 localStorage 키가 없고, 테이블 컬럼의 타입이나 함수 인자/반환 타입으로만 쓰입니다.
```ts
// 값 객체: ActiveMeeting.setup에 포함되거나 location.state.prefill로 전달됨
interface MeetingSetupInput {
  title: string;              // 0~30자, 비면 "이름 없는 회의"로 저장
  teamName: string;           // 0~20자, trim 후 비면 "우리 팀"으로 저장
  attendees: number;          // 정수 2~100
  annualSalaryManwon: number; // 정수 1,000~50,000 (만 원 단위)
  plannedMinutes: number;     // 정수 5~480, 기본값 30
}

// 열거형
type MeetingOutcome = 'decided' | 'partial' | 'none';
type BadgeId = 'first_free_day' | 'streak_3' | 'total_5' | 'total_10' | 'total_20';

// 조회 결과 (파생)
interface Page<T> {
  items: T[];
  total: number;       // 전체 항목 수
  page: number;        // 1부터 시작
  error?: 'corrupted' | 'unavailable'; // 읽기 실패 시에만 존재 (이때 items=[], total=0)
}

interface TeamRank {
  rank: number;         // 1부터 시작
  teamName: string;     // MeetingRecord.teamName 그룹 키
  totalCost: number;    // 원
  count: number;        // 회의 횟수
  sharePercent: number; // round(totalCost / 전체 합계 × 100)
}
```

### 엔티티 관계 및 연쇄(cascade) 규칙
| 트리거 | 대상 | 동작 |
|---|---|---|
| "회의 시작"(F2 AC-2) | MeetingSetup | 입력값으로 `mcc:v1:lastSetup`을 덮어씁니다(id `'lastSetup'`). 처음 저장이면 createdAt을 정하고, 매번 updatedAt을 갱신합니다. |
| "회의 시작"(F2 AC-2) | ActiveMeeting | `newId()`로 새로 만듭니다. `setup`에는 입력값을 **복사**하므로, 나중에 lastSetup이 바뀌어도 영향이 없습니다. |
| 종료 저장(`finalizeActive`, ok) | ActiveMeeting → MeetingRecord | **`MeetingRecord.id = ActiveMeeting.id`**, setup 필드는 그대로 복사합니다. startedAt은 ISO로 변환합니다. createdAt과 updatedAt은 저장 시각입니다. `saveRecord`(upsert)로 저장한 뒤 `mcc:v1:active = null`로 둡니다. |
| 종료 저장(`finalizeActive`, ok) | NoMeetingDay | `localDateKeysBetween(기록 startedAt, 기록 endedAt)`에 속하는 `date`의 NoMeetingDay를 **삭제**합니다(F7 AC-6). |
| 종료 저장(`finalizeActive`, ok) | EarnedBadge | **변경 없음**. 이미 받은 배지는 유지합니다. |
| 종료 저장 실패(`too_short`) | ActiveMeeting | 기록 없이 `mcc:v1:active = null`로 둡니다. NoMeetingDay와 EarnedBadge는 변경하지 않습니다. |
| 종료 저장 실패(`quota`) | 전체 | 아무것도 바꾸지 않습니다. 아래 "쓰기 순서와 롤백"으로 보장합니다. ActiveMeeting은 유지됩니다. |
| 기록 갱신(outcome, unlock) | MeetingRecord | 해당 필드와 `updatedAt`만 갱신합니다. 다른 엔티티는 변경하지 않습니다. |
| 기록 갱신 실패(`quota`/`unknown`/`not_found`) | 전체 | 아무것도 바꾸지 않습니다(`updateRecord`는 키 1개만 씀). |
| 기록 삭제(F5 AC-8, AC-13) | NoMeetingDay, EarnedBadge, MeetingSetup | **변경 없음**. 삭제한 기록 때문에 취소됐던 선언도 복원하지 않습니다. |
| 500건 초과로 오래된 기록 제거(F1 AC-5) | NoMeetingDay, EarnedBadge | **변경 없음** (기록 삭제와 같음) |
| 회의 없는 날 선언(`declareNoMeetingDay`, ok) | NoMeetingDay, EarnedBadge | NoMeetingDay 1행을 추가하고, `evaluateBadges` 결과로 새 배지를 추가합니다. |
| 회의 없는 날 선언 실패(`quota`/`unknown`) | 전체 | 아무것도 바꾸지 않습니다. 아래 "`declareNoMeetingDay` 쓰기 순서와 롤백"으로 보장합니다. |

### `finalizeActive` 쓰기 순서와 롤백
`finalizeActive`는 여러 키를 쓰므로 다음 순서와 롤백 규칙을 따릅니다.
1. **스냅샷:** 쓰기 전에 `mcc:v1:noMeetingDays`, `mcc:v1:records`, `mcc:v1:active`의 원본 문자열(키가 없으면 `null`)을 메모리에 보관합니다.
2. **쓰기 순서** (`ok` 경로)
   1. `mcc:v1:noMeetingDays`: 취소할 날짜를 뺀 배열을 씁니다. 취소 대상이 없으면 이 단계는 건너뜁니다.
   2. `mcc:v1:records`: `saveRecord(record)`로 씁니다(id upsert).
   3. `mcc:v1:active`: `null`로 씁니다.
3. **롤백:** 어느 단계의 `setItem`이 예외를 던지면, 그 앞에서 이미 쓴 키를 **역순으로** 스냅샷 값으로 되돌립니다(스냅샷이 `null`이면 `removeItem`). 그런 다음 `{ ok: false, reason: 'quota' }`를 반환합니다.
   - 이 순서에서는 되돌리는 쓰기가 앞 단계에서 비운 공간만 다시 쓰거나 공간을 줄이기만 합니다. 그래서 롤백 쓰기는 용량 초과를 일으키지 않습니다.
4. **재시도 안전성:** 앱이 2단계와 3단계 사이에서 강제 종료되어 records와 active에 같은 id가 남아도, 다음 `finalizeActive`는 upsert로 같은 id를 교체합니다. NoMeetingDay 삭제는 멱등입니다. 그래서 기록이 중복되지 않습니다.
5. `too_short` 경로는 `mcc:v1:active = null` 한 번만 씁니다. 이 쓰기가 실패하면 `{ ok: false, reason: 'quota' }`를 반환하고 아무것도 바꾸지 않습니다.

### `declareNoMeetingDay` 쓰기 순서와 롤백
1. **스냅샷:** `mcc:v1:noMeetingDays`의 원본 문자열(없으면 `null`)을 보관합니다.
2. **쓰기 순서**
   1. `mcc:v1:noMeetingDays`: 새 행을 추가하고 `date` 오름차순으로 정렬한 배열을 씁니다.
   2. `mcc:v1:badges`: `evaluateBadges`가 새 배지를 반환했을 때만 기존 배열 뒤에 추가해 씁니다. 없으면 건너뜁니다.
3. **롤백:** 2단계가 실패하면 `mcc:v1:noMeetingDays`를 스냅샷으로 되돌리고(스냅샷이 `null`이면 `removeItem`), `QuotaExceededError`면 `quota`, 그 밖의 예외면 `unknown`을 반환합니다. 1단계가 실패하면 쓴 키가 없으므로 그대로 실패를 반환합니다.

### 전체 용량 추정
약 420KB 이하로, 5MB 한도의 9% 미만입니다.

---

## Feature List

### F1. 비용 계산 엔진, 저장소 계층, 회의 수명주기
- **Description:**
  - 시급 환산, 누적 비용, 낭비 추정 수식을 부수효과 없는 순수 함수(`src/lib/cost.ts`)로 구현합니다.
  - 경과 시간, 8시간/12시간 상한, 만료 판정, 로컬 날짜 범위는 순수 함수(`src/lib/meetingTime.ts`)로 만듭니다.
  - localStorage 읽기/쓰기는 타입이 있는 저장소 모듈(`src/lib/storage.ts`)로 감쌉니다. 이 모듈이 Data Models의 PK 고유성, CHECK 제약, 정렬을 쓰기와 읽기 양쪽에서 강제합니다.
  - 정렬된 기록 배열을 이용한 기간 조회 헬퍼는 `src/lib/recordIndex.ts`에 둡니다.
  - 회의 종료 저장과 연쇄 규칙은 `src/lib/meetingLifecycle.ts`의 `finalizeActive` **한 곳**에서만 처리합니다. 쓰기 순서와 롤백은 Data Models의 "`finalizeActive` 쓰기 순서와 롤백"을 따릅니다.
  - 상한에 도달한 회의의 자동 종료는 `autoFinalizeStale` **한 곳**에서만 처리하며, 저장 공간 부족 시 재시도 횟수를 세션 단위로 제한합니다.
  - 손상된 JSON이나 용량 초과 상황에서도 앱이 죽지 않도록 방어합니다.
- **Data:** MeetingSetup, ActiveMeeting, MeetingRecord, NoMeetingDay, EarnedBadge
- **API:** 없음 (내부 함수만)
  - 계산 (`cost.ts`)
    - `calcHourly(attendees: number, salaryManwon: number): { perPerson: number; team: number; perMinute: number }`
    - `calcCost(attendees: number, salaryManwon: number, sec: number): number`
    - `calcWaste(record: Pick<MeetingRecord,'attendees'|'annualSalaryManwon'|'plannedMinutes'|'durationSec'|'totalCost'>, outcome: MeetingOutcome): { overtimeSec: number; overtimeCost: number; wasteCost: number; wasteRate: number }`
  - 시간 (`meetingTime.ts`)
    - `getElapsedSec(active: ActiveMeeting, now: number): number` — 반환값은 항상 `0 ≤ x ≤ 28800`
    - `getCapAt(active: ActiveMeeting): number` — epoch ms, "회의 시간 상한 규칙"의 `capAt`
    - `resolveStale(active: ActiveMeeting, now: number): { stale: false } | { stale: true; reason: 'elapsed_cap' | 'wall_cap'; endedAtMs: number; durationSec: number }`
    - `localDateKeysBetween(startMs: number, endMs: number): string[]` — "날짜 범위 규칙" 참고
  - 공통 (`storage.ts`)
    - `newId(): string`
    - `type SaveResult = { ok: true } | { ok: false; reason: 'quota' | 'unknown' | 'not_found' }`
  - 저장소 (`storage.ts`)
    - `loadLastSetup(): MeetingSetup | null`
    - `saveLastSetup(input: MeetingSetupInput): SaveResult`
    - `loadActive(): ActiveMeeting | null`
    - `saveActive(a: ActiveMeeting): SaveResult`
    - `clearActive(): void`
    - `loadRecords(): MeetingRecord[]` — 제약을 통과한 행만, id 중복 없이, `endedAt` 내림차순으로 반환 (AC-20)
    - `loadRecordsPage(page: number, size: number): Page<MeetingRecord>`
    - `getRecord(id: string): MeetingRecord | null`
    - `saveRecord(r: MeetingRecord): SaveResult` — **id 기준 upsert**. 같은 id가 있으면 교체하고 기존 `createdAt`을 유지함
    - `updateRecord(id: string, patch: Partial<Omit<MeetingRecord,'id'|'createdAt'>>): SaveResult` — `updatedAt` 자동 갱신. 없는 id면 `not_found`
    - `deleteRecord(id: string): SaveResult`
    - `loadNoMeetingDays(): NoMeetingDay[]` — id 중복 없이 `date` 오름차순 (AC-20)
    - `loadBadges(): EarnedBadge[]` — id 중복 없이 `createdAt` 오름차순 (AC-20)
    - `writeNoMeetingDays(days: NoMeetingDay[]): SaveResult`, `writeBadges(badges: EarnedBadge[]): SaveResult` — 내부 전용. `finalizeActive`와 `declareNoMeetingDay`(F7)만 호출함
  - 조회 헬퍼 (`recordIndex.ts`)
    - `takeEndedSince(records: MeetingRecord[], sinceMs: number): MeetingRecord[]` — `endedAt` 내림차순 배열에서 `Date.parse(endedAt) ≥ sinceMs`인 가장 긴 앞부분(prefix)을 반환. 조건을 어기는 첫 항목에서 탐색을 멈춤
  - 수명주기 (`meetingLifecycle.ts`)
    - `type FinalizeResult = { ok: true; record: MeetingRecord; cancelledNoMeetingDates: string[]; autoClosed: null | 'elapsed_cap' | 'wall_cap' } | { ok: false; reason: 'no_active' | 'too_short' | 'quota' }`
    - `finalizeActive(now: number): FinalizeResult`
      - 화면 이동은 하지 않는 **저장 전용** 함수입니다. 이동은 호출하는 화면이 결정합니다.
    - `autoFinalizeStale(now: number): { status: 'not_stale' } | { status: 'suppressed' } | { status: 'done'; staleReason: 'elapsed_cap' | 'wall_cap'; result: FinalizeResult; showQuotaToast: boolean }`
      - active가 없거나 `resolveStale`이 `stale: false`면 `not_stale`을 반환하고 저장소에 쓰지 않습니다.
      - stale이면 `finalizeActive(now)`를 호출합니다. 단, **같은 `active.id`에 대해 세션당 최대 2회(최초 1회 + 재시도 1회)** 까지만 호출합니다.
      - 2회 모두 `quota`로 실패한 뒤에는 `suppressed`를 반환하고 `finalizeActive`를 호출하지 않습니다.
      - `showQuotaToast`는 해당 `active.id`의 **첫 번째** `quota` 실패에서만 `true`입니다.
      - 세션은 JS 런타임 수명입니다. 실패 횟수는 모듈 메모리(`Map<activeId, number>`)에만 두고 저장하지 않습니다. 새로고침하거나 새 회의(새 id)를 시작하면 다시 2회를 시도할 수 있습니다.
      - 사용자가 직접 누르는 "회의 종료"(F4 AC-1, AC-10)와 "종료하고 새로 시작"(F2 AC-7)은 이 제한 없이 `finalizeActive`를 직접 호출합니다.
    - `resetAutoFinalizeSession(): void` — 테스트 전용. 실패 횟수를 비웁니다.
- **Requirements:**
  - **AC-1 [U][P0]: Scenario: 시급 환산**
    - Given `calcHourly(5, 5000)` 호출
    - Then `{ perPerson: 24038, team: 120192, perMinute: 2003 }`를 반환함
  - **AC-2 [U][P0]: Scenario: 누적 비용 계산**
    - Given `calcCost(5, 5000, 2700)` 호출
    - Then `90144`를 반환함
    - And `calcCost(5, 5000, 0)`은 `0`을 반환함
  - **AC-3 [U][P0]: Scenario: 낭비 추정**
    - Given `{ attendees: 5, annualSalaryManwon: 5000, plannedMinutes: 30, durationSec: 2700, totalCost: 90144 }`
    - When `calcWaste(..., 'none')` 호출
    - Then `{ overtimeSec: 900, overtimeCost: 30048, wasteCost: 60096, wasteRate: 67 }`를 반환함
    - And `'partial'`이면 wasteCost `45072`, `'decided'`이면 wasteCost `30048`
  - **AC-4 [S][P0]: Scenario: 일시정지 중 경과 시간 고정**
    - Given `{ startedAt: 1_000_000, pausedAt: 1_060_000, totalPausedMs: 0 }`
    - When `getElapsedSec(active, 1_120_000)` 호출
    - Then `60`을 반환함 (일시정지 이후 60초는 제외)
  - **AC-5 [E][P0]: Scenario: 기록 저장 및 500건 상한**
    - Given `mcc:v1:records`에 기록이 500건 있을 때
    - When 새 id의 `saveRecord(newRecord)` 호출
    - Then 배열 길이는 500으로 유지됨
    - And index 0이 newRecord이고, endedAt이 가장 오래된 기록이 제거됨
    - And `mcc:v1:noMeetingDays`와 `mcc:v1:badges`의 값은 호출 전과 문자열이 같음
  - **AC-6 [W][P1]: Scenario: 손상된 데이터 방어**
    - Given `mcc:v1:records` 값이 `"{broken"`일 때
    - When `loadRecords()` 호출
    - Then 예외 없이 `[]`를 반환함
    - And `console.error`를 호출하지 않음
  - **AC-7 [W][P1]: Scenario: 저장 공간 부족**
    - Given `localStorage.setItem`이 `QuotaExceededError`를 던질 때
    - When `saveRecord()` 호출
    - Then `{ ok: false, reason: 'quota' }`를 반환함
    - And 호출한 화면은 토스트 "저장 공간이 부족해요. 오래된 기록을 삭제해주세요"를 표시함 (삭제 경로: F5 AC-13)
  - **AC-8 [S][P1]: Scenario: 저장소 비어 있음**
    - Given localStorage에 `mcc:v1:*` 키가 하나도 없을 때
    - Then 각 함수는 다음 값을 반환함
      - `loadRecords()`: `[]`
      - `loadActive()`: `null`
      - `loadLastSetup()`: `null`
      - `loadNoMeetingDays()`: `[]`
      - `loadBadges()`: `[]`
      - `loadRecordsPage(1, 20)`: `{ items: [], total: 0, page: 1 }` (`error` 없음)
  - **AC-9 [U][P0]: Scenario: 경과 시간 8시간 clamp**
    - Given `{ startedAt: 0, pausedAt: null, totalPausedMs: 0 }`
    - When `getElapsedSec(active, 32_400_000)` 호출 (벽시계 9시간)
    - Then `28800`을 반환함
    - And `getElapsedSec(active, -5_000)`(기기 시계가 되돌아간 경우)은 `0`을 반환함
  - **AC-10 [U][P0]: Scenario: 만료 판정 (resolveStale)**
    - Given 진행 중인 `{ startedAt: 0, pausedAt: null, totalPausedMs: 0 }`, `now = 32_400_000`
      - Then `{ stale: true, reason: 'elapsed_cap', endedAtMs: 28_800_000, durationSec: 28800 }`
    - Given 일시정지된 `{ startedAt: 0, pausedAt: 3_600_000, totalPausedMs: 0 }`, `now = 46_800_000`
      - Then `{ stale: true, reason: 'wall_cap', endedAtMs: 43_200_000, durationSec: 3600 }`
    - Given 진행 중인 `{ startedAt: 0, pausedAt: null, totalPausedMs: 18_000_000 }`, `now = 46_800_000`
      - Then `{ stale: true, reason: 'wall_cap', endedAtMs: 43_200_000, durationSec: 25200 }`
    - Given 진행 중인 `{ startedAt: 0, pausedAt: null, totalPausedMs: 0 }`, `now = 3_600_000`
      - Then `{ stale: false }`
  - **AC-11 [E][P0]: Scenario: finalizeActive 저장과 연쇄 규칙**
    - Given 다음 상태일 때
      - `mcc:v1:active = { id: "m1", setup: { attendees: 5, annualSalaryManwon: 5000, plannedMinutes: 30, ... }, startedAt: now − 2_700_000, pausedAt: null, totalPausedMs: 0 }`
      - startedAt과 now가 모두 로컬 2026-09-21
      - `mcc:v1:noMeetingDays`에 `{ id: "2026-09-21", ... }`가 있음
    - When `finalizeActive(now)` 호출
    - Then 반환값은 `{ ok: true, cancelledNoMeetingDates: ["2026-09-21"], autoClosed: null, record }`임
    - And `record`는 다음 값을 가짐
      - `id: "m1"`, `durationSec: 2700`, `totalCost: 90144`
      - `outcome: null`, `wasteCost: null`
      - `reportUnlocked: false`, `shareUnlocked: false`
      - `createdAt === updatedAt === endedAt === new Date(now).toISOString()`
    - And 저장소는 다음 상태가 됨
      - `mcc:v1:records[0].id === "m1"`
      - `mcc:v1:active === null`
      - `mcc:v1:noMeetingDays`에 `"2026-09-21"`이 없음
      - `mcc:v1:badges`는 호출 전과 문자열이 같음
    - And `setItem` 호출 순서는 `mcc:v1:noMeetingDays` → `mcc:v1:records` → `mcc:v1:active`임
    - Given 벽시계 9시간이 지난 진행 중 active일 때
      - Then `record.durationSec === 28800`, `record.endedAt`이 `startedAt + 8시간`, `autoClosed === 'elapsed_cap'`임
  - **AC-12 [W][P0]: Scenario: finalizeActive 실패와 롤백**
    - Given 경과 9초인 active
      - Then `{ ok: false, reason: 'too_short' }`를 반환함
      - And `mcc:v1:active`가 null이 되고, `mcc:v1:records`는 변경되지 않음
    - Given 모든 `setItem`이 `QuotaExceededError`를 던질 때
      - Then `{ ok: false, reason: 'quota' }`를 반환함
      - And `mcc:v1:active`는 호출 전과 같게 유지됨
    - Given 취소할 NoMeetingDay가 있는 active이고, `setItem`이 **두 번째 키(`mcc:v1:records`) 쓰기에서만** `QuotaExceededError`를 던질 때
      - Then `{ ok: false, reason: 'quota' }`를 반환함
      - And `mcc:v1:records`, `mcc:v1:active`, `mcc:v1:noMeetingDays`는 모두 호출 전과 문자열이 같음 (noMeetingDays는 롤백으로 복원됨)
    - Given `setItem`이 **세 번째 키(`mcc:v1:active`) 쓰기에서만** 예외를 던질 때
      - Then `{ ok: false, reason: 'quota' }`를 반환함
      - And 세 키 모두 호출 전과 문자열이 같음
    - Given 호출 전 `mcc:v1:records`에 이미 id `"m1"` 기록이 있고(이전 실행이 2단계 후 중단됨) active id도 `"m1"`일 때
      - Then `{ ok: true }`를 반환하고 `mcc:v1:records`에서 id가 `"m1"`인 항목은 정확히 1개임
    - Given active가 null일 때
      - Then `{ ok: false, reason: 'no_active' }`를 반환함
  - **AC-13 [U][P0]: Scenario: 기록 페이지 조회**
    - Given 기록 45건
    - Then `loadRecordsPage(size=20)` 결과는 다음과 같음
      - `page=1`: `{ items: <20건, index 0~19>, total: 45, page: 1 }`
      - `page=3`: `{ items: <5건>, total: 45, page: 3 }`
      - `page=4`: `{ items: [], total: 45, page: 4 }`
    - And `page < 1`은 1로, `size`는 1~100으로 보정함
  - **AC-14 [W][P1]: Scenario: 기록 읽기 실패 신호**
    - Given `mcc:v1:records`가 `"{broken"`이거나 배열이 아님
      - Then `loadRecordsPage(1, 20)`은 `{ items: [], total: 0, page: 1, error: 'corrupted' }`를 반환함
    - Given `localStorage.getItem`이 예외를 던짐
      - Then `{ items: [], total: 0, page: 1, error: 'unavailable' }`를 반환함
    - And 두 경우 모두 `console.error`를 호출하지 않음
  - **AC-15 [E][P1]: Scenario: 기록 삭제는 연쇄되지 않음**
    - Given 기록 `r1`과 NoMeetingDay 2건, EarnedBadge 1건이 있을 때
    - When `deleteRecord("r1")` 호출
    - Then `{ ok: true }`를 반환하고 records에서 `r1`이 제거됨
    - And `mcc:v1:noMeetingDays`, `mcc:v1:badges`, `mcc:v1:lastSetup`은 호출 전과 문자열이 같음
    - And 없는 id면 `{ ok: false, reason: 'not_found' }`를 반환함
    - And `setItem`이 예외를 던지면 `{ ok: false, reason: 'quota' | 'unknown' }`를 반환하고 records는 변경되지 않음
  - **AC-16 [U][P0]: Scenario: saveRecord id upsert**
    - Given records에 `{ id: "r1", totalCost: 100, createdAt: "2026-09-21T01:00:00.000Z" }`를 포함한 3건이 있을 때
    - When `saveRecord({ id: "r1", totalCost: 200, createdAt: "2026-09-21T09:00:00.000Z", ... })` 호출
    - Then `{ ok: true }`를 반환하고 배열 길이는 3임
    - And id가 `"r1"`인 항목은 1개이고, `totalCost: 200`, `createdAt: "2026-09-21T01:00:00.000Z"`(기존 값 유지)임
    - And 배열은 endedAt 내림차순을 유지함
    - And 500건이 찬 상태에서 기존 id를 upsert하면 길이 500이 유지되고, 다른 기록은 제거되지 않음
  - **AC-17 [W][P1]: Scenario: updateRecord 실패**
    - Given 없는 id로 `updateRecord("unknown", { outcome: 'none' })` 호출
      - Then `{ ok: false, reason: 'not_found' }`를 반환하고 `mcc:v1:records`는 호출 전과 문자열이 같음
    - Given `setItem`이 `QuotaExceededError`를 던질 때
      - Then `{ ok: false, reason: 'quota' }`를 반환하고 `mcc:v1:records`는 호출 전과 문자열이 같음
    - Given 그 밖의 예외를 던질 때
      - Then `{ ok: false, reason: 'unknown' }`을 반환하고 records는 변경되지 않음
    - Given 성공할 때
      - Then patch 필드와 `updatedAt`만 바뀌고 `createdAt`과 나머지 필드는 그대로임
  - **AC-18 [U][P0]: Scenario: 로컬 날짜 범위**
    - Then `localDateKeysBetween(<로컬 2026-09-21 23:00>, <로컬 2026-09-22 00:30>)`은 `["2026-09-21", "2026-09-22"]`를 반환함
    - And `localDateKeysBetween(<로컬 2026-09-21 10:00>, <로컬 2026-09-21 11:00>)`은 `["2026-09-21"]`을 반환함
    - And `endMs < startMs`이면 `[startMs의 날짜 키]`를 반환함
    - Given active `startedAt`이 로컬 2026-09-21 23:00, `endedAt`이 로컬 2026-09-22 00:30이고 두 날짜 모두 NoMeetingDay로 선언된 상태에서 `finalizeActive` 호출
      - Then `cancelledNoMeetingDates`는 `["2026-09-21", "2026-09-22"]`임
  - **AC-19 [W][P0]: Scenario: 자동 종료 재시도 제한**
    - Given `resetAutoFinalizeSession()` 후, id `"m1"`인 stale active가 있고 모든 `setItem`이 `QuotaExceededError`를 던질 때
      - 1번째 `autoFinalizeStale(now)`: `{ status: 'done', result: { ok: false, reason: 'quota' }, showQuotaToast: true }`
      - 2번째: `{ status: 'done', result: { ok: false, reason: 'quota' }, showQuotaToast: false }`
      - 3번째 이후: `{ status: 'suppressed' }`를 반환하고 `finalizeActive`는 호출되지 않음 (`setItem` 호출 횟수가 늘지 않음)
    - And 이후 id `"m2"`인 stale active로 바뀌면 다시 1번째 호출과 같은 결과를 반환함
    - And stale이 아닌 active나 null active면 `{ status: 'not_stale' }`을 반환하고 `setItem`을 호출하지 않음
  - **AC-20 [W][P0]: Scenario: 읽기 시 스키마 제약 강제 (PK 고유, CHECK, 정렬)**
    - Given `mcc:v1:records`에 다음 4행이 이 순서로 저장되어 있을 때 (나머지 필드는 모두 유효)
      - A: `{ id: "r3", endedAt: "2026-09-20T01:00:00.000Z" }`
      - B: `{ id: "r1", endedAt: "2026-09-21T01:00:00.000Z", updatedAt: "2026-09-21T01:00:00.000Z" }`
      - C: `{ id: "r1", endedAt: "2026-09-21T01:00:00.000Z", updatedAt: "2026-09-21T02:00:00.000Z" }`
      - D: `{ id: "r2", durationSec: 5 }` (CHECK 위반)
    - When `loadRecords()` 호출
      - Then `[C, A]`를 반환함 (id 순서 `["r1", "r3"]`, r1은 `updatedAt`이 02:00인 행)
      - And `loadRecordsPage(1, 20)`은 `{ total: 2, page: 1 }`이고 `error`가 없음
    - And 다음 행도 버려짐
      - `createdAt`이나 `updatedAt`이 없거나 `Date.parse` 결과가 NaN인 행
      - `outcome`과 `wasteCost` 중 한쪽만 null인 행
      - `Date.parse(endedAt) < Date.parse(startedAt)`인 행
    - Given `mcc:v1:noMeetingDays = [{ id: "2026-09-22", date: "2026-09-21" }, { id: "2026-09-21", date: "2026-09-21", createdAt: T2 }, { id: "2026-09-21", date: "2026-09-21", createdAt: T1 }]` (T1 < T2)
      - Then `loadNoMeetingDays()`는 `createdAt: T1`인 `"2026-09-21"` 1행만 반환함
    - Given `mcc:v1:badges = [{ id: "total_5", badgeId: "streak_3" }, { id: "first_free_day", badgeId: "first_free_day", createdAt: T1 }, { id: "first_free_day", badgeId: "first_free_day", createdAt: T2 }]`
      - Then `loadBadges()`는 `createdAt: T1`인 `first_free_day` 1행만 반환함
    - Given `mcc:v1:lastSetup`의 `id`가 `'lastSetup'`이 아니거나 `attendees`가 `1`일 때
      - Then `loadLastSetup()`은 `null`을 반환함
    - Given `mcc:v1:active`에 `startedAt`이 없거나 `totalPausedMs`가 음수일 때
      - Then `loadActive()`는 `null`을 반환함
    - And 위 모든 읽기에서 `setItem`/`removeItem` 호출은 0회, `console.error` 호출은 0회이며, 저장소 문자열은 호출 전과 같음
    - And 위 records 상태에서 새 기록으로 `saveRecord`를 호출하면 저장된 배열에는 id가 `"r1"`인 행이 1개뿐이고 D 행이 없음
  - **AC-21 [U][P1]: Scenario: 정렬 인덱스를 이용한 기간 조회**
    - Given `endedAt`이 로컬 `[2026-09-21 10:00, 2026-09-15 10:00, 2026-09-01 10:00, 2026-08-31 10:00]`인 기록 4건(내림차순)
    - When `takeEndedSince(records, <로컬 2026-09-01 00:00>)` 호출
      - Then 앞의 3건을 반환함
    - And `sinceMs`가 모든 endedAt보다 뒤이면 `[]`, 모든 endedAt보다 앞이면 4건 전체를 반환함
    - And `endedAt` 내림차순인 기록 500건 픽스처에서 다음 결과가 전체 배열을 스캔한 기준 구현의 결과와 같음
      - `rankTeams(records, 'thisMonth', 1, 20, now)`
      - `hasMeetingOn(dateKey, records, null, now)` (임의의 dateKey 10개)
      - 홈 이번 주 합계(F8 AC-1)

---

### F2. 회의 설정 입력 & 시급 환산 미리보기
- **Description:**
  - 회의명, 팀명, 참석자 수, 평균 연봉(만 원), 예정 시간을 입력합니다.
  - 입력하는 즉시 1인 시급, 팀 시급, 분당 비용을 보여줍니다.
  - "회의 시작"을 누르면 ActiveMeeting을 만들고 타이머 화면으로 이동합니다.
- **Data:** MeetingSetup(`mcc:v1:lastSetup`), ActiveMeeting(`mcc:v1:active`)
- **API:** 없음 (F1 `finalizeActive` 사용)
- **Requirements:**
  - **AC-1 [E][P0]: Scenario: 실시간 시급 환산 표시**
    - Given `/setup` 화면에서
    - When `{ attendees: 5, annualSalaryManwon: 5000 }` 입력
    - Then `data-testid="hourly-preview"` Card에 다음이 표시됨
      - "1인 시급 24,038원"
      - "팀 시급 120,192원"
      - "분당 2,003원"
  - **AC-2 [E][P0]: Scenario: 회의 시작**
    - Given `{ title: "주간 스프린트", teamName: "플랫폼팀", attendees: 5, annualSalaryManwon: 5000, plannedMinutes: 30 }`를 입력한 상태
    - When "회의 시작" 버튼 탭
    - Then `mcc:v1:active`에 다음 ActiveMeeting이 저장됨
      - `id: newId()`
      - `startedAt = Date.now()`, `pausedAt: null`, `totalPausedMs: 0`
      - `createdAt === updatedAt === new Date(startedAt).toISOString()`
    - And `mcc:v1:lastSetup`에 `{ id: 'lastSetup', ...입력값, updatedAt: <현재 ISO> }`가 저장됨
    - And `navigate('/meeting', { replace: true })`가 실행됨
  - **AC-3 [W][P1]: Scenario: 참석자 수 검증**
    - When attendees를 비우고 "회의 시작" 탭
    - Then 참석자 TextField 아래에 "참석자 수를 입력해주세요"가 표시됨
    - And attendees가 `1` 또는 `101`이면 "참석자는 2~100명까지 입력할 수 있어요"가 표시되고, 화면 이동이 일어나지 않음
  - **AC-4 [W][P1]: Scenario: 연봉 및 예정 시간 검증**
    - When annualSalaryManwon이 비어 있으면 "평균 연봉을 입력해주세요"가 표시됨
    - And `999` 또는 `50001`이면 "연봉은 1,000만~5억 원 사이로 입력해주세요"가 표시됨
    - And plannedMinutes가 `4` 또는 `481`이면 "예정 시간은 5~480분 사이로 입력해주세요"가 표시됨
    - And 이 경우 "회의 시작" 버튼은 `disabled` 상태임
  - **AC-5 [S][P1]: Scenario: 미리보기 빈 상태**
    - While attendees 또는 annualSalaryManwon이 유효하지 않은 동안
    - Then `hourly-preview` Card는 "참석자 수와 연봉을 입력하면 시급이 계산돼요"를 표시함
  - **AC-6 [E][P1]: Scenario: 마지막 입력값 프리필**
    - Given `mcc:v1:lastSetup = { id: 'lastSetup', attendees: 8, annualSalaryManwon: 6000, ... }`
    - When `/setup`에 state 없이 진입
    - Then 각 TextField에 `8`, `6000`이 채워져 있음
  - **AC-7 [W][P1]: Scenario: 진행 중인 회의 중복 방지**
    - Given `mcc:v1:active`가 null이 아닐 때
      - 만료된 active는 보통 앱 셸이 먼저 자동 종료하므로 여기에 해당하지 않습니다(F8 AC-10).
      - 단, 자동 종료가 `quota`로 실패해 남아 있는 만료 active는 이 다이얼로그의 대상입니다.
    - When `/setup`에 진입
    - Then AlertDialog "진행 중인 회의가 있어요"가 뜨고, 버튼 2개가 표시됨
      - "이어서 진행": `navigate('/meeting', { replace: true })`
      - "종료하고 새로 시작": `finalizeActive(Date.now())`를 호출함 (**저장만 하고 화면 이동 없음**, F1 AC-19의 재시도 제한과 무관)
    - And 결과별 동작은 다음과 같음
      - **`ok: true`**
        - AlertDialog를 닫고 `/setup`에 머묾. 폼 값(프리필 포함)은 그대로 유지함
        - 저장된 기록은 `outcome: null`로 남고, 사용자가 나중에 기록 탭(F5 AC-2 → `/wrapup/:id`)에서 회고를 입력함
        - 토스트 "이전 회의를 저장했어요. 회고는 기록 탭에서 입력할 수 있어요"가 표시됨
        - `cancelledNoMeetingDates`가 비어 있지 않으면 F7 AC-6 토스트를 그다음 순서로 표시함
      - **`reason: 'too_short'`** (기존 회의 경과 10초 미만)
        - 기록 없이 active가 null이 됨
        - AlertDialog를 닫고 `/setup`에 머묾
        - 토스트 "10초 미만 회의는 저장되지 않아요"가 표시됨
        - F4 AC-6의 "저장되지 않아요" AlertDialog는 **띄우지 않음**
      - **`reason: 'quota'`**
        - active를 유지하고 AlertDialog도 계속 열어 둠
        - F1 AC-7 토스트가 표시됨
    - And 기존 회의가 8시간을 넘었으면 저장되는 `durationSec`은 28,800임 (F1 AC-11)
  - **AC-8 [U][P1]: Scenario: 모바일 키보드 대응**
    - Then 숫자 입력 TextField는 `inputMode="numeric"`임
    - And 포커스된 필드가 `scrollIntoView({ block: 'center' })`로 키보드 위에 보임
    - And 마지막 필드에서 키패드 완료(Enter)를 누르면 AC-2와 같은 제출이 실행됨

---

### F3. 실시간 누적 비용 타이머
- **Description:**
  - 회의가 진행되는 동안 경과 시간과 누적 비용을 1초마다 갱신해 크게 보여줍니다.
  - 일시정지와 재개를 지원합니다.
  - 경과 시간은 `startedAt` 타임스탬프를 기준으로 계산하므로, 앱을 백그라운드로 보냈다가 돌아오거나 새로고침해도 시간이 정확합니다.
  - 매 tick과 마운트 시점에 `autoFinalizeStale`(F1)로 8시간/12시간 상한을 확인하고 자동 종료합니다.
- **Data:** ActiveMeeting
- **API:** 없음
- **Requirements:**
  - **AC-1 [S][P0]: Scenario: 1초 단위 비용 갱신**
    - Given `{ attendees: 5, annualSalaryManwon: 5000 }` 회의가 진행 중일 때
    - When 경과 시간이 `00:45:00`이 됨
    - Then `data-testid="live-cost"`에 "90,144원"이 표시됨
    - And `data-testid="live-elapsed"`에 "00:45:00"이 표시됨
  - **AC-2 [E][P0]: Scenario: 일시정지와 재개**
    - When "일시정지" 탭
      - Then `pausedAt = Date.now()`와 `updatedAt`이 저장됨
      - And live-cost 갱신이 멈추고, 버튼 라벨이 "재개"로 바뀜
    - When "재개" 탭
      - Then `totalPausedMs += now − pausedAt`, `pausedAt = null`, `updatedAt`이 저장됨
      - And 갱신이 다시 시작됨
  - **AC-3 [E][P0]: Scenario: 새로고침 후 복원**
    - Given `startedAt`이 600초 전인 ActiveMeeting이 저장된 상태
    - When `/meeting`을 새로 로드
    - Then live-elapsed는 "00:10:00"(±1초)을 표시함
  - **AC-4 [S][P1]: Scenario: 예정 시간 초과 경고**
    - While 경과 초 > plannedMinutes × 60인 동안
    - Then `data-testid="overtime-badge"` Badge에 "예정 시간 N분 초과"가 표시됨 (N = floor(초과초 / 60))
  - **AC-5 [W][P1]: Scenario: 진행 중 회의 없음**
    - Given `mcc:v1:active`가 null일 때
    - When `/meeting` 진입
    - Then `navigate('/', { replace: true })`가 실행되고 토스트 "진행 중인 회의가 없어요"가 표시됨
    - And 같은 진입에서 자동 종료가 `too_short`로 끝난 경우(F3 AC-9, F8 AC-10)에는 이 토스트를 표시하지 않음. "10초 미만" 토스트가 우선함
  - **AC-6 [W][P1]: Scenario: 8시간 자동 종료 (화면 열림)**
    - When `/meeting`이 열려 있는 동안 `autoFinalizeStale(Date.now())`이 `staleReason: 'elapsed_cap'`으로 `status: 'done'`을 반환함
    - Then 타이머가 멈추고, `finalizeActive`가 다음 값으로 저장함
      - `durationSec: 28800`
      - `endedAt = startedAt + totalPausedMs + 8시간`
    - And `result.ok === true`이면 토스트 "8시간이 지나 회의를 자동 종료했어요"가 표시되고 `navigate('/wrapup/' + id, { replace: true })`가 실행됨
    - And `result.reason === 'quota'`이면 AC-10을 따름
    - And live-elapsed는 "08:00:00"을 넘어 표시되지 않음
  - **AC-7 [S][P1]: Scenario: 초기 로딩**
    - While ActiveMeeting을 읽는 첫 렌더 동안
    - Then live-cost 자리에 TDS Skeleton이 표시되고, "0원" 같은 잘못된 값은 표시되지 않음
  - **AC-8 [U][P2]: Scenario: 광고 배치**
    - Then `AdSlot`은 `data-testid="meeting-banner"`로 SubmitFooter 위, 콘텐츠 아래에 배치됨
    - And live-cost 영역과 겹치지 않음
  - **AC-9 [W][P1]: Scenario: 일시정지 상태로 12시간 경과 (벽시계 상한)**
    - Given `pausedAt`이 `startedAt + 1시간`인 active가 있고, 현재가 `startedAt + 12시간` 이상일 때
    - When `/meeting` 마운트 또는 tick 시 `autoFinalizeStale`이 `staleReason: 'wall_cap'`으로 `status: 'done'`을 반환함
    - Then `finalizeActive`가 `durationSec: 3600`, `endedAt = startedAt + 12시간`으로 저장함
    - And `result.ok === true`이면 토스트 "12시간이 지나 회의를 자동 종료했어요"가 표시되고 `navigate('/wrapup/' + id, { replace: true })`가 실행됨
    - And durationSec이 10 미만이면(`too_short`) 다음과 같이 처리함
      - 기록 없이 active를 null로 만듦
      - 토스트 "10초 미만 회의는 저장되지 않아요"만 표시하고 `navigate('/', { replace: true })`를 실행함
      - AC-5의 "진행 중인 회의가 없어요" 토스트는 표시되지 않음 (토스트 1개)
    - And `result.reason === 'quota'`이면 AC-10을 따름
  - **AC-10 [W][P1]: Scenario: 자동 종료 저장 공간 부족**
    - Given stale active가 있고 `finalizeActive`가 `{ ok: false, reason: 'quota' }`를 반환할 때
    - Then 첫 실패(`showQuotaToast: true`)에서 F1 AC-7 토스트를 1회 표시하고 `/meeting`에 머묾
    - And 타이머는 멈춘 상태로 표시함
      - live-elapsed와 live-cost는 `capAt` 시점 값으로 고정됨 (예: `elapsed_cap`이면 "08:00:00")
      - "일시정지/재개" 버튼은 `disabled`, "회의 종료" 버튼은 활성 상태
    - And 다음 tick(1초 뒤) 또는 다음 마운트에서 `autoFinalizeStale`이 재시도 1회를 실행함
      - 재시도가 성공하면 AC-6/AC-9의 성공 흐름을 따름
      - 재시도도 실패하면 토스트를 다시 표시하지 않음
    - And 이후 60초 동안 화면에 머물러도 이 active.id의 자동 `finalizeActive` 호출은 총 2회이고, F1 AC-7 토스트 표시는 총 1회임 (F8 AC-10에서 실행된 시도와 합산)
    - And 사용자가 "회의 종료"를 확정하면 재시도 제한과 무관하게 `finalizeActive`를 호출하고, 결과는 F4 AC-1/AC-10을 따름

---

### F4. 회의 종료 & 비용/낭비 리포트 (보상형 광고 게이트)
- **Description:**
  - 회의를 종료하면 기록을 저장하고, 회고 화면에서 "결론이 났나요?"를 고르게 합니다.
  - 이후 리포트 화면에서 총비용, 초과 비용, 낭비 추정액을 보여줍니다.
  - 리포트를 처음 열람할 때는 보상형 광고 시청이 필요합니다. 한 번 해제한 리포트는 다시 볼 때 광고 없이 열립니다.
  - 종료 저장은 F1 `finalizeActive`를 호출한 뒤, **이 화면에서만** `/wrapup`으로 이동합니다.
- **Data:** MeetingRecord, ActiveMeeting
- **API:** 없음
- **Requirements:**
  - **AC-1 [E][P0]: Scenario: 회의 종료 저장**
    - Given 경과 2,700초인 회의가 진행 중일 때
    - When "회의 종료" 탭 → AlertDialog "회의를 종료할까요?"에서 "종료" 탭
    - Then `finalizeActive(Date.now())`가 호출됨
    - And 다음 기록이 `mcc:v1:records` index 0에 저장됨
      - `id`: 기존 `ActiveMeeting.id`와 같은 값
      - `durationSec: 2700`, `totalCost: 90144`
      - `outcome: null`, `wasteCost: null`
      - `reportUnlocked: false`, `shareUnlocked: false`
      - `createdAt`, `updatedAt`: 저장 시각
    - And `mcc:v1:active`는 null이 됨
    - And `navigate('/wrapup/' + id, { replace: true })`가 실행됨
  - **AC-2 [E][P0]: Scenario: 회고 입력**
    - Given `/wrapup/:id` 화면에서
    - When Chip "결론 없음" 선택 후 "리포트 보기" 탭
    - Then `updateRecord(id, { outcome: 'none', wasteCost: 60096 })`가 `{ ok: true }`를 반환하고, 기록의 `updatedAt`이 갱신됨 (`createdAt`은 그대로)
    - And `navigate('/report/' + id, { replace: true })`가 실행됨
    - And outcome을 고르기 전에는 "리포트 보기"가 `disabled`임
    - And 저장 실패 시 동작은 AC-11을 따름
  - **AC-3 [E][P0]: Scenario: 리포트 보기 전 보상형 광고**
    - Given `reportUnlocked: false`인 기록의 `/report/:id` 진입
    - When `TossRewardAd` 광고 시청이 완료됨
    - Then `updateRecord(id, { reportUnlocked: true })`가 `{ ok: true }`를 반환하고 리포트 본문이 표시됨
    - And 저장 실패 시 동작은 AC-12를 따름
  - **AC-4 [S][P0]: Scenario: 해제된 리포트 재열람**
    - While `reportUnlocked: true`인 동안
    - Then `/report/:id` 진입 시 광고 없이 본문이 바로 표시됨
  - **AC-5 [U][P0]: Scenario: 리포트 레이아웃**
    - Then `/report/:id`는 다음을 가짐
      - `data-testid="report-summary-hero"` SummaryHero: 총비용 `90,144`를 CountUp으로 표시
      - `data-testid="report-waste-card"` Card: 낭비 추정 "60,096원"과 Badge "67%"
      - 낭비율 MiniBar
      - `data-testid="report-breakdown-card"` Card: 참석자 5명, 45분(예정 30분), 초과 비용 30,048원, 분당 2,003원
  - **AC-6 [W][P1]: Scenario: 10초 미만 회의**
    - When `/meeting`에서 경과 9초에 "회의 종료"를 확정함 (`finalizeActive` → `reason: 'too_short'`)
    - Then AlertDialog "10초 미만 회의는 저장되지 않아요"가 표시됨
    - And "확인"을 탭하면 `navigate('/', { replace: true })`가 실행됨 (active는 이미 null이고 기록은 없음)
  - **AC-7 [W][P1]: Scenario: 존재하지 않는 기록**
    - When `/report/unknown-id`, `/wrapup/unknown-id`, `/report/unknown-id/card` 중 하나에 진입
    - Then Asset.ContentIcon, "기록을 찾을 수 없어요", Button "홈으로"(→ `/`)가 표시됨
    - And TossRewardAd는 렌더링되지 않음
  - **AC-8 [W][P1]: Scenario: 광고 로드 실패 시 차단 금지**
    - Given `TossRewardAd`가 광고 로드에 실패했을 때
    - Then 리포트 본문을 그대로 표시하고 `updateRecord(id, { reportUnlocked: true })`로 저장함 (fail-open)
    - And 저장 실패 시 동작은 AC-12를 따름
  - **AC-9 [S][P1]: Scenario: 회고 미입력 기록**
    - While 기록의 `outcome === null`인 동안
    - Then `/report/:id` 진입 시 `navigate('/wrapup/' + id, { replace: true })`로 이동함
  - **AC-10 [W][P1]: Scenario: 종료 저장 공간 부족**
    - Given "회의 종료" 확정 후 `finalizeActive`가 `{ ok: false, reason: 'quota' }`를 반환할 때
    - Then `/meeting`에 머물고 타이머는 계속 갱신됨 (active 유지, 만료 active면 F3 AC-10의 고정 표시 유지)
    - And F1 AC-7 토스트가 표시됨 (사용자가 누를 때마다 1회)
  - **AC-11 [W][P1]: Scenario: 회고 저장 실패**
    - Given `/wrapup/:id`에서 Chip을 선택하고 "리포트 보기"를 탭했을 때
    - When `updateRecord`가 `{ ok: false, reason: 'quota' | 'unknown' }`를 반환함
      - Then `navigate`가 호출되지 않고(0회) `/wrapup/:id`에 머묾
      - And F1 AC-7 토스트가 1회 표시됨
      - And 선택한 Chip은 유지되고 "리포트 보기"는 다시 활성 상태가 되어 재시도할 수 있음
      - And 저장소의 기록은 `outcome: null`, `wasteCost: null`로 그대로임. 그래서 `/report`로 가지 않으므로 AC-9의 `/wrapup` ↔ `/report` 반복 이동이 일어나지 않음
    - When `updateRecord`가 `{ ok: false, reason: 'not_found' }`를 반환함 (다른 경로에서 삭제됨)
      - Then 이동 없이 AC-7의 "기록을 찾을 수 없어요" 화면으로 바뀜
  - **AC-12 [W][P1]: Scenario: 리포트 해제 저장 실패**
    - Given `reportUnlocked: false`인 기록에서 광고 시청을 완료했거나(AC-3) 광고 로드에 실패했을 때(AC-8)
    - When `updateRecord(id, { reportUnlocked: true })`가 `{ ok: false, reason: 'quota' | 'unknown' }`를 반환함
      - Then `navigate`가 호출되지 않고 `/report/:id`에 머묾
      - And 이번 열람에 한해 본문을 표시함 (메모리 상태로만 해제)
      - And F1 AC-7 토스트가 1회 표시됨
      - And 저장소의 `reportUnlocked`는 `false`로 남으므로, 다음 진입 때는 다시 광고 게이트가 표시됨
      - And "공유 카드 만들기" 버튼은 `disabled`임 (F6 진입 게이트 3단계에서 되돌아오는 이동 방지)
    - When `updateRecord`가 `{ ok: false, reason: 'not_found' }`를 반환함
      - Then 본문 대신 AC-7 화면이 표시됨

---

### F5. 회의 비용 히스토리 & 팀 랭킹
- **Description:**
  - 저장된 회의를 최신순으로 페이지 단위(`loadRecordsPage`)로 보여줍니다.
  - 최근 10건의 비용 추이를 Sparkline으로 보여줍니다.
  - "팀 랭킹" 탭에서는 teamName별 누적 비용을 합산해 순위와 비중(MiniBar)을 보여줍니다.
  - 랭킹은 이 기기에 저장된 기록만 대상으로 합니다.
  - 기록 목록의 각 행에서 바로 삭제할 수 있습니다. 이 삭제는 광고 게이트, outcome 입력 여부와 관계없이 동작하므로 저장 공간이 부족할 때 공간을 확보하는 경로가 됩니다(F1 AC-7).
- **Data:** MeetingRecord
- **API:** 없음 (내부 함수)
  - `loadRecordsPage(page, size): Page<MeetingRecord>` (F1). 목록 page size는 `HISTORY_PAGE_SIZE = 20`
  - `rankTeams(records: MeetingRecord[], period: 'all' | 'thisMonth', page: number, size: number, now: Date): Page<TeamRank>` (`src/lib/ranking.ts`, 순수 함수)
    - 입력 `records`는 `loadRecords()` 결과(endedAt 내림차순)입니다. `'thisMonth'`는 `takeEndedSince(records, 이번 달 1일 로컬 00:00)`로 대상을 좁힙니다(Data Models "인덱스와 조회 경로").
    - 정렬 기준은 totalCost 내림차순, 같으면 count 내림차순, 그다음 teamName `localeCompare('ko')` 오름차순입니다.
    - `sharePercent`는 해당 기간 전체 합계 대비 비율입니다.
    - `total`은 팀 수입니다. 랭킹 page size는 20입니다.
  - `deleteRecord(id): SaveResult` (F1)
- **Requirements:**
  - **AC-1 [U][P0]: Scenario: 히스토리 목록**
    - Given 기록 3건 `[{title:"주간 스프린트", totalCost:90144}, {title:"1on1", totalCost:12019}, {title:"기획 리뷰", totalCost:240384}]`(endedAt 내림차순)
    - Then TDS Tab "기록"에 ListRow 3개가 그 순서로 표시됨
    - And 각 행에 제목, "M월 D일 · 45분 · 5명", 우측 "90,144원"이 표시됨
  - **AC-2 [E][P0]: Scenario: 기록 상세 이동**
    - When ListRow 탭 (더보기 버튼 영역 제외)
    - Then `outcome !== null`이면 `navigate('/report/' + id)`, `outcome === null`이면 `navigate('/wrapup/' + id)`가 실행됨
  - **AC-3 [U][P0]: Scenario: 팀 랭킹 합산**
    - Given `{teamName:"플랫폼팀", totalCost:90144}`, `{teamName:"플랫폼팀", totalCost:30000}`, `{teamName:"디자인팀", totalCost:200000}`
    - When `rankTeams(records, 'all', 1, 20, now)` 호출
    - Then 다음을 반환함
      ```
      { items: [
          { rank: 1, teamName: "디자인팀", totalCost: 200000, count: 1, sharePercent: 62 },
          { rank: 2, teamName: "플랫폼팀", totalCost: 120144, count: 2, sharePercent: 38 } ],
        total: 2, page: 1 }
      ```
    - And Tab "팀 랭킹"을 선택하면 `data-testid="team-rank-row"` 2개가 "1위 디자인팀 200,000원 · 1회", "2위 플랫폼팀 120,144원 · 2회" 순서로 표시되고, 각 행에 MiniBar(62%, 38%)가 표시됨
    - And 팀이 21개면 첫 페이지 20행과 Button "더 보기"가 표시되고, 탭하면 `page: 2`의 1행이 추가된 뒤 버튼이 사라짐
  - **AC-4 [E][P1]: Scenario: 기간 필터**
    - When 랭킹 상단 Chip "이번 달" 선택 (기본값은 "전체")
    - Then `rankTeams(records, 'thisMonth', 1, 20, now)`가 호출되고, endedAt이 현재 로컬 월에 속한 기록만 합산됨
  - **AC-5 [U][P1]: Scenario: 추이 시각화**
    - Given 기록이 2건 이상일 때
    - Then 목록 상단 `data-testid="history-trend"` Card에 다음이 표시됨
      - `loadRecordsPage(1, 10).items`의 totalCost Sparkline (오래된 것 → 최신 순)
      - "최근 10회 평균 N원"
    - And 기록이 1건이면 Sparkline 없이 평균만 표시됨
  - **AC-6 [S][P1]: Scenario: 빈 상태**
    - While `loadRecordsPage(1, 20)`이 `{ total: 0 }`이고 `error`가 없는 동안
    - Then Asset.ContentIcon, "아직 기록된 회의가 없어요", Button "첫 회의 시작하기"(→ `/setup`)가 표시됨
    - And 랭킹 탭에는 "팀별 순위를 보려면 회의를 기록해주세요"가 표시됨
  - **AC-7 [U][P1]: Scenario: 페이지 단위 목록 (더 보기)**
    - Given 기록이 45건일 때
    - Then 첫 렌더에서 `loadRecordsPage(1, 20)`이 `{ items.length: 20, total: 45, page: 1 }`을 반환하고 ListRow 20개가 렌더링됨
    - When Button "더 보기" 탭
      - Then `loadRecordsPage(2, 20)`이 `{ items.length: 20, total: 45, page: 2 }`를 반환하고 누적 40행이 됨
    - When 한 번 더 탭
      - Then `loadRecordsPage(3, 20)`이 `{ items.length: 5, total: 45, page: 3 }`을 반환하고 누적 45행이 됨
    - And 누적 행 수가 `total`과 같아지면 "더 보기" 버튼이 사라짐
    - And 문서 스크롤은 하나만 사용하며 중첩 스크롤 컨테이너를 만들지 않음
  - **AC-8 [E][P1]: Scenario: 기록 삭제 (리포트 화면)**
    - Given `/report/:id`에서
    - When "기록 삭제" 탭 → AlertDialog "이 기록을 삭제할까요?"에서 "삭제" 탭
    - Then `deleteRecord(id)`가 `{ ok: true }`를 반환하고 `mcc:v1:records`에서 해당 id가 제거됨
    - And NoMeetingDay와 EarnedBadge는 변경되지 않음 (연쇄 규칙 표)
    - And `navigate('/history', { replace: true })`가 실행되고 토스트 "기록을 삭제했어요"가 표시됨
  - **AC-9 [U][P2]: Scenario: 목록 배너**
    - Given 누적 렌더링된 기록이 5건 이상일 때
    - Then `AdSlot`이 5번째 ListRow 다음에 1개만 삽입됨 (페이지를 추가로 불러와도 1개 유지)
  - **AC-10 [W][P1]: Scenario: 기록 읽기 실패**
    - Given `loadRecordsPage`가 `error: 'corrupted'` 또는 `'unavailable'`을 반환할 때
    - Then 기록 탭과 랭킹 탭에 Asset.ContentIcon, "기록을 불러오지 못했어요", Button "다시 시도"가 표시됨
    - And "다시 시도"를 탭하면 `loadRecordsPage(1, 20)`을 다시 호출함
    - And AC-6의 빈 상태 문구와 "첫 회의 시작하기" 버튼은 표시되지 않음
    - And `console.error` 호출은 0회임
  - **AC-11 [W][P1]: Scenario: 기록 삭제 실패 (저장소 오류, 리포트 화면)**
    - Given `/report/:id`에서 `deleteRecord(id)`가 `{ ok: false, reason: 'quota' | 'unknown' }`를 반환할 때
    - Then AlertDialog를 닫고 `/report/:id`에 머묾
    - And 토스트 "기록을 삭제하지 못했어요. 다시 시도해주세요"가 표시됨
    - And 해당 기록은 `mcc:v1:records`에 그대로 남아 있음
  - **AC-12 [W][P2]: Scenario: 이미 삭제된 기록 삭제 (리포트 화면)**
    - Given `/report/:id`에서 `deleteRecord(id)`가 `{ ok: false, reason: 'not_found' }`를 반환할 때
    - Then 토스트 "이미 삭제된 기록이에요"가 표시되고 `navigate('/history', { replace: true })`가 실행됨
  - **AC-13 [E][P0]: Scenario: 목록에서 기록 삭제**
    - Given `/history` 기록 탭의 각 ListRow 우측(금액 옆)에 `data-testid="record-more-button"` 아이콘 버튼("⋯", `aria-label="더보기"`, 44×44px 이상)이 있을 때
    - When 더보기 버튼 탭
      - Then ListRow의 상세 이동(AC-2)은 실행되지 않음 (`navigate` 0회)
      - And BottomSheet에 "기록 삭제" 항목이 표시됨
    - When "기록 삭제" 탭 → AlertDialog "이 기록을 삭제할까요?"에서 "삭제" 탭
      - Then `deleteRecord(id)`가 호출됨
    - And 이 경로는 `outcome === null`, `reportUnlocked: false`인 기록에서도 똑같이 동작하며, TossRewardAd는 렌더링되지 않음 (0회)
    - And `{ ok: true }`이면 다음과 같이 처리함
      - `/history`에 머묾 (`navigate` 0회)
      - 토스트 "기록을 삭제했어요"가 표시됨
      - 지금까지 불러온 페이지 수를 P라 할 때 `loadRecordsPage(1..P, 20)`을 다시 호출해 목록을 교체함. 그래서 뒤 페이지 항목이 빠지거나 중복되지 않음
      - `total`이 1 줄고, `history-trend`와 AdSlot 위치(AC-9)가 새 목록 기준으로 다시 계산됨
      - `total`이 0이 되면 AC-6 빈 상태가 표시됨
    - And NoMeetingDay, EarnedBadge, MeetingSetup은 변경되지 않음
  - **AC-14 [W][P1]: Scenario: 목록 삭제 실패**
    - Given AC-13 경로에서 `deleteRecord(id)`가 `{ ok: false, reason: 'quota' | 'unknown' }`를 반환할 때
      - Then AlertDialog와 BottomSheet를 닫고 `/history`에 머묾
      - And 토스트 "기록을 삭제하지 못했어요. 다시 시도해주세요"가 표시되고, 목록 행 수는 변하지 않음
    - Given `{ ok: false, reason: 'not_found' }`를 반환할 때
      - Then 토스트 "이미 삭제된 기록이에요"가 표시되고 AC-13과 같이 `loadRecordsPage(1..P, 20)`으로 목록을 다시 불러옴

---

### F6. 리포트 공유용 요약 카드 이미지
- **Description:**
  - 리포트에서 "공유 카드 만들기"를 누르면 회의명, 날짜, 소요 시간, 총비용, 낭비 추정액을 담은 1080×1350 이미지를 Canvas로 그립니다.
  - 카드를 처음 생성할 때는 보상형 광고 시청이 필요합니다.
  - 만든 이미지는 기기에 저장하거나, 텍스트 요약과 함께 공유합니다.
- **Data:** MeetingRecord(`reportUnlocked`, `shareUnlocked`)
- **API:** 없음 (SDK: `@apps-in-toss/web-framework`의 `saveBase64Data`, `share` — Open Questions 참고)
- **진입 게이트 순서 (`/report/:id/card`):** 아래 순서대로 판정합니다.
  1. 기록 없음 → F4 AC-7 화면 (광고 없음)
  2. `outcome === null` → `/wrapup/:id` (AC-7)
  3. `reportUnlocked === false` → `/report/:id` (AC-12)
  4. `shareUnlocked === false` → TossRewardAd 게이트 (AC-1, AC-9)
  5. 카드 생성
- **Requirements:**
  - **AC-1 [E][P0]: Scenario: 공유 카드 생성 전 보상형 광고**
    - Given `reportUnlocked: true`, `shareUnlocked: false`인 기록에서 `/report/:id/card` 진입
    - When `TossRewardAd` 시청 완료
    - Then `updateRecord(id, { shareUnlocked: true })`가 `{ ok: true }`를 반환하고(새 `updatedAt` 저장) 카드 이미지가 생성됨
    - And 저장 실패 시 동작은 AC-13을 따름
  - **AC-2 [U][P0]: Scenario: 카드 내용**
    - Given 기록 `{title:"주간 스프린트", durationSec:2700, totalCost:90144, wasteCost:60096}`
    - Then `data-testid="share-card-image"` img가 1080×1350 PNG dataURL을 표시함
    - And 캔버스에 그린 텍스트는 "주간 스프린트", "45분", "90,144원", "낭비 추정 60,096원", "MeetingCostClock"을 포함함
    - And 텍스트 목록은 순수 함수 `buildCardLines(record)`로 테스트할 수 있어야 함
  - **AC-3 [E][P0]: Scenario: 이미지 저장**
    - When "이미지 저장" 탭
    - Then `saveBase64Data({ data, fileName: "meeting-cost-<id>.png", mimeType: "image/png" })`가 호출됨
    - And 성공하면 토스트 "이미지를 저장했어요"가 표시됨
  - **AC-4 [E][P1]: Scenario: 텍스트 공유**
    - When "공유하기" 탭
    - Then `share({ message: "오늘 '주간 스프린트' 회의 비용은 90,144원, 낭비 추정 60,096원이었어요." })`가 호출됨
  - **AC-5 [S][P1]: Scenario: 생성 중 로딩**
    - While 캔버스 렌더링 중
    - Then 이미지 자리에 Skeleton과 "카드를 만들고 있어요"가 표시되고, 저장/공유 버튼은 `disabled`임
  - **AC-6 [W][P1]: Scenario: 저장 실패**
    - If `saveBase64Data`가 reject되면
    - Then 토스트 "이미지를 저장하지 못했어요. 다시 시도해주세요"가 표시되고 `console.error`는 호출되지 않음
  - **AC-7 [W][P1]: Scenario: 회고 미입력 기록**
    - If `outcome === null`인 기록의 `/report/:id/card`에 진입하면
    - Then `navigate('/wrapup/' + id, { replace: true })`가 실행됨
  - **AC-8 [U][P1]: Scenario: 캔버스 색상 출처**
    - Then 캔버스 fill/stroke 색상은 `getComputedStyle(document.documentElement).getPropertyValue('--tds-color-*')`로 읽은 값만 씀
    - And 다크모드에서 생성한 카드는 다크 테마 변수 값으로 그려짐
    - (소스 HEX 리터럴 grep 검사는 F8 AC-8에서 캔버스 렌더러를 포함해 수행함)
  - **AC-9 [W][P1]: Scenario: 광고 로드 실패 시 차단 금지**
    - Given `shareUnlocked: false`인 기록에서 `TossRewardAd`가 광고 로드에 실패했을 때
    - Then 카드 생성을 그대로 진행하고 `updateRecord(id, { shareUnlocked: true })`로 저장함 (fail-open)
    - And 저장/공유 버튼은 AC-5 로딩이 끝난 뒤 활성화됨
    - And 저장 실패 시 동작은 AC-13을 따름
  - **AC-10 [W][P1]: Scenario: 공유 실패**
    - If `share()`가 reject되면
    - Then 토스트 "공유하지 못했어요. 다시 시도해주세요"가 표시되고, 화면과 버튼 상태는 유지됨
    - And `console.error`는 호출되지 않음
  - **AC-11 [W][P1]: Scenario: 존재하지 않는 기록**
    - When `/report/unknown-id/card` 진입
    - Then F4 AC-7 화면("기록을 찾을 수 없어요", Button "홈으로")이 표시됨
    - And TossRewardAd, 캔버스 렌더링, `saveBase64Data`/`share` 호출은 0회임
  - **AC-12 [W][P1]: Scenario: 리포트 미해제 상태에서 카드 직접 진입**
    - Given `outcome !== null`이고 `reportUnlocked: false`인 기록
    - When `/report/:id/card`에 직접 진입 (딥링크 또는 뒤로가기 기록)
    - Then `navigate('/report/' + id, { replace: true })`가 실행되어 리포트 보상형 게이트(F4 AC-3)를 먼저 거침
    - And 공유 카드용 TossRewardAd는 렌더링되지 않고 `shareUnlocked`는 변경되지 않음
  - **AC-13 [W][P1]: Scenario: 공유 카드 해제 저장 실패**
    - Given 광고 시청을 완료했거나(AC-1) 광고 로드에 실패한 뒤(AC-9)
    - When `updateRecord(id, { shareUnlocked: true })`가 `{ ok: false, reason: 'quota' | 'unknown' }`를 반환함
      - Then `navigate`가 호출되지 않고 `/report/:id/card`에 머묾
      - And 이번 진입에 한해 카드를 생성해 표시하고, 저장/공유 버튼을 쓸 수 있음 (메모리 상태로만 해제)
      - And F1 AC-7 토스트가 1회 표시됨
      - And 저장소의 `shareUnlocked`는 `false`로 남으므로, 다음 진입 때는 다시 광고 게이트가 표시됨
    - When `updateRecord`가 `{ ok: false, reason: 'not_found' }`를 반환함
      - Then F4 AC-7 화면이 표시되고 캔버스 렌더링은 0회임

---

### F7. 회의 없는 날 챌린지 & 배지
- **Description:**
  - 평일(월~금)에 회의 기록이 없으면 "오늘은 회의 없는 날" 선언을 할 수 있습니다.
  - 누적 일수와 연속 일수에 따라 배지를 줍니다.
  - 선언한 날에 나중에 회의를 기록하면 그날 선언은 취소되지만, 이미 받은 배지는 유지됩니다(연쇄 규칙 표).
  - "오늘 회의가 있었는가"의 판정과 선언 취소는 모두 "날짜 범위 규칙"의 `localDateKeysBetween`을 씁니다. 그래서 자정을 넘긴 회의도 두 규칙에서 같은 날짜로 취급됩니다.
  - 선언 저장(NoMeetingDay 추가 + 배지 추가)은 `declareNoMeetingDay` **한 곳**에서만 처리합니다. 쓰기 순서와 롤백은 Data Models의 "`declareNoMeetingDay` 쓰기 순서와 롤백"을 따릅니다.
- **Data:** NoMeetingDay, EarnedBadge, MeetingRecord, ActiveMeeting
- **API:** 없음 (내부 함수, `src/lib/challenge.ts`)
  - 순수 함수 `evaluateBadges(days: NoMeetingDay[], earned: EarnedBadge[], now: Date): BadgeId[]`는 새로 획득한 배지를 반환합니다. `earned`에 이미 있는 badgeId는 반환하지 않습니다.
  - 순수 함수 `hasMeetingOn(dateKey: string, records: MeetingRecord[], active: ActiveMeeting | null, now: number): boolean`은 AC-4의 차단 조건을 판정합니다. `records`는 endedAt 내림차순이어야 하며, `takeEndedSince(records, dateKey의 로컬 00:00)` 범위만 검사합니다.
  - `declareNoMeetingDay(now: Date): { ok: true; day: NoMeetingDay; newBadges: EarnedBadge[] } | { ok: false; reason: 'weekend' | 'already_declared' | 'has_meeting' | 'quota' | 'unknown' }`
    - 판정 순서: 주말이면 `weekend` → 오늘 선언이 이미 있으면 `already_declared` → `hasMeetingOn(today, loadRecords(), loadActive(), now)`이 참이면 `has_meeting` → 쓰기
    - 새 행: `{ id: today, date: today, createdAt: now.toISOString(), updatedAt: <createdAt과 같음> }`
    - 새 배지: 각 badgeId마다 `{ id: badgeId, badgeId, createdAt: now.toISOString(), updatedAt: <createdAt과 같음> }`
- **배지 정의**

  | 배지 ID | 이름 | 획득 조건 |
  |---|---|---|
  | `first_free_day` | 첫 해방 | 누적 1일 |
  | `streak_3` | 3일 연속 | 연속 평일 3일 (주말은 건너뛰며, 연속이 끊긴 것으로 보지 않음) |
  | `total_5` | 누적 5일 | 누적 5일 |
  | `total_10` | 누적 10일 | 누적 10일 |
  | `total_20` | 누적 20일 | 누적 20일 |

- **Requirements:**
  - **AC-1 [E][P0]: Scenario: 회의 없는 날 선언**
    - Given 2026-09-21(월), 오늘 기록 0건, active null
    - When "오늘은 회의 없는 날" 버튼 탭
    - Then `declareNoMeetingDay(now)`가 `{ ok: true }`를 반환하고 `mcc:v1:noMeetingDays`에 `{ id: "2026-09-21", date: "2026-09-21", createdAt: <ISO>, updatedAt: <createdAt과 같음> }`이 추가됨
    - And 첫 선언이면 `{ id: "first_free_day", badgeId: "first_free_day", createdAt, updatedAt }` 배지가 저장되고 BottomSheet "배지 획득! 첫 해방"이 표시됨
  - **AC-2 [U][P0]: Scenario: 주말을 건너뛰는 연속 계산**
    - Given 선언일 `["2026-09-18"(금), "2026-09-21"(월), "2026-09-22"(화)]`
    - Then `evaluateBadges`는 `streak_3`을 포함함
    - And 선언일이 `["2026-09-17", "2026-09-21", "2026-09-22"]`(9/18 금요일 누락)이면 `streak_3`을 포함하지 않음
    - And `earned`에 `streak_3`이 이미 있으면 `streak_3`을 반환하지 않음
  - **AC-3 [U][P0]: Scenario: 배지 목록 표시**
    - Then `/challenge`에 `data-testid="badge-item"` 5개가 표시됨
    - And 획득한 배지는 `createdAt` 기준 "M월 D일 획득"으로 표시됨
    - And 미획득 배지는 "누적 N일 남음" 또는 "연속 N일 남음"과 함께 비활성 스타일(TDS 색상 변수 `--tds-color-grey-400`)로 표시됨
  - **AC-4 [W][P1]: Scenario: 오늘 회의가 있으면 선언 불가**
    - Given 오늘 날짜 키를 `today`라 할 때, 다음 중 하나라도 참이면 `hasMeetingOn(today, ...)`이 `true`임
      - `loadRecords()` 중 `localDateKeysBetween(Date.parse(startedAt), Date.parse(endedAt))`가 `today`를 포함하는 기록이 1건 이상임
      - active가 null이 아니고 `localDateKeysBetween(active.startedAt, max(active.startedAt, now))`가 `today`를 포함함
    - Then 선언 버튼이 `disabled`이고 "오늘은 이미 회의가 있었어요"가 표시됨
  - **AC-5 [W][P1]: Scenario: 주말 선언 불가**
    - Given 오늘이 토요일 또는 일요일일 때
    - Then 선언 버튼이 `disabled`이고 "주말엔 챌린지가 쉬어요"가 표시됨
  - **AC-6 [E][P1]: Scenario: 선언 후 회의 기록 시 취소**
    - Given 2026-09-21에 선언한 상태
    - When 같은 날이 `localDateKeysBetween(startedAt, endedAt)`에 포함되는 기록이 `finalizeActive`로 저장됨
      - F4 AC-1, F2 AC-7, F3 AC-6/AC-9, F8 AC-10 모두 해당
    - Then 해당 NoMeetingDay가 제거되고 토스트 "오늘 회의가 기록되어 '회의 없는 날'이 취소됐어요"가 표시됨
    - And 이미 받은 배지는 유지됨 (`mcc:v1:badges` 변경 없음)
    - And 이후 그 기록을 삭제해도(F5 AC-8, AC-13) 취소된 선언은 복원되지 않음
  - **AC-7 [S][P1]: Scenario: 빈 상태**
    - While 선언 0건인 동안
    - Then 상단 `data-testid="challenge-summary"` Card에 "누적 0일 · 연속 0일"과 "첫 회의 없는 날에 도전해보세요"가 표시됨
  - **AC-8 [W][P1]: Scenario: 중복 선언 방지**
    - Given 오늘 이미 선언했을 때
    - Then 버튼 라벨이 "오늘 선언 완료"이고 `disabled`임
    - And `declareNoMeetingDay`를 직접 호출해도 `{ ok: false, reason: 'already_declared' }`를 반환하고 `setItem` 호출은 0회임
    - And 저장소에 같은 id(date)가 두 번 들어가지 않음
  - **AC-9 [W][P1]: Scenario: 자정을 넘긴 회의**
    - Given 오늘이 2026-09-22(화) 09:00이고, 기록 1건이 로컬 2026-09-21 23:00 시작 ~ 2026-09-22 00:30 종료일 때
      - Then `hasMeetingOn("2026-09-22", ...)`은 `true`이고, 선언 버튼이 `disabled`이며 "오늘은 이미 회의가 있었어요"가 표시됨
    - Given 오늘이 2026-09-22(화) 00:10이고, active의 `startedAt`이 로컬 2026-09-21 23:30, `pausedAt: null`이며 기록은 0건일 때
      - Then `hasMeetingOn("2026-09-22", ...)`은 `true`이고, 선언 버튼이 `disabled`임
    - Given 오늘이 2026-09-22(화)이고, 기록이 로컬 2026-09-21 10:00 ~ 11:00 1건뿐이며 active가 null일 때
      - Then `hasMeetingOn("2026-09-22", ...)`은 `false`이고, 선언 버튼이 활성 상태임
    - Given 2026-09-21과 2026-09-22에 모두 선언한 상태에서 로컬 2026-09-21 23:00 ~ 2026-09-22 00:30 회의가 `finalizeActive`로 저장될 때
      - Then 두 날짜의 NoMeetingDay가 모두 제거되고 `cancelledNoMeetingDates`는 `["2026-09-21", "2026-09-22"]`임 (F1 AC-18)
      - And 저장 후 `hasMeetingOn`은 두 날짜 모두에서 `true`이므로, 두 날짜 모두 다시 선언할 수 없음
  - **AC-10 [W][P1]: Scenario: 선언 저장 실패와 롤백**
    - Given 첫 선언(배지 `first_free_day`가 새로 생기는 상태)이고, `setItem`이 **두 번째 키(`mcc:v1:badges`) 쓰기에서만** `QuotaExceededError`를 던질 때
      - Then `{ ok: false, reason: 'quota' }`를 반환함
      - And `mcc:v1:noMeetingDays`와 `mcc:v1:badges`는 호출 전과 문자열이 같음 (noMeetingDays는 롤백으로 복원됨)
    - Given 첫 번째 키(`mcc:v1:noMeetingDays`) 쓰기에서 예외를 던질 때
      - Then `QuotaExceededError`면 `quota`, 그 밖의 예외면 `unknown`을 반환하고 두 키 모두 호출 전과 같음
    - And 화면은 `/challenge`에 머물고, `quota`/`unknown`이면 F1 AC-7 토스트를 1회 표시함
    - And 배지 BottomSheet는 표시되지 않고, 선언 버튼은 다시 활성 상태가 됨

---

### F8. 홈 대시보드 & 앱 셸 / 검수 준수
- **Description:**
  - 홈에서는 진행 중인 회의 이어가기, 새 회의 시작, 이번 주 누적 비용을 보여줍니다.
  - 앱 셸에서는 라우트 구성, FloatingTabBar, 전역 에러 경계, 앱 시작 시 만료된 회의 자동 종료를 담당합니다.
  - 앱인토스 검수 정책(외부 이탈, 로깅, 색상, 콘솔 에러, 호환성)을 앱 전체에 적용합니다.
- **Data:** ActiveMeeting, MeetingRecord, NoMeetingDay
- **API:** 없음
- **Requirements:**
  - **AC-1 [U][P0]: Scenario: 홈 대시보드**
    - Given `endedAt`이 이번 주(로컬 월요일 00:00 ~ 일요일 23:59:59)에 속한 기록 `[90144, 30000]`
      - 대상은 `takeEndedSince(loadRecords(), 이번 주 월요일 로컬 00:00)`로 구함
    - Then `data-testid="week-summary-hero"` SummaryHero에 CountUp "120,174원", 부제 "이번 주 회의 2회"가 표시됨
    - And SubmitFooter "새 회의 시작"(→ `/setup`)이 있음
  - **AC-2 [S][P0]: Scenario: 진행 중 회의 배너**
    - While `mcc:v1:active`가 null이 아닌 동안
    - Then 홈 상단 `data-testid="active-meeting-card"` Card에 다음이 표시됨
      - 회의명
      - 현재 누적 비용 (1초 갱신, `getElapsedSec`로 계산하므로 28,800초분이 상한)
      - Button "이어서 보기"(→ `/meeting`)
    - And SubmitFooter 라벨이 "진행 중인 회의로 이동"으로 바뀜
  - **AC-3 [S][P1]: Scenario: 홈 빈 상태**
    - While 기록 0건이고 active가 null인 동안
    - Then Asset.ContentIcon, "회의 한 번에 얼마가 드는지 확인해보세요"가 표시되고 SummaryHero는 숨김 처리됨
  - **AC-4 [U][P0]: Scenario: 라우팅 및 탭**
    - Then 라우트 `/`, `/setup`, `/meeting`, `/wrapup/:id`, `/report/:id`, `/report/:id/card`, `/history`, `/challenge`가 정의됨
    - And FloatingTabBar(홈/기록/챌린지)는 `/`, `/history`, `/challenge`에서만 렌더링됨
    - And 정의되지 않은 경로는 `/`로 redirect됨
  - **AC-5 [W][P1]: Scenario: 렌더 오류 복구**
    - If 하위 컴포넌트가 렌더 중 예외를 던지면
    - Then ErrorBoundary가 "문제가 생겼어요", Button "홈으로"를 표시함
    - And 앱 전체가 흰 화면이 되지 않음
  - **AC-6 [W][P0]: Scenario: 외부 도메인 이탈 및 외부 링크 금지**
    - Then 소스 코드에 다음 사용이 0건임 (grep 테스트)
      - `window.open(`
      - `window.location.href =`
      - `target="_blank"`
      - `http://`/`https://` 외부 링크
  - **AC-7 [W][P0]: Scenario: 외부 로깅 및 앱 설치 유도 금지**
    - Then `package.json`과 소스에 `gtag`, `google-analytics`, `amplitude`, `mixpanel`, `firebase/analytics` 사용이 0건임
    - And UI 문자열에 "앱을 설치", "다운로드"가 0건임
  - **AC-8 [W][P0]: Scenario: HEX 하드코딩 금지 및 다크모드**
    - Then `src/**/*.{ts,tsx,css}`에서 정규식 `#[0-9a-fA-F]{3,8}\b`에 맞는 색상 리터럴이 0건임
      - F6 캔버스 렌더러(`buildCardLines`, 카드 draw 모듈)의 fill/stroke 값도 포함함
    - And 색상은 `var(--tds-color-*)` 또는 TDS 컴포넌트로만 지정됨
  - **AC-9 [U][P0]: Scenario: 콘솔 에러 0개 및 호환성**
    - Then 프로덕션 빌드로 모든 라우트를 순회했을 때 `console.error` 호출이 0회임
    - And Android 7+ / iOS 16+를 지원하기 위해 빌드 타깃은 `es2017`임
    - And `structuredClone`, `Array.prototype.at`, `Object.hasOwn`, `crypto.randomUUID`는 폴백 없이 쓰지 않음
  - **AC-10 [W][P0]: Scenario: 앱 시작 시 만료된 회의 자동 종료**
    - Given `mcc:v1:active`의 `resolveStale(active, Date.now())`이 `stale: true`일 때
      - 예: 8시간 이상 진행 중인 채로 앱을 닫았다가 다시 열었거나, 일시정지 상태로 12시간이 지남
    - When 앱 셸이 마운트됨
      - 어떤 라우트로 진입하든 라우트 렌더 전에 `autoFinalizeStale(Date.now())`를 1회 실행함
      - 앱 셸은 이 처리(와 그에 따른 이동)가 끝날 때까지 라우트를 렌더하지 않음
    - Then `result.ok === true`이면 기록이 `durationSec = resolveStale().durationSec`(≤ 28,800), `endedAt = capAt`으로 저장됨
      - 토스트가 표시됨
        - `elapsed_cap`: "8시간이 지나 회의를 자동 종료했어요"
        - `wall_cap`: "12시간이 지나 회의를 자동 종료했어요"
      - 진입 경로에 따라 다음과 같이 이동함
        - `/meeting`: `navigate('/wrapup/' + id, { replace: true })`
        - 그 밖의 경로: 이동 없이 그대로 렌더링함 (F2 AC-7의 "진행 중인 회의가 있어요" 다이얼로그는 뜨지 않음)
    - And `result.reason === 'too_short'`이면 기록 없이 active를 null로 만들고, 토스트 "10초 미만 회의는 저장되지 않아요"를 표시함
      - 진입 경로가 `/meeting`이면 `navigate('/', { replace: true })`를 실행함. `/meeting`은 렌더되지 않으므로 F3 AC-5의 "진행 중인 회의가 없어요" 토스트는 표시되지 않음 (토스트 총 1개)
      - 그 밖의 경로는 이동 없이 그대로 렌더링함
    - And `result.reason === 'quota'`이면 active를 유지하고 F1 AC-19의 재시도 제한을 따름
      - `showQuotaToast: true`일 때만 F1 AC-7 토스트를 표시함
      - 이동 없이 진입 경로를 그대로 렌더링함
      - `/meeting`으로 진입했다면 F3 AC-10을 따름. 이때 `/meeting`의 첫 확인이 이 active의 재시도 1회이며, 앱 셸과 `/meeting`을 합쳐 자동 `finalizeActive` 호출은 최대 2회, F1 AC-7 토스트는 최대 1회임

---

## Screen Definitions

### S1. 홈 — `/`
- **TDS:** Top, Card, SummaryHero + CountUp, ListRow(최근 회의 3건), Button, Asset.ContentIcon, Spacing, SubmitFooter, FloatingTabBar
- **Layout:** ScreenScaffold 안에 다음 순서로 배치합니다.
  1. active-meeting-card (조건부)
  2. week-summary-hero
  3. "최근 회의" ListRow 최대 3개(`loadRecordsPage(1, 3).items`) + Button "전체 보기"(→ `/history`)
  4. SubmitFooter
- **상태**
  - 로딩: 동기 localStorage라 없음
  - 빈 상태: F8 AC-3
  - 에러: ErrorBoundary
- **터치:** ListRow와 Button 높이 ≥ 48px
- **Navigation contract**
  - Outgoing
    - "새 회의 시작" → `navigate('/setup')` (state 없음)
    - "이어서 보기" / "진행 중인 회의로 이동" → `navigate('/meeting')`
    - 최근 회의 ListRow → `navigate('/report/' + id)` 또는 `navigate('/wrapup/' + id)`
  - Incoming: `location.state = null`

### S2. 회의 설정 — `/setup`
- **TDS:** Top, TextField(회의명, 팀명, 참석자 수, 평균 연봉(만 원), 예정 시간(분)), Card(hourly-preview), Paragraph.Text, AlertDialog, Toast, SubmitFooter("회의 시작")
- **Layout:** ScreenScaffold 안에 다음 순서로 배치합니다.
  1. TextField 5개 (Spacing 16)
  2. `data-testid="hourly-preview"` Card (팀 시급을 t3 강조)
  3. SubmitFooter
- **키보드**
  - 숫자 필드는 `inputMode="numeric"`입니다.
  - 포커스 시 scrollIntoView로 필드를 보이게 합니다.
  - SubmitFooter는 키보드 위에 유지합니다.
- **상태**
  - 빈 상태: F2 AC-5
  - 에러: 필드별 에러 문구(F2 AC-3, AC-4)
  - 진행 중 회의: F2 AC-7
  - 로딩: 없음
- **Navigation contract**
  - Outgoing
    - "회의 시작" → `navigate('/meeting', { replace: true })` (state 없음, 데이터는 `mcc:v1:active`)
    - "이어서 진행" → `navigate('/meeting', { replace: true })`
    - "종료하고 새로 시작" → 이동 없음 (저장 전용, F2 AC-7)
  - Incoming: `location.state = { prefill: MeetingSetupInput } | null`
    - "같은 설정으로 다시 시작"(S5)에서 오면 prefill이 lastSetup보다 우선함

### S3. 회의 진행 — `/meeting`
- **TDS:** Top, SummaryHero(live-cost, 1초 갱신 텍스트, tabular-nums), Paragraph.Text(live-elapsed, "분당 2,003원"), Badge(overtime-badge), Button(일시정지/재개, `display="block"`, variant weak), AlertDialog(종료 확인), Skeleton, Toast, AdSlot, SubmitFooter("회의 종료")
- **Layout contract**
  - `data-testid="live-cost"`는 t1 강조로 화면 상단 1/3 안에 둡니다.
  - 경과 시간과 분당 비용은 Card 1개로 묶습니다.
  - AdSlot(`meeting-banner`)은 콘텐츠 아래, SubmitFooter 위에 둡니다.
- **상태**
  - 로딩: F3 AC-7
  - 빈 상태/에러: F3 AC-5 (redirect)
  - 저장 실패: F4 AC-10
  - 상한 도달: F3 AC-6 / AC-9
  - 자동 종료 저장 실패: F3 AC-10 (타이머 고정, 토스트 1회, 재시도 1회)
- **터치:** 일시정지/종료 버튼 높이 ≥ 56px
- **Navigation contract**
  - Outgoing
    - 종료 확정 또는 자동 종료 → `navigate('/wrapup/' + recordId, { replace: true })` (recordId = ActiveMeeting.id)
    - 10초 미만 → `navigate('/', { replace: true })`
    - 저장 실패(`quota`) → 이동 없음
  - Incoming: `location.state = null` (데이터는 `mcc:v1:active`)

### S4. 회고 — `/wrapup/:id`
- **TDS:** Top, Paragraph.Text("결론이 났나요?"), Chip 3개("결론 남" / "일부 결론" / "결론 없음", 각 높이 ≥ 44px), Card(총비용 요약), Toast, SubmitFooter("리포트 보기")
- **상태**
  - 에러: F4 AC-7
  - 저장 실패: F4 AC-11 (이동 없음, 토스트)
  - 이미 outcome이 있으면 해당 Chip이 미리 선택됨
- **Navigation contract**
  - Outgoing: "리포트 보기" → `updateRecord` 성공 시에만 `navigate('/report/' + id, { replace: true })`
  - Incoming: `useParams<{ id: string }>()`, `location.state = null`

### S5. 리포트 — `/report/:id` ★ 핵심 가치 화면
- **TDS:** Top, TossRewardAd(본문 게이트), SummaryHero + CountUp, Card(report-waste-card, report-breakdown-card), Badge, MiniBar, ListRow, Button("공유 카드 만들기" `display="block"`), Button("같은 설정으로 다시 시작" `display="block"` variant weak), Button("기록 삭제" variant weak, danger 색), AlertDialog, Toast
- **Layout contract:** F4 AC-5를 따릅니다. 낭비 추정액은 t2 강조 + 낭비율 Badge로 표시합니다.
- **보상형 게이트:** `reportUnlocked === false`이면 TossRewardAd로 SummaryHero 이하 본문 전체를 감쌉니다 (F4 AC-3, AC-8).
- **상태**
  - 로딩: 광고 로딩 중에는 TossRewardAd 기본 UI
  - 에러: F4 AC-7
  - 회고 미입력: F4 AC-9
  - 해제 저장 실패: F4 AC-12 (이번 열람만 표시, "공유 카드 만들기" disabled)
  - 삭제 실패: F5 AC-11 / AC-12
- **Navigation contract**
  - Outgoing
    - "공유 카드 만들기" → `navigate('/report/' + id + '/card')`
    - "같은 설정으로 다시 시작" → `navigate('/setup', { state: { prefill: MeetingSetupInput } })` (S2 Incoming 타입과 일치)
    - 삭제 → `navigate('/history', { replace: true })`
  - Incoming: `useParams<{ id: string }>()`, `location.state = null`

### S6. 공유 카드 — `/report/:id/card` ★ 결과 화면
- **TDS:** Top, TossRewardAd(생성 게이트), Card(`data-testid="share-card-image"` img), Skeleton, Button("이미지 저장" `display="block"`), Button("공유하기" `display="block"` variant weak), Toast, Asset.ContentIcon
- **Layout contract:** 이미지를 Card 안에 폭 100%(비율 4:5)로 넣고, 그 아래에 버튼 2개를 세로로 쌓습니다.
- **진입 게이트:** F6 "진입 게이트 순서"를 따릅니다.
- **상태**
  - 로딩: F6 AC-5
  - 에러
    - 저장 실패: F6 AC-6
    - 공유 실패: F6 AC-10
    - 광고 로드 실패: F6 AC-9
    - 해제 저장 실패: F6 AC-13
    - 존재하지 않는 기록: F6 AC-11 / F4 AC-7
  - 리포트 미해제: F6 AC-12
- **Navigation contract**
  - Outgoing
    - Top 뒤로가기 → `navigate(-1)`
    - 게이트 redirect → `navigate('/wrapup/' + id, { replace: true })` 또는 `navigate('/report/' + id, { replace: true })`
  - Incoming: `useParams<{ id: string }>()`, `location.state = null`

### S7. 기록 — `/history` ★ 대시보드 화면
- **TDS:** Top, Tab("기록" / "팀 랭킹"), Card(history-trend) + Sparkline, ListRow, Button(더보기 아이콘 `record-more-button`), BottomSheet("기록 삭제"), AlertDialog(삭제 확인), Toast, Chip("전체" / "이번 달"), MiniBar, Button("더 보기", "다시 시도"), AdSlot, Asset.ContentIcon, FloatingTabBar
- **Layout contract**
  - 기록 탭: F5 AC-5, AC-7, AC-9
    - 각 ListRow 우측에 금액과 `record-more-button`(44×44px 이상)을 둡니다 (F5 AC-13).
  - 랭킹 탭: `team-rank-row`(순위 + 팀명 + 금액 t5 강조 + MiniBar) + "더 보기"(F5 AC-3)
- **데이터 계약**
  - 기록 탭: `loadRecordsPage(page, 20): Page<MeetingRecord>`
  - 랭킹 탭: `rankTeams(loadRecords(), period, page, 20, now): Page<TeamRank>`
  - "더 보기"는 누적 행 수가 `total`보다 작을 때만 표시합니다.
  - 삭제 후에는 `loadRecordsPage(1..P, 20)`으로 목록을 다시 불러옵니다 (F5 AC-13).
- **스크롤:** 20건 단위 페이지네이션(F5 AC-7)을 씁니다. 최대 500건이라 가상 스크롤은 쓰지 않습니다.
- **상태**
  - 빈 상태: F5 AC-6
  - 읽기 실패: F5 AC-10
  - 삭제 실패: F5 AC-14
- **Navigation contract**
  - Outgoing: ListRow → `navigate('/report/' + id)` 또는 `navigate('/wrapup/' + id)`. 더보기/삭제는 이동 없음
  - Incoming: `location.state = null`

### S8. 챌린지 — `/challenge`
- **TDS:** Top, Card(challenge-summary, 누적/연속 t3 강조), Button("오늘은 회의 없는 날" `display="block"`), ListRow(badge-item × 5, 좌측 아이콘 + 이름 + 상태), BottomSheet(배지 획득), Toast, Asset.ContentIcon, FloatingTabBar
- **데이터 계약**
  - 진입 시 `loadNoMeetingDays()`와 `loadBadges()`를 한 번 읽어 각각 `date`, `badgeId`의 `Set`으로 만들어 조회합니다.
  - 선언은 `declareNoMeetingDay(new Date())`만 호출합니다.
- **상태**
  - 빈 상태: F7 AC-7
  - 비활성 조건: F7 AC-4, AC-5, AC-8, AC-9 (자정을 넘긴 회의 포함)
  - 저장 실패: F7 AC-10
- **Navigation contract**
  - Outgoing: 없음 (탭 이동만)
  - Incoming: `location.state = null`

---

## 권장 Work Packet 매핑 (참고)
| Packet | 범위 |
|---|---|
| WP1 | F1 `cost.ts` 순수 함수 + 단위 테스트 (AC-1~3) |
| WP2 | F1 `meetingTime.ts`(`getElapsedSec` clamp, `getCapAt`, `resolveStale`, `localDateKeysBetween`) + 단위 테스트 (AC-4, AC-9, AC-10, AC-18) |
| WP3 | F1 `storage.ts`(`newId`, load/save(upsert)/update/delete, `loadRecordsPage`, 내부 writer) + 방어 로직 테스트 (AC-5~8, AC-13~17) |
| WP4 | F1 `meetingLifecycle.ts` `finalizeActive`(쓰기 순서, 롤백) + `autoFinalizeStale`(재시도 제한) + 연쇄 규칙 테스트 (AC-11, AC-12, AC-19) |
| WP5 | F8 라우트 / 셸 / ErrorBoundary / FloatingTabBar / 앱 시작 만료 처리(AC-10) + 검수 grep 테스트 |
| WP6 | F2 설정 화면 (AC-7 저장 전용 경로 포함) |
| WP7 | F3 타이머 화면 (상한 자동 종료, AC-10 quota 처리 포함) |
| WP8 | F4 종료 흐름 + 회고 화면 (AC-11 회고 저장 실패 포함) |
| WP9 | F4 리포트 화면 + 보상형 게이트(AC-12 해제 저장 실패 포함) + F5 리포트 삭제(AC-8, AC-11, AC-12) |
| WP10 | F5 히스토리 목록(페이지네이션) + 추이 + 읽기 실패 UI |
| WP11 | F5 `rankTeams` + 팀 랭킹 탭 |
| WP12 | F6 카드 렌더러(`buildCardLines` + canvas) |
| WP13 | F6 진입 게이트 / 저장 / 공유 화면 (AC-9~13 포함) |
| WP14 | F7 챌린지 로직(`evaluateBadges`, `hasMeetingOn`, `declareNoMeetingDay` 쓰기 순서·롤백) + 단위 테스트 (AC-2, AC-8, AC-9 로직, AC-10) |
| WP15 | F8 홈 대시보드 |
| WP16 | F5 히스토리 목록 삭제 진입점(더보기 → BottomSheet → AlertDialog) + 목록 재조회 (AC-13, AC-14) |
| WP17 | F1 읽기 시 스키마 제약 강제(PK 중복 제거, CHECK 필터, 정렬) + `recordIndex.ts`의 `takeEndedSince` (AC-20, AC-21). WP3 다음에 진행 |
| WP18 | F7 챌린지 화면 (AC-1, AC-3~9 UI, AC-10 토스트) |

---

## Assumptions
1. 시급은 **세전 연봉 ÷ 2,080시간**으로 환산합니다. 4대보험 사업주 부담분과 복리후생비는 포함하지 않습니다.
2. "낭비 추정"은 PRD에 정의가 없어서 **초과 시간 비용 + 결론 여부 계수(0 / 0.25 / 0.5)** 규칙으로 정했습니다. AI를 쓰지 않으므로 생성형 AI 고지는 적용하지 않습니다.
3. "팀 랭킹"은 서버가 없으므로 **이 기기에 저장된 기록을 teamName별로 합산한 순위**로 해석했습니다. 다른 사용자와 비교하는 랭킹은 범위에서 뺍니다.
4. "회의 없는 날"은 자동으로 판정할 수 없어서(모든 회의를 기록한다는 보장이 없음) **사용자가 직접 선언**하는 방식으로 정했고, 평일만 대상입니다.
5. 템플릿의 `TossRewardAd`는 시청 완료 콜백과 로드 실패 콜백을 제공한다고 가정합니다. 로드에 실패하면 콘텐츠를 막지 않습니다(fail-open).
6. 회의는 동시에 1개만 진행할 수 있습니다.
7. 수익 모델이 광고뿐이라 IAP와 프로모션 리워드는 구현하지 않습니다.
8. 회의 1건의 최대 시간은 일시정지를 제외한 경과 **8시간**, 일시정지를 포함한 벽시계 **12시간**으로 정했습니다. 둘 중 먼저 도달한 시각에 종료된 것으로 기록합니다. 12시간 값은 PRD에 없어서 새로 정한 값입니다.
9. "종료하고 새로 시작"(F2 AC-7)으로 저장한 기록은 회고 없이 `outcome: null`로 남깁니다. 회고는 기록 탭에서 해당 기록을 탭해 입력합니다.
10. 기록을 삭제해도 그 기록 때문에 취소된 "회의 없는 날" 선언은 복원하지 않습니다(선언 이력 조작 방지).
11. 자정을 넘긴 회의는 시작일과 종료일에 **모두** 회의가 있었던 것으로 봅니다. 선언 차단(F7 AC-4)과 선언 취소(F7 AC-6)에 똑같이 적용됩니다.
12. 광고 시청 뒤 `reportUnlocked`/`shareUnlocked` 저장이 실패하면, 그 열람에 한해서만 콘텐츠를 보여주고 저장된 상태는 바꾸지 않습니다. 그래서 다음 진입 때는 광고를 다시 봐야 할 수 있습니다.
13. 자동 종료의 저장 공간 부족 재시도 횟수는 새로고침 전까지(JS 런타임 수명) 메모리에서만 셉니다. 새로고침하면 다시 2회까지 시도합니다.
14. localStorage에는 DB 제약과 인덱스가 없으므로, PK 고유성·CHECK·정렬은 저장소 계층이 강제합니다. 제약을 어긴 행은 읽을 때 조용히 버리며(오류 표시 없음), 저장소에는 해당 키의 다음 쓰기 때 정리된 배열이 반영됩니다.
15. 홈의 "이번 주"와 랭킹의 "이번 달"은 모두 기록의 **`endedAt`** 기준으로 판정합니다(홈 기준은 PRD에 없어서 랭킹과 맞춘 값입니다).

## Open Questions
1. `@apps-in-toss/web-framework`에 `saveBase64Data`와 `share({ message })`가 있는지, 그리고 시그니처가 무엇인지 콘솔/문서에서 확인해야 합니다.
   - 이미지 파일 자체를 공유하는 API가 있으면 F6 AC-4를 이미지 공유로 바꿉니다.
   - `share()`가 사용자 취소 시에도 reject된다면, 취소는 F6 AC-10 토스트 대상에서 제외할지 정해야 합니다.
2. 연간 근로시간 기준을 PM이 확정해야 합니다(2,080h, 2,088h, 주휴 포함 2,508h 중 선택).
3. 낭비 계수(0.25 / 0.5)를 설정 화면에서 사용자가 바꿀 수 있게 할지 정해야 합니다. MVP에서는 고정값입니다.
4. 회의 진행 중 화면 꺼짐 방지(Wake Lock)가 필요한지 정해야 합니다. iOS 16 WebView 호환성 때문에 MVP에서는 제외했습니다.
5. 기록 백업과 기기 간 동기화 요구가 생기면 별도 Railway API 서버를 설계해야 합니다. 현재 범위에는 없습니다.
6. 벽시계 상한(12시간)과 최대 회의 시간(8시간)이 적절한지 PM이 확정해야 합니다.

---

검증 보고서에는 막히는 문제가 없었고, 경고 3개(FK 없음, 인덱스 없음, 고유성을 코드로만 보장)가 있었습니다. 3개 모두 SPEC에 반영했습니다.

- **id/createdAt/updatedAt:**
  - 테이블은 5개이고, 5개 모두 이 세 필드를 필수로 가집니다.
  - `MeetingSetupInput`, `Page<T>`, `TeamRank`와 두 열거형은 "비저장 타입(테이블 아님)"이라는 별도 절로 옮겼습니다. 이 타입들은 localStorage에 따로 저장되지 않으므로, 세 필드를 붙이면 없는 값을 만들어 넣게 됩니다.
- **FK:**
  - "참조 관계 (논리적 FK)" 표를 추가했습니다. 모든 참조는 5개 테이블 안의 대상을 가리킵니다.
  - 어떤 테이블도 다른 테이블의 id를 컬럼으로 저장하지 않습니다. 그래서 행이 삭제돼도 없는 행을 가리키는 참조가 생기지 않습니다.
- **인덱스:**
  - localStorage에는 인덱스를 만들 수 없습니다. 그래서 저장 순서를 기본 인덱스로 정하고, 조회 경로 표를 추가했습니다.
  - 새 헬퍼 `takeEndedSince`는 날짜 범위에 해당하는 앞부분만 읽습니다(F1 AC-21). 이번 달 랭킹, 이번 주 합계, `hasMeetingOn`이 이 헬퍼를 씁니다.
- **고유성과 제약:**
  - "제약 조건과 강제 방식" 표를 추가하고, F1 AC-20에 테스트할 수 있는 기준을 적었습니다.
  - 데이터를 읽을 때 같은 PK를 가진 행을 하나로 합치고, 범위를 벗어난 값을 걸러내고, 다시 정렬합니다.

**직접 확인하실 부분:**
- **선언 저장 함수를 새로 정의했습니다:** 원래 SPEC에는 NoMeetingDay와 EarnedBadge를 저장하는 함수가 없었습니다. 그래서 `declareNoMeetingDay`에 쓰기 순서와 롤백을 정하고 F7 AC-10을 추가했습니다.
- **잘못된 행은 조용히 버립니다:** 제약을 어긴 행은 읽을 때 오류 표시 없이 버리며, 읽기만으로는 저장소를 고치지 않습니다(Assumptions 14번).
- **"이번 주"를 `endedAt` 기준으로 정했습니다:** 홈의 "이번 주"를 어느 시각으로 판정할지는 PRD에 없었습니다. 랭킹의 "이번 달"과 맞췄습니다(Assumptions 15번).
- **작업 단위가 바뀌었습니다:** WP14는 챌린지 로직만 맡고, WP17(읽기 시 제약 강제와 조회 헬퍼)과 WP18(챌린지 화면)을 새로 나눴습니다.