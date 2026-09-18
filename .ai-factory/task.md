# TASK — MeetingCostClock

> 기준 문서: SPEC — MeetingCostClock (F1~F8, S1~S8)
>
> **작업 순서:** ① 타입 → ② 데이터 계층(순수 로직 → 저장소 → 수명주기 → 상태) → ③ 화면(한 태스크에 한 화면 또는 한 화면 조각) → ④ 통합(앱 셸, 라우팅, 검수)
>
> **파일 소유 규칙:** 파일 하나는 태스크 하나만 만들고 수정합니다. 뒤 태스크는 앞 태스크의 파일을 **import만** 하고 수정하지 않습니다. SPEC이 한 파일로 정한 모듈(`storage.ts`, `meetingLifecycle.ts`, `challenge.ts`)은 하위 파일로 나눠 구현합니다. 마지막 태스크가 SPEC 경로의 파일을 만들어 하위 파일을 다시 내보냅니다(re-export). 외부에서는 SPEC 경로로만 import합니다.
>
> **서버:** 서버와 API 라우트는 없습니다(SPEC 공통 원칙). 그래서 API Routes Epic 대신 Epic 2가 내부 함수 API를 구현합니다.
>
> **테스트:** `vitest`와 `@testing-library/react`로 작성합니다. 화면 태스크는 `MemoryRouter`로 감싸 단독으로 테스트합니다.
>
> **모든 태스크 공통 DoD:** 태스크를 마친 뒤 `tsc --noEmit`과 `vitest run`이 통과합니다.

---

## Epic 1. TypeScript 타입 (런타임 코드 없음)

**리스크 평가**
- 복잡도: Low
- 리스크 요인:
  - 타입이 SPEC과 다르면 이후 모든 태스크에서 캐스팅 오류가 연쇄로 납니다. 예: `startedAt`은 ActiveMeeting에서 `number`, MeetingRecord에서 `string`입니다.
  - RouteState가 없으면 페이지마다 state 형태가 달라질 수 있습니다(SplitMate 사고 유형).
- 완화: 타입을 첫 태스크로 고정하고 이후 태스크는 이 파일을 import만 합니다. 이 파일에는 런타임 값이 없으므로 순환 의존이 생기지 않습니다.

### Task 1.1 엔티티, 비저장 타입, 결과 타입, RouteState 정의
- **Description:**
  - `src/lib/types.ts`에 SPEC Data Models의 타입을 글자 그대로 정의합니다.
    - 테이블: `MeetingSetup`, `ActiveMeeting`, `MeetingRecord`, `NoMeetingDay`, `EarnedBadge`
    - 비저장 타입: `MeetingSetupInput`, `MeetingOutcome`, `BadgeId`, `Page<T>`, `TeamRank`
    - 결과 타입: `SaveResult`, `FinalizeResult`, `AutoFinalizeResult`, `StaleResult`, `DeclareResult`
  - 라우트 계약을 정의합니다.
    ```ts
    export type RouteState = {
      '/': null;
      '/setup': { prefill: MeetingSetupInput } | null; // S5 "같은 설정으로 다시 시작"에서만 전달
      '/meeting': null;
      '/wrapup/:id': null;
      '/report/:id': null;
      '/report/:id/card': null;
      '/history': null;
      '/challenge': null;
    };
    export type RecordRouteParams = { id: string };
    ```
  - 파일 상단 주석에 수신 규칙을 적습니다.
    - 먼저 `(useLocation().state as RouteState['/setup']) ?? null`로 받습니다.
    - null을 확인한 뒤 런타임 가드 `isMeetingSetupInput`(Task 2.4)을 통과시킵니다.
    - 구조 분해(`const { prefill } = state as X`)는 금지합니다.
- **DoD:**
  - `grep -E "^(export )?(const|let|function|class)" src/lib/types.ts`가 0건입니다.
  - 필드명, 옵셔널 여부, null 허용 여부가 SPEC과 같습니다. 예: `outcome: MeetingOutcome | null`, `Page.error?: 'corrupted' | 'unavailable'`
  - `RouteState['/setup']`의 객체 키는 `prefill` 하나뿐입니다.
  - `tsc --noEmit`이 통과합니다.
- **Covers:** [F2-AC-6] (RouteState prefill 계약의 기반)
- **Files:** `src/lib/types.ts`
- **Depends on:** none

---

## Epic 2. 데이터 계층 (순수 로직 → 저장소 → 수명주기 → 상태 관리)

**리스크 평가**
- 복잡도: High
- 리스크 요인:
  - `finalizeActive`와 `declareNoMeetingDay`는 여러 키를 씁니다. 롤백 순서가 틀리면 저장소가 불일치 상태로 남습니다.
  - 읽기에서 제약을 강제하다가 `setItem`을 호출하면 AC-20 위반입니다.
  - 재시도 카운터가 앱 셸과 화면에 따로 있으면 토스트가 중복되거나 3번 이상 시도합니다.
  - 다른 데이터 때문에 localStorage 5MB 한도가 차서 quota 오류가 날 수 있습니다.
  - 날짜 키를 UTC로 계산하면 자정을 넘긴 회의 판정이 틀립니다.
- 완화:
  - 순수 함수(cost, time, schema)를 먼저 확정하고, 그 위에 저장소와 수명주기를 쌓습니다.
  - `failSetItemOnNth` 목(Task 2.5)을 먼저 만들어 이후 롤백 테스트에서 재사용합니다.
  - 재시도 카운터는 `meetingLifecycle.ts` 모듈 메모리 한 곳에만 둡니다.
  - 날짜 키는 `localDateKeysBetween` 하나로만 계산합니다.

### Task 2.1 상수와 비용 계산 순수 함수
- **Description:**
  - `src/lib/constants.ts`에 다음 상수를 둡니다.
    - `ANNUAL_WORK_HOURS=2080`, `MAX_DURATION_SEC=28800`, `MAX_WALL_MS=43_200_000`, `MIN_SAVE_SEC=10`
    - `OUTCOME_FACTOR={decided:0, partial:0.25, none:0.5}`
    - `HISTORY_PAGE_SIZE=20`, `RECORDS_MAX=500`
    - 저장 키 5개(`mcc:v1:*`)
  - `src/lib/cost.ts`에 `calcHourly`, `calcCost`, `calcWaste`를 SPEC 수식 그대로 구현합니다. 나눗셈 결과는 모두 `Math.floor`로 내립니다.
- **DoD:**
  - `calcHourly(5,5000)`은 `{perPerson:24038, team:120192, perMinute:2003}`을 반환합니다.
  - `calcCost(5,5000,2700)`은 `90144`, `calcCost(5,5000,0)`은 `0`을 반환합니다.
  - 픽스처에 `calcWaste`를 적용한 결과:
    - `none`: `{overtimeSec:900, overtimeCost:30048, wasteCost:60096, wasteRate:67}`
    - `partial`: wasteCost `45072`
    - `decided`: wasteCost `30048`
  - `totalCost=0`이면 `wasteRate=0`입니다.
  - `cost.ts`의 import는 `constants`와 `types`뿐입니다.
- **Covers:** [F1-AC-1, F1-AC-2, F1-AC-3]
- **Files:** `src/lib/constants.ts`, `src/lib/cost.ts`, `src/lib/__tests__/cost.test.ts`
- **Depends on:** Task 1.1

### Task 2.2 표시 포맷과 사용자 문구 상수
- **Description:**
  - `src/lib/format.ts`에 포맷 함수를 둡니다.
    - `formatWon` → `90,144원`
    - `formatHMS` → `00:45:00`
    - `formatMinutes` → `45분`
    - `formatMonthDay` → `9월 21일`
    - `toLocalDateKey` → 로컬 `YYYY-MM-DD`
  - `src/lib/messages.ts`에 SPEC의 모든 토스트·다이얼로그 문구를 상수로 둡니다. 예: `QUOTA_TOAST`, `TOO_SHORT`, `NO_MEETING_CANCELLED`, `AUTO_CLOSED_8H`, `AUTO_CLOSED_12H`, `RESTART_SAVED`
- **DoD:**
  - `formatWon(90144)`는 `'90,144원'`, `formatHMS(2700)`은 `'00:45:00'`, `formatHMS(28800)`은 `'08:00:00'`입니다.
  - `toLocalDateKey`는 `getFullYear`/`getMonth`/`getDate`만 씁니다(`toISOString` 0건).
  - 각 문구 상수는 SPEC 원문과 글자 단위로 같습니다(문자열 비교 테스트).
- **Covers:** [F1-AC-7] (토스트 문구의 단일 출처)
- **Files:** `src/lib/format.ts`, `src/lib/messages.ts`, `src/lib/__tests__/format.test.ts`
- **Depends on:** Task 1.1

### Task 2.3 회의 시간 순수 함수 (경과, 상한, 만료, 날짜 범위)
- **Description:** `src/lib/meetingTime.ts`에 `getElapsedSec`, `getCapAt`, `resolveStale`, `localDateKeysBetween`을 SPEC의 "회의 시간 상한 규칙"과 "날짜 범위 규칙" 그대로 구현합니다.
  - `tA = startedAt + totalPausedMs + 28_800_000`
    - `pausedAt !== null && tA > pausedAt`이면 `Infinity`로 봅니다.
  - `tB = startedAt + 43_200_000`
  - `capAt = min(tA, tB)`
  - 만료 reason은 `capAt === tA`이면 `'elapsed_cap'`, 아니면 `'wall_cap'`입니다.
- **DoD:**
  - `getElapsedSec({startedAt:1_000_000, pausedAt:1_060_000, totalPausedMs:0}, 1_120_000)`은 `60`입니다.
  - `startedAt` 0인 진행 중 회의에서 `now=32_400_000`이면 `28800`, `now=-5000`이면 `0`입니다.
  - F1-AC-10의 4개 케이스가 SPEC 기대값과 `toEqual`로 일치합니다.
  - `localDateKeysBetween`:
    - 로컬 9/21 23:00 ~ 9/22 00:30은 `["2026-09-21","2026-09-22"]`입니다.
    - 같은 날 10:00 ~ 11:00은 `["2026-09-21"]`입니다.
    - `end < start`이면 `[start 날짜 키]`입니다.
  - 테스트 값은 `new Date(2026, 8, 21, 23, 0)` 같은 로컬 생성자로 만듭니다. 그래서 TZ와 무관하게 통과합니다.
- **Covers:** [F1-AC-4, F1-AC-9, F1-AC-10, F1-AC-18]
- **Files:** `src/lib/meetingTime.ts`, `src/lib/__tests__/meetingTime.test.ts`
- **Depends on:** Task 2.1, Task 2.2

### Task 2.4 스키마 검증과 정규화 순수 함수
- **Description:** `src/lib/schema.ts`를 만듭니다. localStorage에는 접근하지 않습니다.
  - **타입 가드:** `isMeetingSetupInput`, `isMeetingSetup`(`id==='lastSetup'`), `isActiveMeeting`, `isMeetingRecord`, `isNoMeetingDay`(`id===date`), `isEarnedBadge`(`id===badgeId`)
    - 필수 필드와 타입을 확인합니다.
    - ISO 문자열은 `Date.parse`가 NaN이 아니어야 합니다.
    - 범위 CHECK:
      - 참석자 2~100
      - 연봉 1,000~50,000
      - 예정 시간 5~480
      - duration 10~28,800
    - outcome/wasteCost 짝 CHECK를 확인합니다.
    - `endedAt ≥ startedAt`, `totalPausedMs ≥ 0`을 확인합니다.
  - **`normalizeRecords`:**
    - 유효한 행만 남깁니다.
    - 같은 id는 `updatedAt`이 가장 늦은 행을 남깁니다. 같으면 앞쪽 행을 남깁니다.
    - `endedAt` 내림차순으로 정렬하고, 같으면 id 오름차순으로 정렬합니다.
    - 앞 500건만 남깁니다.
  - **`normalizeNoMeetingDays`:** 같은 id는 `createdAt`이 가장 이른 행을 남기고, `date` 오름차순으로 정렬합니다.
  - **`normalizeBadges`:** 같은 id는 `createdAt`이 가장 이른 행을 남기고, `createdAt` 오름차순으로 정렬합니다.
- **DoD:**
  - F1-AC-20의 records 픽스처 A/B/C/D에서 `[C, A]`를 반환합니다.
  - noMeetingDays 픽스처는 T1 행 1개, badges 픽스처는 `first_free_day`의 T1 행 1개를 반환합니다.
  - 다음 행은 버려집니다(각 1건씩 테스트).
    - `createdAt`이 없는 행
    - `updatedAt:"x"`인 행
    - `outcome:'none'`이면서 `wasteCost:null`인 행
    - `endedAt < startedAt`인 행
  - `isMeetingSetup`은 `id:'other'`이나 `attendees:1`이면 `false`입니다.
  - `isActiveMeeting`은 `startedAt`이 없거나 `totalPausedMs:-1`이면 `false`입니다.
  - freeze된 입력으로 호출해도 입력 배열을 바꾸지 않습니다.
- **Covers:** [F1-AC-20]
- **Files:** `src/lib/schema.ts`, `src/lib/__tests__/schema.test.ts`
- **Depends on:** Task 1.1, Task 2.1

### Task 2.5 저장소 기본부 (안전 읽기/쓰기, 싱글턴, 선언/배지)
- **Description:** `src/lib/storageBase.ts`를 만듭니다.
  - **내부 헬퍼(export):**
    - `readRaw(key)`: `getItem` 예외를 `unavailable`로 분류합니다.
    - `parseArray(key)`: JSON 파싱 실패나 배열이 아닌 값을 `corrupted`로 분류합니다.
    - `writeRaw(key, value | null)`: 예외를 분류합니다. QuotaExceededError이거나 code 22/1014면 `quota`, 그 밖은 `unknown`입니다.
  - **공개 함수:**
    - `newId()`: `crypto.randomUUID`가 있으면 쓰고, 없으면 폴백을 씁니다.
    - `loadLastSetup`
    - `saveLastSetup`: 기존 `createdAt`을 유지하고 `updatedAt`을 갱신합니다.
    - `loadActive`, `saveActive`, `clearActive`
    - `loadNoMeetingDays`, `loadBadges`
    - `writeNoMeetingDays`, `writeBadges`: 쓰기 전에 정렬합니다.
  - 읽기 함수는 `console.error`, `setItem`, `removeItem`을 호출하지 않습니다.
  - 테스트 유틸 `src/test/storageMock.ts`를 만듭니다: `failSetItemOnNth(n, err)`, `failAllSetItem()`, `setItemCallKeys()`.
- **DoD:**
  - 빈 저장소에서 `loadActive`와 `loadLastSetup`은 `null`, `loadNoMeetingDays`와 `loadBadges`는 `[]`입니다.
  - F1-AC-20의 lastSetup/active/days/badges 케이스에서:
    - 반환값이 SPEC과 같습니다.
    - `setItem`/`removeItem` 0회, `console.error` 0회입니다.
    - 저장소 문자열이 호출 전과 같습니다.
  - `crypto.randomUUID`를 제거한 환경에서 `newId()`가 `/^\d+-[a-z0-9]{1,6}$/`에 맞습니다.
  - `saveLastSetup`을 2회 호출하면 `createdAt`은 그대로이고 `updatedAt`만 바뀝니다.
- **Covers:** [F1-AC-8, F1-AC-20]
- **Files:** `src/lib/storageBase.ts`, `src/test/storageMock.ts`, `src/lib/__tests__/storageBase.test.ts`
- **Depends on:** Task 2.4

### Task 2.6 저장소 기록 CRUD와 `storage.ts` 공개 모듈
- **Description:**
  - `src/lib/storageRecords.ts`를 만듭니다.
    - `loadRecords()`: `normalizeRecords`를 적용합니다. 오류가 나면 `[]`입니다.
    - `loadRecordsPage(page,size)`: page는 1 이상, size는 1~100으로 보정합니다. `error`에는 `corrupted`나 `unavailable`을 넣습니다.
    - `getRecord`
    - `saveRecord`: id 기준 upsert입니다. 기존 `createdAt`을 유지하고, 정렬한 뒤 500건을 넘으면 끝에서 제거합니다.
    - `updateRecord`: `updatedAt`을 자동 갱신합니다. 없는 id면 `not_found`입니다.
    - `deleteRecord`
    - 모든 쓰기는 `mcc:v1:records` 키 1개만 씁니다.
  - `src/lib/storage.ts`를 만듭니다. `storageBase`와 `storageRecords`의 공개 함수와 `SaveResult`를 다시 내보냅니다. 외부 모듈은 이 파일만 import합니다.
- **DoD:**
  - 500건에서 새 id를 저장하면:
    - 길이 500이 유지됩니다.
    - index 0이 새 기록이고, 가장 오래된 기록이 제거됩니다.
    - noMeetingDays와 badges 문자열은 바뀌지 않습니다.
  - upsert:
    - 3건 중 r1을 교체하면 길이 3입니다.
    - r1은 `totalCost:200`이고 `createdAt`은 기존 값(01:00)입니다.
    - endedAt 내림차순이 유지됩니다.
    - 500건에서 기존 id를 upsert해도 500건입니다.
  - `"{broken"`이 저장되어 있을 때:
    - `loadRecords()`는 `[]`를 반환하고 `console.error`는 0회입니다.
    - `loadRecordsPage(1,20)`은 `{items:[], total:0, page:1, error:'corrupted'}`입니다.
  - `getItem`이 throw하면 `error:'unavailable'`입니다.
  - 45건일 때:
    - page 1/3/4는 각각 20/5/0건이고 `total:45`입니다.
    - `page=0`은 1로 보정됩니다.
    - `size=0`은 1로, `size=500`은 100으로 보정됩니다.
  - `setItem`이 QuotaExceededError를 던지면 `saveRecord`는 `{ok:false, reason:'quota'}`입니다.
  - `updateRecord`와 `deleteRecord`는 quota면 `quota`, 기타 예외면 `unknown`을 반환합니다. 이때 records 문자열은 바뀌지 않습니다.
  - 없는 id로 `updateRecord`나 `deleteRecord`를 호출하면 `not_found`이고 `setItem`은 0회입니다.
  - `updateRecord`가 성공하면 patch 필드와 `updatedAt`만 바뀌고 `createdAt`은 그대로입니다.
  - `deleteRecord('r1')` 뒤 noMeetingDays/badges/lastSetup 문자열은 바뀌지 않습니다.
  - F1-AC-20 A/B/C/D 상태에서 새 기록을 `saveRecord`하면 저장된 배열에 r1이 1개뿐이고 D가 없습니다.
- **Covers:** [F1-AC-5, F1-AC-6, F1-AC-7, F1-AC-8, F1-AC-13, F1-AC-14, F1-AC-15, F1-AC-16, F1-AC-17, F1-AC-20]
- **Files:** `src/lib/storageRecords.ts`, `src/lib/storage.ts`, `src/lib/__tests__/storageRecords.test.ts`
- **Depends on:** Task 2.5

### Task 2.7 정렬 인덱스 조회 헬퍼
- **Description:** `src/lib/recordIndex.ts`를 만듭니다.
  - `takeEndedSince(records, sinceMs)`: 앞에서부터 조건을 만족하는 동안만 수집하고, 처음 조건을 어기면 `break`합니다.
  - `startOfLocalWeekMonday(now)`, `startOfLocalMonth(now)`, `startOfLocalDay(dateKey)`
- **DoD:**
  - F1-AC-21의 4건 픽스처에서 `since=9/1 00:00`이면 앞 3건을 반환합니다.
  - since가 모든 endedAt보다 뒤이면 `[]`, 모두보다 앞이면 4건 전체를 반환합니다.
  - `startOfLocalWeekMonday(new Date(2026,8,27))`(일요일)은 `new Date(2026,8,21).getTime()`입니다.
  - since 이후 항목이 3건이면 `Date.parse` 호출이 4회 이하입니다(스파이로 확인).
- **Covers:** [F1-AC-21]
- **Files:** `src/lib/recordIndex.ts`, `src/lib/__tests__/recordIndex.test.ts`
- **Depends on:** Task 2.6

### Task 2.8 `finalizeActive` (쓰기 순서, 연쇄, 롤백)
- **Description:** `src/lib/finalize.ts`에 `finalizeActive(now)`를 만듭니다. SPEC의 "`finalizeActive` 쓰기 순서와 롤백"을 따릅니다.
  1. active가 없으면 `no_active`를 반환합니다.
  2. 종료 시각은 `endAtMs = min(now, capAt)`입니다. `autoClosed`는 `resolveStale`의 reason이고, 만료가 아니면 null입니다.
  3. `durationSec < 10`이면 active를 null로 씁니다.
     - 성공하면 `too_short`를 반환합니다.
     - 이 쓰기가 실패하면 `quota`를 반환합니다.
  4. 3개 키의 원본 문자열을 스냅샷합니다.
  5. 다음 순서로 씁니다.
     1. noMeetingDays: 취소 대상이 있을 때만 씁니다.
     2. records: `saveRecord`로 upsert합니다.
     3. active: null로 씁니다.
  6. 어느 단계든 실패하면, 이미 쓴 키를 역순으로 복원합니다(스냅샷이 null이면 `removeItem`). 그 뒤 `quota`를 반환합니다.
  - 취소 날짜: `localDateKeysBetween(startedAt, endAtMs)`와 선언된 날짜의 교집합입니다.
  - 새 기록의 초기값:
    - `outcome:null`, `wasteCost:null`
    - unlock 2개 모두 `false`
    - `createdAt = updatedAt = endedAt = ISO(endAtMs)`
- **DoD:**
  - F1-AC-11 픽스처:
    - `{ok:true, cancelledNoMeetingDates:["2026-09-21"], autoClosed:null}`를 반환합니다.
    - record는 `id:"m1"`, `durationSec:2700`, `totalCost:90144`입니다.
    - `setItemCallKeys()`는 `['mcc:v1:noMeetingDays','mcc:v1:records','mcc:v1:active']`입니다.
    - badges 문자열은 그대로입니다.
  - 9시간이 지난 active는 `durationSec:28800`, `endedAt=startedAt+8h`, `autoClosed:'elapsed_cap'`입니다.
  - F1-AC-12의 6개 시나리오가 모두 통과합니다.
    - too_short
    - 모든 쓰기 실패
    - 2번째 키만 실패하면 3키가 원복됩니다.
    - 3번째 키만 실패하면 3키가 원복됩니다.
    - m1이 이미 있으면 m1이 1개만 남습니다.
    - no_active
  - 자정을 넘긴 회의에서 두 날짜를 모두 선언한 상태면 `cancelledNoMeetingDates`는 `["2026-09-21","2026-09-22"]`입니다.
  - `react-router` import와 토스트 코드가 0건입니다.
- **Covers:** [F1-AC-11, F1-AC-12, F1-AC-18, F7-AC-6]
- **Files:** `src/lib/finalize.ts`, `src/lib/__tests__/finalize.test.ts`
- **Depends on:** Task 2.3, Task 2.6

### Task 2.9 `autoFinalizeStale`와 `meetingLifecycle.ts` 공개 모듈
- **Description:** `src/lib/meetingLifecycle.ts`를 만듭니다.
  - `finalizeActive`를 다시 내보냅니다.
  - 모듈 메모리 `failCount: Map<string, number>`를 둡니다.
  - `autoFinalizeStale(now)`:
    - active가 없거나 만료가 아니면 쓰지 않고 `not_stale`을 반환합니다.
    - 해당 id의 실패가 2회 이상이면 `suppressed`를 반환합니다.
    - 그 밖이면 `finalizeActive`를 호출합니다. quota 실패면 카운트를 올립니다. `showQuotaToast`는 카운트가 1이 되는 호출에서만 `true`입니다.
  - `resetAutoFinalizeSession()`
- **DoD:**
  - F1-AC-19:
    - 1회차: `{status:'done', result:{ok:false, reason:'quota'}, showQuotaToast:true}`
    - 2회차: `showQuotaToast:false`
    - 3·4회차: `suppressed`이고 `setItem` 호출 수가 늘지 않습니다.
  - active id가 `m2`로 바뀌면 다시 1회차 결과를 반환합니다.
  - active가 null이거나 만료가 아니면 `not_stale`이고 `setItem`은 0회입니다.
  - 성공하면 `staleReason === resolveStale().reason`입니다.
- **Covers:** [F1-AC-19]
- **Files:** `src/lib/meetingLifecycle.ts`, `src/lib/__tests__/autoFinalizeStale.test.ts`
- **Depends on:** Task 2.8

### Task 2.10 팀 랭킹 순수 함수
- **Description:** `src/lib/ranking.ts`에 `rankTeams(records, period, page, size, now)`를 만듭니다.
  - `thisMonth`면 `takeEndedSince(records, startOfLocalMonth(now))`로 대상을 좁힙니다.
  - `Map`으로 1회 집계합니다.
  - 정렬: totalCost 내림차순 → count 내림차순 → `localeCompare('ko')` 오름차순
  - `sharePercent = round(팀 합계 / 전체 합계 × 100)`
  - rank는 1부터 매기고 결과는 `slice`로 페이지를 나눕니다.
- **DoD:**
  - F5-AC-3 픽스처 결과가 SPEC 객체와 `toEqual`로 같습니다(62%/38%).
  - 팀 21개면 page 1은 20개, page 2는 1개이고 `total:21`입니다.
  - `thisMonth`는 전월 말일 23:59 기록을 제외합니다.
  - 기록 0건이면 `{items:[], total:0, page:1}`이고 결과에 NaN이 0건입니다.
- **Covers:** [F5-AC-3, F5-AC-4]
- **Files:** `src/lib/ranking.ts`, `src/lib/__tests__/ranking.test.ts`
- **Depends on:** Task 2.7

### Task 2.11 챌린지 규칙 순수 함수
- **Description:** `src/lib/challengeRules.ts`를 만듭니다.
  - `hasMeetingOn(dateKey, records, active, now)`:
    - 기록은 `takeEndedSince(records, startOfLocalDay(dateKey))` 범위에서 `localDateKeysBetween`에 dateKey가 들어 있는지 봅니다.
    - active는 `localDateKeysBetween(startedAt, max(startedAt, now))`로 봅니다.
  - `calcStreak(dates, todayKey)`: 주말을 건너뛴 연속 평일 수입니다.
  - `evaluateBadges(days, earned, now)`
  - `badgeProgress(days, earned)`: `{badgeId, name, earnedAt | null, remainingLabel}` 5개를 반환합니다. remainingLabel은 "누적 N일 남음" 또는 "연속 N일 남음"입니다.
  - 배지 이름 상수를 둡니다.
- **DoD:**
  - 선언일이 `["2026-09-18","2026-09-21","2026-09-22"]`이면 결과에 `streak_3`이 있습니다.
  - `["2026-09-17","2026-09-21","2026-09-22"]`이면 `streak_3`이 없습니다.
  - `earned`에 이미 있는 배지는 반환하지 않습니다.
  - 누적 1/5/10/20일이면 각각 `first_free_day`/`total_5`/`total_10`/`total_20`입니다.
  - F7-AC-9의 `hasMeetingOn` 3가지 기대값:
    - 자정을 넘긴 기록 → `true`
    - 전날 23:30에 시작한 active → `true`
    - 전날 10~11시 기록만 있음 → `false`
  - F7-AC-4 조건:
    - 오늘 날짜를 포함하는 기록이 있으면 `true`입니다.
    - 오늘 시작한 active가 있으면 `true`입니다.
- **Covers:** [F7-AC-2, F7-AC-4, F7-AC-9]
- **Files:** `src/lib/challengeRules.ts`, `src/lib/__tests__/challengeRules.test.ts`
- **Depends on:** Task 2.7

### Task 2.12 `declareNoMeetingDay`와 `challenge.ts` 공개 모듈
- **Description:** `src/lib/challenge.ts`를 만듭니다. `challengeRules`를 다시 내보내고 `declareNoMeetingDay(now)`를 구현합니다.
  - **판정 순서:** weekend → already_declared → has_meeting → 쓰기
  - **쓰기 순서:**
    1. noMeetingDays: 새 행을 추가하고 정렬해서 씁니다.
    2. badges: 새 배지가 있을 때만 씁니다.
  - **롤백:** badges 쓰기가 실패하면 noMeetingDays를 스냅샷으로 되돌립니다(스냅샷이 null이면 `removeItem`). QuotaExceededError면 `quota`, 그 밖은 `unknown`을 반환합니다.
  - 새 행과 새 배지의 `createdAt`과 `updatedAt`은 모두 `now.toISOString()`입니다.
- **DoD:**
  - 2026-09-21(월), 기록 0건, active null에서 호출하면:
    - `{ok:true, day:{id:"2026-09-21", date:"2026-09-21", createdAt, updatedAt:createdAt}, newBadges:[first_free_day]}`를 반환합니다.
    - 두 키가 저장됩니다.
  - 이미 선언한 날이면 `already_declared`이고 `setItem`은 0회이며, 같은 id가 1개만 있습니다.
  - 주말이면 `weekend`, 오늘 기록이 있으면 `has_meeting`이고, 두 경우 모두 `setItem`은 0회입니다.
  - 2번째 키만 quota로 실패하면 `quota`이고 두 키의 문자열이 호출 전과 같습니다.
  - 1번째 키가 실패하면 quota면 `quota`, 기타 예외면 `unknown`이고 두 키가 그대로입니다.
- **Covers:** [F7-AC-1, F7-AC-8, F7-AC-10]
- **Files:** `src/lib/challenge.ts`, `src/lib/__tests__/declareNoMeetingDay.test.ts`
- **Depends on:** Task 2.11

### Task 2.13 홈 이번 주 합계와 인덱스 동등성 테스트
- **Description:**
  - `src/lib/weekSummary.ts`에 `weekSummary(records, now): {totalCost, count}`를 만듭니다. 대상은 `takeEndedSince(records, startOfLocalWeekMonday(now))`로 구합니다.
  - 동등성 테스트를 작성합니다. endedAt 내림차순 500건 시드로 다음 세 가지를 테스트 안의 `records.filter` 전체 스캔 구현과 비교합니다.
    - `rankTeams('thisMonth')`
    - `hasMeetingOn`(dateKey 10개)
    - `weekSummary`
- **DoD:**
  - 이번 주 기록 `[90144, 30000]`과 지난주 일요일 23:59 기록 1건이 있으면 `{totalCost:120174, count:2}`입니다.
  - 동등성 테스트 3종이 통과합니다.
- **Covers:** [F8-AC-1, F1-AC-21]
- **Files:** `src/lib/weekSummary.ts`, `src/lib/__tests__/weekSummary.test.ts`, `src/lib/__tests__/recordIndex.equivalence.test.ts`
- **Depends on:** Task 2.10, Task 2.11

### Task 2.14 공유 카드 텍스트와 캔버스 렌더러
- **Description:** `src/lib/shareCard.ts`를 만듭니다.
  - `buildCardLines(record)`: `[title, "9월 21일", "45분", "90,144원", "낭비 추정 60,096원", "MeetingCostClock"]`
  - `buildShareMessage(record)`: F6-AC-4 문구
  - `readTdsColors()`: `getComputedStyle(document.documentElement).getPropertyValue('--tds-color-…')`로 색을 읽습니다. 값이 비면 다른 `--tds-color-*` 변수를 대신 씁니다. 색 리터럴은 쓰지 않습니다.
  - `renderShareCard(record)`: 1080×1350 캔버스에 그리고 `toDataURL('image/png')`를 반환하는 Promise입니다.
- **DoD:**
  - `buildCardLines` 결과에 "주간 스프린트", "45분", "90,144원", "낭비 추정 60,096원", "MeetingCostClock"이 있습니다.
  - 캔버스 목에서 크기가 1080×1350이고 반환값이 `data:image/png`로 시작합니다.
  - `fillStyle`/`strokeStyle`에 넣은 값은 모두 `readTdsColors()` 결과에 속합니다.
  - 다크 변수를 주입하면 그 값으로 그립니다.
  - 파일 안에 `#[0-9a-fA-F]{3,8}\b` 매치가 0건입니다.
- **Covers:** [F6-AC-2, F6-AC-8]
- **Files:** `src/lib/shareCard.ts`, `src/lib/__tests__/shareCard.test.ts`
- **Depends on:** Task 2.2

### Task 2.15 상태 관리 ① 토스트 큐와 종료 결과 알림
- **Description:**
  - `src/state/ToastContext.tsx`: TDS Toast 기반의 `ToastProvider`와 `useToast()`를 만듭니다.
    - `show(msg)`는 메시지를 큐에 넣고 순서대로 하나씩 표시합니다.
    - Provider는 라우트 바깥에 두므로 `navigate` 뒤에도 토스트가 유지됩니다.
  - `src/state/finalizeNotice.ts`: 순수 함수 `finalizeToasts(result, context)`를 만듭니다. context는 `'manual' | 'restart' | 'auto'`입니다.
    - `restart` + ok: `[RESTART_SAVED, 취소 문구?]`
    - `auto` + ok: `[8시간/12시간 문구, 취소 문구?]`
    - `manual` + ok: `[취소 문구?]`
    - `too_short`: `[TOO_SHORT]`
    - "취소 문구?"는 `cancelledNoMeetingDates`가 비어 있지 않을 때만 들어갑니다.
- **DoD:**
  - `show('a'); show('b')`를 호출하면 a가 사라진 뒤 b가 표시됩니다(fake timer).
  - `restart`에 취소 날짜 1개가 있으면 SPEC 문구 2개가 그 순서로 반환됩니다.
  - 취소 날짜가 `[]`이면 취소 문구가 없습니다.
- **Covers:** [F7-AC-6, F2-AC-7]
- **Files:** `src/state/ToastContext.tsx`, `src/state/finalizeNotice.ts`, `src/state/__tests__/finalizeNotice.test.ts`
- **Depends on:** Task 1.1, Task 2.2

### Task 2.16 상태 관리 ② `useActiveMeeting`와 `useNow`
- **Description:**
  - `src/state/useNow.ts`: 1초마다 tick하고 `visibilitychange` 때 다시 계산하는 훅입니다.
  - `src/state/useActiveMeeting.ts`: `{status:'loading'|'ready'|'none', active, elapsedSec, cost, pause(), resume(), reload()}`를 반환합니다. `onTick` 옵션을 받습니다.
    - 첫 렌더에서는 `status`가 `'loading'`이고, effect에서 `loadActive()`를 읽습니다.
    - 경과 시간은 누적하지 않고 매번 `getElapsedSec`로 계산합니다.
    - `pause()`: `pausedAt=now`, `updatedAt`을 갱신한 뒤 `saveActive`로 저장합니다.
    - `resume()`: `totalPausedMs += now − pausedAt`, `pausedAt=null`, `updatedAt`을 갱신해 저장합니다.
- **DoD:**
  - startedAt이 600초 전이면 `elapsedSec`이 600±1입니다.
  - `pause()` 뒤 5초가 지나도 값이 그대로이고, 저장소의 `pausedAt`과 `updatedAt`이 갱신되어 있습니다.
  - `resume()` 뒤 `totalPausedMs`가 5000 늘고 `pausedAt`은 null입니다.
  - 언마운트하면 `clearInterval`이 1회 호출되고 리스너가 해제됩니다.
- **Covers:** [F3-AC-2, F3-AC-3]
- **Files:** `src/state/useActiveMeeting.ts`, `src/state/useNow.ts`, `src/state/__tests__/useActiveMeeting.test.tsx`
- **Depends on:** Task 2.3, Task 2.6

---

## Epic 3. 화면 (한 태스크에 한 화면 또는 한 화면 조각)

**리스크 평가**
- 복잡도: Medium~High
- 리스크 요인:
  - state나 기록 없이 직접 진입하면 크래시할 수 있습니다(undefined에 `.map`).
  - 게이트 순서가 틀리면 `/wrapup`과 `/report` 사이를 무한 이동할 수 있습니다.
  - 광고 fail-open을 빠뜨리면 사용자가 광고 로드 실패 때 막힙니다.
  - TDS 여백을 덮어쓰면 검수에서 반려됩니다.
  - 토스트가 중복될 수 있습니다.
- 완화:
  - 화면 조각(표시 컴포넌트)을 먼저 만들고, 페이지 컨테이너 태스크가 조각을 조립합니다. 그래서 파일 충돌이 없습니다.
  - 모든 `:id` 화면은 공통 `RecordNotFound`와 `useRecordParam`을 씁니다.
  - 게이트 판정은 순수 함수로 테스트합니다.
  - 모든 화면 DoD에 "state나 기록 없이 직접 진입해도 크래시 0" 항목을 넣습니다.

> **모든 화면 공통 DoD**
> - 페이지는 `ScreenScaffold`로 감쌉니다.
> - 간격은 `<Spacing size>`로만 조절합니다.
> - TDS 컴포넌트에 padding/margin 스타일을 넣은 곳이 0건입니다.
> - HEX 색상은 0건입니다.
> - 터치 요소는 44px 이상입니다.
> - 테스트에서 `console.error`는 0회입니다.

### Task 3.1 공통 `RecordNotFound`와 `useRecordParam`
- **Description:**
  - `RecordNotFound`: Asset.ContentIcon, "기록을 찾을 수 없어요", `Button display="block"` "홈으로"(→ `/`)
  - `useRecordParam()`: `useParams<RecordRouteParams>()`로 id를 받고 `getRecord`로 조회합니다. `{id, record | null, reload}`를 반환합니다. id가 없거나 빈 문자열이면 `null`입니다.
- **DoD:**
  - 테스트 라우트 `/report/unknown-id`에서 문구와 버튼이 보이고, 버튼을 탭하면 `/`로 이동합니다.
  - params가 없어도 크래시하지 않고 `null`을 반환합니다.
- **Covers:** [F4-AC-7]
- **Files:** `src/components/RecordNotFound.tsx`, `src/hooks/useRecordParam.ts`, `src/components/__tests__/RecordNotFound.test.tsx`
- **Depends on:** Task 2.6

### Task 3.2 S2 설정 폼 조각 (입력, 검증, 미리보기, 시작)
- **Description:** `src/pages/setup/SetupForm.tsx`와 `src/lib/setupValidation.ts`를 만듭니다.
  - `SetupForm`은 props로 `initial: MeetingSetupInput`을 받습니다.
  - TextField 5개를 둡니다. 숫자 필드는 `inputMode="numeric"`이고, 포커스되면 `scrollIntoView({block:'center'})`를 호출합니다. 마지막 필드에서 Enter를 누르면 제출합니다.
  - `hourly-preview` Card에 1인 시급, 팀 시급(t3), 분당 비용을 표시합니다. 입력이 무효하면 빈 상태 문구를 표시합니다.
  - `validateSetup`은 SPEC 문구를 그대로 반환하는 순수 함수입니다.
  - SubmitFooter "회의 시작"을 누르면 다음 순서로 처리합니다.
    1. `saveLastSetup`
    2. ActiveMeeting 생성: `newId()`, `startedAt=Date.now()`, `createdAt=updatedAt=ISO(startedAt)`
    3. `saveActive`
    4. `navigate('/meeting',{replace:true})`
    - quota가 나면 QUOTA 토스트를 띄우고 이동하지 않습니다.
- **DoD:**
  - 5와 5000을 입력하면 "1인 시급 24,038원", "팀 시급 120,192원", "분당 2,003원"이 표시됩니다.
  - 입력이 무효하면 "참석자 수와 연봉을 입력하면 시급이 계산돼요"가 표시됩니다.
  - 검증 문구:
    - 참석자 빈 값으로 제출하면 "참석자 수를 입력해주세요"가 표시됩니다.
    - 참석자 1 또는 101이면 "참석자는 2~100명까지 입력할 수 있어요"가 표시되고 navigate는 0회입니다.
    - 연봉 빈 값이면 "평균 연봉을 입력해주세요"가 표시됩니다.
    - 연봉 999 또는 50001이면 "연봉은 1,000만~5억 원 사이로 입력해주세요"가 표시됩니다.
    - 예정 시간 4 또는 481이면 "예정 시간은 5~480분 사이로 입력해주세요"가 표시됩니다.
    - 연봉이나 예정 시간이 범위를 벗어나면 제출 버튼이 disabled입니다.
  - F2-AC-2 입력으로 제출하면:
    - active와 lastSetup이 SPEC 형태로 저장됩니다.
    - `navigate('/meeting',{replace:true})`가 1회 호출됩니다.
  - `initial={attendees:8, annualSalaryManwon:6000, …}`이면 필드에 8과 6000이 표시됩니다.
  - 모바일 입력:
    - 숫자 필드 3개는 `inputMode="numeric"`입니다.
    - 포커스하면 `scrollIntoView({block:'center'})`가 호출됩니다.
    - 예정 시간 필드에서 Enter를 누르면 제출됩니다.
- **Covers:** [F2-AC-1, F2-AC-2, F2-AC-3, F2-AC-4, F2-AC-5, F2-AC-6, F2-AC-8]
- **Files:** `src/pages/setup/SetupForm.tsx`, `src/lib/setupValidation.ts`, `src/pages/__tests__/SetupForm.test.tsx`
- **Depends on:** Task 2.6, Task 2.15

### Task 3.3 S2 설정 페이지 (프리필 수신, 진행 중인 회의 다이얼로그)
- **Description:** `src/pages/SetupPage.tsx`와 `src/pages/setup/ActiveMeetingDialog.tsx`를 만듭니다.
  - **프리필 수신:**
    ```ts
    const state = (useLocation().state as RouteState['/setup']) ?? null;
    const prefill = state && isMeetingSetupInput(state.prefill) ? state.prefill : null;
    ```
    - 초기값 우선순위: `prefill` → `loadLastSetup()` → 기본값(plannedMinutes 30)
  - **진행 중인 회의 다이얼로그:** `loadActive()`가 null이 아니면 AlertDialog "진행 중인 회의가 있어요"를 엽니다.
    - "이어서 진행": `navigate('/meeting',{replace:true})`
    - "종료하고 새로 시작": 재시도 제한 없이 `finalizeActive(Date.now())`를 직접 호출합니다.
      - ok: 다이얼로그를 닫고 폼 값을 유지합니다. `finalizeToasts(result,'restart')`를 차례로 표시합니다.
      - too_short: 다이얼로그를 닫고 TOO_SHORT 토스트 1개만 표시합니다. F4-AC-6 다이얼로그는 띄우지 않습니다.
      - quota: 다이얼로그를 그대로 두고 QUOTA 토스트를 표시합니다.
- **DoD:**
  - 진입 상태별로 크래시 없이 렌더됩니다.
    - state 없이 진입: lastSetup 또는 기본값으로 렌더됩니다.
    - `state={prefill:{garbage:1}}`: lastSetup 또는 기본값으로 렌더됩니다.
    - 유효한 prefill: lastSetup보다 prefill이 우선합니다.
  - lastSetup `{attendees:8, annualSalaryManwon:6000}`이 있고 state 없이 진입하면 8과 6000이 채워져 있습니다.
  - active가 있으면 다이얼로그와 버튼 2개가 표시되고, "이어서 진행"을 누르면 `/meeting`으로 replace 이동합니다.
  - "종료하고 새로 시작" ok 경로:
    - navigate는 0회입니다.
    - 폼 값이 유지됩니다.
    - 기록의 `outcome`은 null입니다.
    - "이전 회의를 저장했어요. 회고는 기록 탭에서 입력할 수 있어요"가 표시되고, 취소된 날짜가 있으면 취소 토스트가 그 뒤에 표시됩니다.
  - too_short 경로: active는 null이 되고, 기록은 0건이며, 토스트는 1개입니다.
  - quota 경로: 다이얼로그가 열려 있고, 토스트가 1회 표시되며, active가 유지됩니다.
  - 9시간이 지난 active를 이 경로로 저장하면 `durationSec`은 28800입니다.
- **Covers:** [F2-AC-6, F2-AC-7]
- **Files:** `src/pages/SetupPage.tsx`, `src/pages/setup/ActiveMeetingDialog.tsx`, `src/pages/__tests__/SetupPage.test.tsx`
- **Depends on:** Task 3.2, Task 2.9, Task 2.15

### Task 3.4 S3 타이머 표시 조각
- **Description:** `src/pages/meeting/MeetingTimerView.tsx`를 만듭니다. 순수 표시 컴포넌트입니다.
  - props: `{status, elapsedSec, cost, perMinute, plannedMinutes, paused, frozen, onPauseToggle, onEnd}`
  - SummaryHero `live-cost`: t1, tabular-nums, 화면 상단 1/3 안에 둡니다.
  - Card 1개에 `live-elapsed`와 "분당 N원"을 넣습니다.
  - Badge `overtime-badge`: "예정 시간 N분 초과"
  - Button "일시정지"/"재개": `display="block"`, weak, 높이 56px 이상입니다. `frozen`이면 disabled입니다.
  - AdSlot `data-testid="meeting-banner"`: 콘텐츠 아래, SubmitFooter("회의 종료") 위에 둡니다.
  - `status==='loading'`이면 live-cost 자리에 Skeleton을 표시합니다.
- **DoD:**
  - `elapsedSec=2700`, `cost=90144`이면 "90,144원"과 "00:45:00"이 표시됩니다.
  - `paused`이면 버튼 라벨이 "재개"이고, 아니면 "일시정지"입니다. 탭하면 `onPauseToggle`이 1회 호출됩니다.
  - 초과 배지:
    - planned 30분, 경과 1860초면 "예정 시간 1분 초과"가 표시됩니다.
    - 경과 1800초 이하면 배지가 없습니다.
  - loading 상태에서는 Skeleton이 있고 "0원" 텍스트가 0건입니다.
  - DOM 순서는 live-cost < meeting-banner < SubmitFooter이고, banner는 live-cost 컨테이너 밖에 있습니다.
  - `frozen`이면 일시정지 버튼은 disabled이고 종료 버튼은 enabled입니다.
- **Covers:** [F3-AC-1, F3-AC-2, F3-AC-4, F3-AC-7, F3-AC-8]
- **Files:** `src/pages/meeting/MeetingTimerView.tsx`, `src/pages/__tests__/MeetingTimerView.test.tsx`
- **Depends on:** Task 2.2

### Task 3.5 S3 회의 진행 페이지 (조립, 종료 확정, 자동 종료, 실패 처리)
- **Description:** `src/pages/MeetingPage.tsx`를 만듭니다. `useActiveMeeting`과 `MeetingTimerView`를 조립합니다.
  - **자동 종료:** 마운트할 때와 매 tick(`onTick`)마다 `autoFinalizeStale(Date.now())`를 호출합니다.
    - `done` + ok: 타이머를 멈춥니다. `finalizeToasts(result,'auto')`를 표시하고 `navigate('/wrapup/'+id,{replace:true})`로 이동합니다.
    - `done` + too_short: TOO_SHORT 토스트만 표시하고 `/`로 replace 이동합니다.
    - `done` + quota 또는 `suppressed`: 고정 모드로 전환합니다.
      - `resolveStale`의 durationSec으로 경과와 비용을 고정합니다.
      - `showQuotaToast`가 true일 때만 토스트를 표시합니다.
  - **active 없음:** 자동 종료 확인 결과가 too_short가 아닌데 active가 null이면 다음을 처리합니다.
    - "진행 중인 회의가 없어요" 토스트를 표시합니다.
    - `navigate('/',{replace:true})`로 이동합니다.
  - **수동 종료:** AlertDialog "회의를 종료할까요?"에서 "종료"를 누르면 `finalizeActive(Date.now())`를 호출합니다.
    - ok: 취소 토스트(있으면)를 표시하고 `/wrapup/:id`로 replace 이동합니다.
    - too_short: AlertDialog "10초 미만 회의는 저장되지 않아요"를 띄웁니다. "확인"을 누르면 `/`로 replace 이동합니다.
    - quota: 페이지에 머뭅니다. 누를 때마다 토스트를 1회 표시하고 타이머를 유지합니다.
- **DoD:**
  - `{5, 5000}` 회의에서 2700초가 지나면 live-cost는 "90,144원"이고 live-elapsed는 "00:45:00"입니다.
  - 일시정지를 누르면 5초 동안 값이 그대로이고, 재개하면 다시 증가합니다.
  - startedAt이 600초 전인 active로 마운트하면 "00:10:00"(±1초)이 표시됩니다.
  - active가 null이면 `/`로 replace 이동하고 토스트가 1회 표시됩니다.
  - 2700초에서 종료를 확정하면:
    - records[0]은 id가 active.id이고 `durationSec:2700`, `totalCost:90144`, `outcome:null`입니다.
    - active는 null입니다.
    - `/wrapup/<id>`로 replace 이동합니다.
  - 9초에서 종료하면 다이얼로그가 뜨고, 확인을 누르면 `/`로 이동합니다. 기록은 0건입니다.
  - 수동 종료에서 quota가 나면 이동 0회, 토스트 1회이고 경과가 계속 증가합니다. 2번 누르면 토스트가 2회입니다.
  - elapsed_cap으로 만료된 active로 마운트하면:
    - "8시간이 지나 회의를 자동 종료했어요"가 표시되고 `/wrapup/<id>`로 이동합니다.
    - 기록은 `durationSec:28800`, `endedAt=startedAt+totalPausedMs+8h`입니다.
    - "08:00:00"을 넘는 값이 렌더된 적이 없습니다.
  - `pausedAt=startedAt+1h`에서 12시간 이상 지나면 "12시간이…" 토스트가 뜨고 기록은 `durationSec:3600`, `endedAt=startedAt+12h`입니다.
  - wall_cap인데 경과가 10초 미만이면 토스트는 "10초 미만…" 1개뿐이고 `/`로 이동합니다.
  - 자동 종료가 quota로 실패한 뒤 60초 동안 머물면:
    - `finalizeActive` 호출은 총 2회, 토스트는 1회입니다.
    - "08:00:00"으로 고정되어 있고, 일시정지 버튼은 disabled, 종료 버튼은 enabled입니다.
    - 2번째 tick의 재시도가 성공하면 성공 흐름대로 이동합니다.
  - 고정 모드에서 종료를 확정하면 재시도 제한과 관계없이 `finalizeActive`가 호출됩니다.
- **Covers:** [F3-AC-1, F3-AC-2, F3-AC-3, F3-AC-5, F3-AC-6, F3-AC-9, F3-AC-10, F4-AC-1, F4-AC-6, F4-AC-10]
- **Files:** `src/pages/MeetingPage.tsx`, `src/pages/__tests__/MeetingPage.test.tsx`
- **Depends on:** Task 3.4, Task 2.16, Task 2.9, Task 2.15

### Task 3.6 S4 회고 (`/wrapup/:id`)
- **Description:** `src/pages/WrapupPage.tsx`를 만듭니다.
  - 기록이 없으면 `RecordNotFound`를 표시합니다.
  - 화면 구성:
    - "결론이 났나요?"
    - Chip 3개(높이 44px 이상). 기존 outcome이 있으면 해당 Chip을 미리 선택합니다.
    - 총비용 Card
    - SubmitFooter "리포트 보기". Chip을 고르기 전에는 disabled입니다.
  - 제출하면 `calcWaste`로 계산한 뒤 `updateRecord(id,{outcome, wasteCost})`를 호출합니다.
    - ok: `/report/:id`로 replace 이동합니다.
    - quota/unknown: 페이지에 머뭅니다. 토스트를 1회 표시하고, Chip 선택을 유지하며, 버튼을 다시 활성화합니다.
    - not_found: `RecordNotFound`로 바꿉니다.
- **DoD:**
  - "결론 없음"을 골라 제출하면:
    - 기록이 `{outcome:'none', wasteCost:60096}`이 됩니다.
    - `updatedAt`은 바뀌고 `createdAt`은 그대로입니다.
    - `/report/<id>`로 replace 이동합니다.
  - Chip을 고르기 전에는 버튼이 disabled입니다.
  - `outcome:'partial'`인 기록으로 진입하면 "일부 결론"이 선택되어 있습니다.
  - quota 경로:
    - navigate 0회, 토스트 1회입니다.
    - Chip 선택이 유지되고 버튼이 enabled입니다.
    - 저장소 기록은 `outcome:null`, `wasteCost:null` 그대로입니다.
  - not_found이면 "기록을 찾을 수 없어요"가 표시됩니다.
  - `/wrapup/unknown-id`로 직접 진입해도 크래시하지 않고 `RecordNotFound`가 표시됩니다.
- **Covers:** [F4-AC-2, F4-AC-7, F4-AC-11]
- **Files:** `src/pages/WrapupPage.tsx`, `src/pages/__tests__/WrapupPage.test.tsx`
- **Depends on:** Task 3.1, Task 2.1, Task 2.15

### Task 3.7 S5 리포트 본문과 액션 조각
- **Description:**
  - `src/pages/report/ReportBody.tsx`에 본문을 만듭니다.
    - `report-summary-hero`: SummaryHero + CountUp(totalCost)
    - `report-waste-card`: 낭비 추정액(t2) + Badge `{wasteRate}%` + MiniBar
    - `report-breakdown-card`: 참석자, "45분(예정 30분)", 초과 비용, 분당 비용
  - `src/pages/report/ReportActions.tsx`에 액션을 만듭니다. props는 `{record, shareDisabled}`입니다.
    - "공유 카드 만들기"(`display="block"`): `/report/:id/card`로 이동합니다. `shareDisabled`면 disabled입니다.
    - "같은 설정으로 다시 시작"(weak): `navigate('/setup',{state:{prefill} satisfies RouteState['/setup']})`
    - "기록 삭제"(weak, danger): AlertDialog "이 기록을 삭제할까요?"에서 "삭제"를 누르면 `deleteRecord`를 호출합니다.
      - ok: `/history`로 replace 이동하고 "기록을 삭제했어요"를 표시합니다.
      - quota/unknown: 다이얼로그를 닫고 머물며 "기록을 삭제하지 못했어요. 다시 시도해주세요"를 표시합니다.
      - not_found: "이미 삭제된 기록이에요"를 표시하고 `/history`로 replace 이동합니다.
- **DoD:**
  - 픽스처로 본문을 렌더하면:
    - hero에 90,144가 표시됩니다.
    - waste card에 "60,096원"과 "67%"가 있습니다.
    - MiniBar가 1개입니다.
    - breakdown에 "5명", "45분", "예정 30분", "30,048원", "2,003원"이 있습니다.
  - "같은 설정으로 다시 시작"을 누르면 navigate 인자가 `{state:{prefill:{title, teamName, attendees:5, annualSalaryManwon:5000, plannedMinutes:30}}}`입니다.
  - 삭제 ok:
    - 해당 id가 저장소에서 제거됩니다.
    - noMeetingDays와 badges 문자열은 그대로입니다.
    - `/history`로 replace 이동하고 토스트가 표시됩니다.
  - 삭제 quota: 이동 0회, 실패 토스트가 표시되고 기록이 남아 있습니다.
  - 삭제 not_found: "이미 삭제된 기록이에요"가 표시되고 `/history`로 이동합니다.
  - `shareDisabled`면 공유 버튼이 disabled입니다.
- **Covers:** [F4-AC-5, F5-AC-8, F5-AC-11, F5-AC-12]
- **Files:** `src/pages/report/ReportBody.tsx`, `src/pages/report/ReportActions.tsx`, `src/pages/__tests__/ReportParts.test.tsx`
- **Depends on:** Task 2.6, Task 2.15, Task 2.1

### Task 3.8 S5 리포트 페이지 (게이트, 보상형 광고, 해제 저장)
- **Description:** `src/pages/ReportPage.tsx`와 `src/lib/reportGate.ts`를 만듭니다.
  - `reportGate(record)`는 `'not_found' | 'to_wrapup' | 'ad_gate' | 'open'`을 반환합니다.
  - 판정별 동작:
    - not_found: `RecordNotFound`를 표시합니다. TossRewardAd는 렌더하지 않습니다.
    - to_wrapup: `/wrapup/:id`로 replace 이동합니다.
    - ad_gate: `<TossRewardAd slotId={import.meta.env.VITE_TOSS_AD_SLOT_ID}>`로 본문 전체를 감쌉니다.
      - 시청 완료나 로드 실패(fail-open)가 오면 `updateRecord(id,{reportUnlocked:true})`를 호출합니다.
      - ok: 본문을 해제합니다.
      - quota/unknown: 메모리에서만 해제(`sessionUnlocked`)하고 토스트를 1회 표시합니다. `shareDisabled=true`로 둡니다.
      - not_found: `RecordNotFound`를 표시합니다.
      - 콜백 prop 이름은 템플릿 `TossRewardAd`에서 확인합니다. 래퍼는 수정하지 않습니다.
    - open: `ReportBody`와 `ReportActions`를 렌더합니다.
- **DoD:**
  - `reportUnlocked:false`이면 광고 게이트가 표시됩니다. 시청 완료 뒤 저장소가 `true`가 되고 본문이 표시됩니다.
  - `reportUnlocked:true`이면 TossRewardAd는 0회이고 본문이 바로 표시됩니다.
  - 광고 로드 실패 콜백이 오면 본문이 표시되고 저장소가 `true`가 됩니다.
  - 해제 저장이 quota로 실패하면:
    - navigate 0회입니다.
    - 본문이 표시되고 토스트가 1회 뜹니다.
    - 저장소는 `false`로 남고, 공유 버튼은 disabled입니다.
    - 다시 마운트하면 게이트가 다시 표시됩니다.
  - 해제 저장이 not_found면 `RecordNotFound`가 표시됩니다.
  - `outcome:null`이면 `/wrapup/<id>`로 replace 이동합니다.
  - `/report/unknown-id`면 `RecordNotFound`가 표시되고 TossRewardAd는 0회입니다.
- **Covers:** [F4-AC-3, F4-AC-4, F4-AC-7, F4-AC-8, F4-AC-9, F4-AC-12]
- **Files:** `src/pages/ReportPage.tsx`, `src/lib/reportGate.ts`, `src/pages/__tests__/ReportPage.test.tsx`
- **Depends on:** Task 3.7, Task 3.1

### Task 3.9 S7 기록 목록 조각 (페이지 로딩 훅, 목록, 추이, 빈 상태, 오류, 배너)
- **Description:**
  - `src/pages/history/useRecordPages.ts`: `{items, total, error, pagesLoaded, loadMore(), reloadAll()}`을 반환합니다.
    - 페이지는 `loadRecordsPage(p, 20)`으로 누적해서 불러옵니다.
    - `reloadAll`은 `loadRecordsPage(1..P, 20)`을 다시 호출해 목록을 교체합니다.
  - `src/pages/history/RecordList.tsx`: 목록 표시 컴포넌트입니다.
    - ListRow: 제목, "M월 D일 · 45분 · 5명", 우측 금액, `record-more-button`(`⋯`, `aria-label="더보기"`, 44×44px 이상)
      - 더보기를 탭하면 `stopPropagation` 후 `onMore(id)`만 호출합니다.
      - 행을 탭하면 outcome이 있으면 `/report/:id`, 없으면 `/wrapup/:id`로 이동합니다.
    - `history-trend`: `loadRecordsPage(1,10).items`를 뒤집어 Sparkline으로 그립니다(2건 이상일 때). "최근 10회 평균 N원"을 표시합니다.
    - AdSlot: 5번째 행 뒤에 1개만 둡니다.
    - "더 보기": 누적 행 수가 total보다 작을 때만 표시합니다.
    - 빈 상태: ContentIcon, "아직 기록된 회의가 없어요", "첫 회의 시작하기"(→ `/setup`)
    - 오류: "기록을 불러오지 못했어요"와 "다시 시도"(→ `loadRecordsPage(1,20)` 재호출)를 표시하고 빈 상태 문구는 숨깁니다.
    - `overflow` 스타일을 쓰지 않습니다(문서 스크롤 하나만 사용).
- **DoD:**
  - 기록 3건이면 행 3개가 순서대로 표시되고, 첫 행에 "주간 스프린트", "45분 · 5명", "90,144원"이 있습니다.
  - outcome이 있는 행을 누르면 `/report/<id>`, null이면 `/wrapup/<id>`로 이동합니다.
  - 더보기를 누르면 navigate 0회이고 `onMore`가 1회 호출됩니다.
  - 45건이면 20 → 40 → 45행 순으로 늘어납니다.
    - `loadRecordsPage` 호출 인자는 (1,20), (2,20), (3,20)입니다.
    - 45행이 되면 "더 보기" 버튼이 사라집니다.
  - 추이: 2건 이상이면 Sparkline이 있고, 1건이면 Sparkline 없이 평균만 표시됩니다.
  - 배너: 5건 이상이면 AdSlot이 1개이고 5번째 행 바로 다음 형제입니다. 더 불러와도 1개입니다.
  - 0건이면 빈 상태가 표시됩니다.
  - `"{broken"`이면:
    - 오류 UI가 표시되고 빈 상태 문구는 0건입니다.
    - "다시 시도"를 누르면 `loadRecordsPage(1,20)`이 다시 호출됩니다.
    - `console.error`는 0회입니다.
  - 소스에 `overflow`가 0건입니다.
- **Covers:** [F5-AC-1, F5-AC-2, F5-AC-5, F5-AC-6, F5-AC-7, F5-AC-9, F5-AC-10]
- **Files:** `src/pages/history/useRecordPages.ts`, `src/pages/history/RecordList.tsx`, `src/pages/__tests__/RecordList.test.tsx`
- **Depends on:** Task 2.6, Task 2.2

### Task 3.10 S7 기록 탭 컨테이너 (목록 삭제 흐름)
- **Description:**
  - `src/pages/history/RecordMoreSheet.tsx`: BottomSheet "기록 삭제" → AlertDialog "이 기록을 삭제할까요?"
  - `src/pages/history/RecordListTab.tsx`: `useRecordPages`, `RecordList`, `RecordMoreSheet`를 조립합니다.
  - "삭제"를 누르면 `deleteRecord(id)`를 호출합니다.
    - ok: 페이지에 머물고 "기록을 삭제했어요"를 표시한 뒤 `reloadAll()`을 호출합니다.
    - quota/unknown: 시트와 다이얼로그를 닫고 "기록을 삭제하지 못했어요. 다시 시도해주세요"를 표시합니다.
    - not_found: "이미 삭제된 기록이에요"를 표시하고 `reloadAll()`을 호출합니다.
- **DoD:**
  - `outcome:null`, `reportUnlocked:false`인 기록도 삭제됩니다. 이때 TossRewardAd는 0회입니다.
  - 45건 중 P=2까지 불러온 뒤 삭제에 성공하면:
    - `loadRecordsPage`가 (1,20), (2,20)으로 다시 호출됩니다.
    - 40행이 중복 없이 표시되고 total은 44입니다.
    - 추이와 배너가 새 목록 기준으로 다시 계산됩니다.
  - 기록이 1건일 때 삭제하면 빈 상태가 표시됩니다.
  - noMeetingDays, badges, lastSetup 문자열은 그대로입니다.
  - quota: 행 수는 그대로이고 실패 토스트가 표시됩니다.
  - not_found: 해당 토스트가 표시되고 목록을 다시 불러옵니다.
- **Covers:** [F5-AC-13, F5-AC-14]
- **Files:** `src/pages/history/RecordListTab.tsx`, `src/pages/history/RecordMoreSheet.tsx`, `src/pages/__tests__/RecordListTab.test.tsx`
- **Depends on:** Task 3.9, Task 2.15

### Task 3.11 S7 팀 랭킹 탭과 기록 페이지 조립
- **Description:**
  - `src/pages/history/TeamRankTab.tsx`를 만듭니다.
    - Chip "전체"(기본) / "이번 달"
    - `rankTeams(loadRecords(), period, page, 20, new Date())`로 순위를 구합니다.
    - `team-rank-row`: "N위 팀명", 금액(t5), " · N회", MiniBar
    - "더 보기": 누적 행 수가 total보다 작을 때만 표시합니다.
    - 빈 상태: "팀별 순위를 보려면 회의를 기록해주세요"
    - 오류: `loadRecordsPage(1,1).error`가 있으면 목록 탭과 같은 오류 UI를 표시합니다.
  - `src/pages/HistoryPage.tsx`를 만듭니다. TDS Tab("기록" / "팀 랭킹")으로 `RecordListTab`과 `TeamRankTab`을 전환하고 `ScreenScaffold`로 감쌉니다.
- **DoD:**
  - F5-AC-3 픽스처에서:
    - 행이 "1위 디자인팀 200,000원 · 1회", "2위 플랫폼팀 120,144원 · 2회" 순서입니다.
    - MiniBar 값은 62와 38입니다.
  - 팀이 21개면 20행과 "더 보기"가 보이고, 탭하면 21행이 되고 버튼이 사라집니다.
  - "이번 달"을 누르면 `'thisMonth'`로 호출되고 전월 기록은 빠집니다.
  - 0건이면 빈 문구가 표시되고, corrupted면 오류 UI가 표시됩니다.
  - `/history`에서 탭 2개를 전환할 수 있고 각 탭 내용이 렌더됩니다.
- **Covers:** [F5-AC-3, F5-AC-4, F5-AC-6, F5-AC-10]
- **Files:** `src/pages/history/TeamRankTab.tsx`, `src/pages/HistoryPage.tsx`, `src/pages/__tests__/HistoryPage.test.tsx`
- **Depends on:** Task 3.10, Task 2.10

### Task 3.12 S6 공유 카드 액션 조각 (이미지 저장, 텍스트 공유)
- **Description:**
  - `src/lib/sdkShare.ts`: `@apps-in-toss/web-framework`의 `saveBase64Data`와 `share`를 감쌉니다. 시그니처 차이(Open Question 1)는 이 파일에서만 흡수합니다.
  - `src/pages/card/ShareCardActions.tsx`: props는 `{record, dataUrl, disabled}`입니다.
    - "이미지 저장"(`display="block"`):
      - `saveBase64Data({data:<접두어를 뗀 base64>, fileName:\`meeting-cost-${id}.png\`, mimeType:'image/png'})`를 호출합니다.
      - 성공하면 "이미지를 저장했어요"를 표시합니다.
      - reject되면 "이미지를 저장하지 못했어요. 다시 시도해주세요"를 표시합니다.
    - "공유하기"(weak):
      - `share({message: buildShareMessage(record)})`를 호출합니다.
      - reject되면 "공유하지 못했어요. 다시 시도해주세요"를 표시하고 버튼 상태를 유지합니다.
    - catch 블록에서 `console.error`를 쓰지 않습니다.
- **DoD:**
  - 저장을 누르면 `saveBase64Data`가 `fileName:"meeting-cost-<id>.png"`, `mimeType:"image/png"`로 호출되고 성공 토스트가 뜹니다.
  - 공유를 누르면 `share`가 `{message:"오늘 '주간 스프린트' 회의 비용은 90,144원, 낭비 추정 60,096원이었어요."}`로 호출됩니다.
  - 저장 reject: 실패 토스트가 뜨고 `console.error`는 0회입니다.
  - 공유 reject: 실패 토스트가 뜨고 버튼이 enabled이며 `console.error`는 0회입니다.
  - `disabled`면 두 버튼 모두 disabled입니다.
- **Covers:** [F6-AC-3, F6-AC-4, F6-AC-6, F6-AC-10]
- **Files:** `src/lib/sdkShare.ts`, `src/pages/card/ShareCardActions.tsx`, `src/pages/__tests__/ShareCardActions.test.tsx`
- **Depends on:** Task 2.14, Task 2.15

### Task 3.13 S6 공유 카드 페이지 (진입 게이트, 광고, 생성)
- **Description:** `src/pages/ShareCardPage.tsx`와 `src/lib/cardGate.ts`를 만듭니다.
  - `cardGate(record)`는 `'not_found' | 'to_wrapup' | 'to_report' | 'ad_gate' | 'render'`를 SPEC의 5단계 순서로 반환합니다.
  - ad_gate: TossRewardAd로 감쌉니다. 시청 완료나 로드 실패(fail-open)가 오면 `updateRecord(id,{shareUnlocked:true})`를 호출합니다.
    - ok: 카드를 렌더합니다.
    - quota/unknown: 메모리에서만 해제해 렌더하고 토스트를 1회 표시합니다.
    - not_found: `RecordNotFound`를 표시하고 캔버스는 그리지 않습니다.
  - 생성 단계:
    - `renderShareCard`가 끝날 때까지 Skeleton과 "카드를 만들고 있어요"를 표시하고 `ShareCardActions`는 disabled로 둡니다.
    - 끝나면 Card 안에 `<img data-testid="share-card-image">`를 표시합니다(폭 100%, 4:5).
  - Top 뒤로가기는 `navigate(-1)`입니다.
- **DoD:**
  - 기록이 없으면 `RecordNotFound`가 표시되고, TossRewardAd, `renderShareCard`, `saveBase64Data`, `share`는 모두 0회입니다.
  - outcome이 null이면 `/wrapup/<id>`로 replace 이동합니다.
  - `reportUnlocked:false`면 `/report/<id>`로 replace 이동합니다. 카드 광고는 0회이고 `shareUnlocked`는 그대로입니다.
  - 시청 완료 뒤 저장소가 `shareUnlocked:true`가 되고 img src가 `data:image/png`로 시작합니다.
  - 광고 로드가 실패해도 카드가 생성되고 저장소가 `true`가 됩니다. 로딩 중에는 버튼이 disabled입니다.
  - 해제 저장 quota:
    - 이동 0회입니다.
    - 카드와 enabled 버튼이 표시되고 토스트가 1회 뜹니다.
    - 저장소는 `false`로 남고, 다시 마운트하면 게이트가 다시 표시됩니다.
  - 해제 저장 not_found: `RecordNotFound`가 표시되고 캔버스는 0회입니다.
- **Covers:** [F6-AC-1, F6-AC-5, F6-AC-7, F6-AC-9, F6-AC-11, F6-AC-12, F6-AC-13]
- **Files:** `src/pages/ShareCardPage.tsx`, `src/lib/cardGate.ts`, `src/pages/__tests__/ShareCardPage.test.tsx`
- **Depends on:** Task 3.12, Task 3.1, Task 3.8

### Task 3.14 S8 챌린지 (`/challenge`)
- **Description:** `src/pages/ChallengePage.tsx`를 만듭니다.
  - 진입할 때 `loadNoMeetingDays()`와 `loadBadges()`를 1회 읽어 `Set`으로 만듭니다.
  - `challenge-summary` Card: "누적 N일 · 연속 N일"(t3). 선언이 0건이면 "첫 회의 없는 날에 도전해보세요"도 표시합니다.
  - 선언 버튼(`display="block"`)의 상태 우선순위:
    1. 주말: disabled, "주말엔 챌린지가 쉬어요"
    2. 오늘 이미 선언: 라벨 "오늘 선언 완료", disabled
    3. `hasMeetingOn`이 참: disabled, "오늘은 이미 회의가 있었어요"
    4. 그 밖: 활성
  - 버튼을 누르면 `declareNoMeetingDay(new Date())`를 호출합니다.
    - ok: 상태를 갱신합니다. 새 배지가 있으면 BottomSheet "배지 획득! {이름}"을 표시합니다.
    - quota/unknown: 토스트를 1회 표시하고 버튼을 다시 활성화합니다.
  - `badge-item` ListRow 5개:
    - 획득한 배지: "M월 D일 획득"
    - 미획득 배지: `remainingLabel`과 `var(--tds-color-grey-400)`
- **DoD:**
  - 2026-09-21(월)에 누르면:
    - 저장소에 선언이 추가됩니다.
    - "배지 획득! 첫 해방"이 표시됩니다.
    - 버튼이 "오늘 선언 완료"(disabled)로 바뀝니다.
  - `badge-item`은 5개입니다.
    - 획득한 배지에는 "9월 21일 획득"이 표시됩니다.
    - 미획득 배지에는 "누적 4일 남음" 같은 문구와 grey-400이 적용됩니다.
  - 오늘 기록이 있거나 오늘 시작한 active가 있으면 버튼이 disabled이고 "오늘은 이미 회의가 있었어요"가 표시됩니다.
  - 자정을 넘긴 픽스처 3종에서 버튼 상태가 F7-AC-9와 같습니다.
  - 토요일이면 disabled이고 "주말엔 챌린지가 쉬어요"가 표시됩니다.
  - 선언이 0건이면 "누적 0일 · 연속 0일"과 도전 문구가 표시됩니다.
  - 배지 저장이 quota로 실패하면:
    - 페이지에 머물고 토스트가 1회 뜹니다.
    - BottomSheet는 0회입니다.
    - 버튼이 enabled입니다.
- **Covers:** [F7-AC-1, F7-AC-3, F7-AC-4, F7-AC-5, F7-AC-7, F7-AC-8, F7-AC-9, F7-AC-10]
- **Files:** `src/pages/ChallengePage.tsx`, `src/pages/__tests__/ChallengePage.test.tsx`
- **Depends on:** Task 2.12, Task 2.15

### Task 3.15 S1 홈 대시보드 (`/`)
- **Description:** `src/pages/HomePage.tsx`를 만듭니다. 위에서부터 다음 순서로 배치합니다.
  1. `active-meeting-card`(active가 있을 때만): 회의명, 비용(`useNow` + `getElapsedSec` + `calcCost`), "이어서 보기"(→ `/meeting`)
  2. `week-summary-hero`: `weekSummary(loadRecords(), new Date())`의 합계를 CountUp으로 표시하고, 부제 "이번 주 회의 N회"를 붙입니다.
  3. 최근 회의: `loadRecordsPage(1,3).items`를 ListRow(높이 48px 이상)로 표시하고, "전체 보기"(→ `/history`)를 둡니다.
  4. SubmitFooter: "새 회의 시작"(→ `/setup`). active가 있으면 "진행 중인 회의로 이동"(→ `/meeting`)입니다.
  - 빈 상태: 기록이 0건이고 active가 없으면 ContentIcon과 "회의 한 번에 얼마가 드는지 확인해보세요"를 표시하고 hero는 숨깁니다.
- **DoD:**
  - 이번 주 기록 `[90144, 30000]`이면 "120,174원"과 "이번 주 회의 2회"가 표시됩니다.
  - "새 회의 시작"을 누르면 state 없이 `navigate('/setup')`이 호출됩니다.
  - active가 있을 때:
    - 카드가 표시되고 1초 뒤 비용이 증가합니다.
    - 9시간이 지난 active는 비용이 28,800초분에서 멈춥니다.
    - footer 라벨이 "진행 중인 회의로 이동"입니다.
  - 기록 0건이고 active가 없으면 빈 문구가 표시되고 hero는 0건입니다.
  - 최근 회의 행을 누르면 outcome에 따라 `/report/:id` 또는 `/wrapup/:id`로 이동합니다.
- **Covers:** [F8-AC-1, F8-AC-2, F8-AC-3]
- **Files:** `src/pages/HomePage.tsx`, `src/pages/__tests__/HomePage.test.tsx`
- **Depends on:** Task 2.13, Task 2.16

---

## Epic 4. 통합과 마무리 (앱 셸, 라우팅, 검수 준수)

**리스크 평가**
- 복잡도: Medium
- 리스크 요인:
  - 자동 종료보다 라우트가 먼저 렌더되면 토스트가 중복되거나 F2-AC-7 다이얼로그가 잘못 뜹니다.
  - 탭바가 대상이 아닌 경로에도 노출될 수 있습니다.
  - HEX 색상, 외부 링크, 로깅 SDK가 섞여 들어오면 검수에서 반려됩니다.
  - es2017에서 지원하지 않는 API를 쓰면 구형 WebView에서 크래시가 납니다.
- 완화:
  - `StaleGate`를 독립 컴포넌트로 먼저 확정합니다. `App.tsx`는 그 뒤 한 태스크에서만 조립합니다.
  - grep 검수 테스트와 E2E 순회로 마지막에 확인합니다.

### Task 4.1 앱 시작 시 만료 회의 자동 종료 (`StaleGate`)
- **Description:** `src/components/StaleGate.tsx`를 만듭니다. `children`(라우트)을 감싸는 컴포넌트입니다.
  - 마운트할 때 `autoFinalizeStale(Date.now())`를 1회 실행합니다. 끝날 때까지 `null`을 렌더합니다.
  - 결과별 처리:
    - `done` + ok: `finalizeToasts(result,'auto')`를 표시합니다.
      - 경로가 `/meeting`이면 `/wrapup/:id`로 replace 이동합니다.
      - 다른 경로면 이동하지 않습니다.
    - `done` + too_short: TOO_SHORT 토스트를 표시합니다. `/meeting`이면 `/`로 replace 이동합니다.
    - `done` + quota: `showQuotaToast`일 때만 토스트를 표시하고 이동하지 않습니다.
  - 이동은 `ready` 상태로 바꾸기 전에 실행합니다.
  - 테스트는 `MemoryRouter`와 스텁 라우트(`/meeting`, `/wrapup/:id`, `/history`, `/setup`, `/`)로 합니다.
- **DoD:**
  - 9시간이 지난 active로 `/meeting`에 진입하면:
    - 기록이 `durationSec:28800`, `endedAt=capAt`으로 저장됩니다.
    - "8시간이…" 토스트가 1회 뜹니다.
    - `/wrapup/<id>` 스텁이 렌더되고, `/meeting` 스텁 렌더는 0회입니다.
  - 같은 조건으로 `/history`에 진입하면 이동 없이 렌더되고 토스트가 1회 뜹니다.
  - 같은 조건으로 `/setup`에 진입하면 active가 null이 됩니다(다이얼로그 조건 해소).
  - 일시정지 후 12시간이 지났으면 "12시간이…" 토스트가 뜹니다.
  - too_short로 `/meeting`에 진입하면 토스트는 "10초 미만…" 1개이고 `/`로 이동합니다.
  - quota로 `/meeting`에 진입하면:
    - `finalizeActive`가 1회 호출되고 토스트가 1회 뜹니다.
    - 같은 세션에서 `autoFinalizeStale`을 한 번 더 호출하면 `showQuotaToast:false`입니다(카운터 공유).
- **Covers:** [F8-AC-10, F3-AC-10]
- **Files:** `src/components/StaleGate.tsx`, `src/components/__tests__/StaleGate.test.tsx`
- **Depends on:** Task 2.9, Task 2.15

### Task 4.2 라우트 연결, FloatingTabBar, ErrorBoundary (`App.tsx`)
- **Description:**
  - `src/App.tsx`를 다음 구조로 조립합니다: `ToastProvider` → `ErrorBoundary` → `StaleGate` → `<Routes>`
  - 라우트:
    - `/`, `/setup`, `/meeting`, `/wrapup/:id`, `/report/:id`, `/report/:id/card`, `/history`, `/challenge`
    - `*`는 `<Navigate to="/" replace/>`로 보냅니다.
  - `TabBarVisibility`: 경로가 `/`, `/history`, `/challenge`일 때만 템플릿 `FloatingTabBar`(홈 / 기록 / 챌린지)를 렌더합니다.
  - `ErrorBoundary`:
    - 클래스 컴포넌트로 만들고 `console.error`를 호출하지 않습니다.
    - 오류가 나면 "문제가 생겼어요"와 "홈으로"를 표시합니다.
- **DoD:**
  - 8개 경로에서 각각 해당 페이지가 렌더됩니다(스모크 테스트).
  - `/unknown`은 `/`로 리다이렉트됩니다.
  - FloatingTabBar는 탭 대상 3개 경로에서 1개, 나머지 5개 경로에서 0개입니다.
  - 자식이 throw하면 "문제가 생겼어요"와 "홈으로"가 표시됩니다. "홈으로"를 누르면 `/`로 가서 복구되고, body 텍스트가 1자 이상입니다.
  - 9시간이 지난 active로 `/meeting`에 진입하면 MeetingPage 렌더 없이 WrapupPage가 표시됩니다.
- **Covers:** [F8-AC-4, F8-AC-5, F8-AC-10]
- **Files:** `src/App.tsx`, `src/components/ErrorBoundary.tsx`, `src/components/TabBarVisibility.tsx`, `src/__tests__/App.routes.test.tsx`
- **Depends on:** Task 4.1, Task 3.3, Task 3.5, Task 3.6, Task 3.8, Task 3.11, Task 3.13, Task 3.14, Task 3.15

### Task 4.3 검수 정적 테스트와 빌드 타깃
- **Description:**
  - `src/__tests__/compliance.test.ts`를 만듭니다. `src/**/*.{ts,tsx,css}`와 `package.json`에서 다음 항목을 검사합니다.
    - 외부 이탈: `window.open(`, `window.location.href =`, `target="_blank"`, 외부 `https?://`
    - 외부 로깅: `gtag`, `google-analytics`, `amplitude`, `mixpanel`, `firebase/analytics`
    - 설치 유도 문구: "앱을 설치", "다운로드"
    - HEX 색상: `#[0-9a-fA-F]{3,8}\b` (`shareCard.ts` 포함)
    - 폴백 없는 최신 API: `structuredClone`, `.at(`, `Object.hasOwn`. `crypto.randomUUID`는 `storageBase.ts`에서만 허용합니다.
    - TDS 여백 덮어쓰기: `style={{` 안의 padding/margin
    - 금지 UI 라이브러리 import: shadcn, MUI, antd, chakra
  - `vite.config.ts`에 `build.target: 'es2017'`을 설정합니다.
- **DoD:**
  - 모든 항목이 0건이라 테스트가 통과합니다.
  - `vite build`가 성공하고 `build.target === 'es2017'`입니다.
  - 음성 대조: 임시 문자열 `#fff`를 검사 함수에 넣으면 1건이 검출됩니다.
- **Covers:** [F8-AC-6, F8-AC-7, F8-AC-8, F8-AC-9]
- **Files:** `src/__tests__/compliance.test.ts`, `vite.config.ts`
- **Depends on:** Task 4.2

### Task 4.4 전체 흐름 E2E와 콘솔 에러 0 순회
- **Description:** `src/__tests__/e2e.flow.test.tsx`에서 `<App/>`을 `MemoryRouter`로 렌더하고 `console.error`에 spy를 겁니다.
  - **흐름 A:** `/` → `/setup` 입력 → `/meeting`(2700초 경과) → 종료 → `/wrapup`에서 "결론 없음" → `/report` 광고 완료 → "60,096원" 확인 → 공유 카드 → 이미지 저장
  - **흐름 B:** `/challenge`에서 선언 → 회의 → 종료
    - 선언 취소 토스트가 표시되는지 확인합니다.
    - badges가 바뀌지 않는지 확인합니다.
    - 그 기록을 삭제해도 선언이 복원되지 않는지 확인합니다.
  - **흐름 C:** 8개 라우트를 빈 저장소와 시드 저장소로 각각 방문합니다.
  - **광고 배치:** `meeting-banner`와 `/history`의 AdSlot이 콘텐츠 testid 요소와 부모-자식 관계가 아닌지 확인합니다.
  - **quota 토스트:** 전체 흐름에서 quota 목을 켰을 때 F1-AC-7 토스트 문구가 표시되는지 확인합니다.
  - `docs/QA_CHECKLIST.md`에 수동 확인 항목을 적습니다: 8개 라우트, 라이트/다크 모드, 44px 터치 영역
- **DoD:**
  - 흐름 A, B, C가 통과합니다.
  - 전체 순회에서 `console.error`는 0회입니다.
  - 흐름 B에서 삭제한 뒤에도 `loadNoMeetingDays()`에 해당 날짜가 없습니다.
  - quota 목에서 "저장 공간이 부족해요. 오래된 기록을 삭제해주세요"가 1회 표시됩니다.
  - QA 체크리스트에 8개 라우트와 라이트/다크 확인 항목이 있습니다.
- **Covers:** [F8-AC-9, F7-AC-6, F3-AC-8, F5-AC-9, F1-AC-7]
- **Files:** `src/__tests__/e2e.flow.test.tsx`, `docs/QA_CHECKLIST.md`
- **Depends on:** Task 4.3

---

## AC Coverage

- **Total ACs in SPEC: 98**
  - F1: 21, F2: 8, F3: 10, F4: 12, F5: 14, F6: 13, F7: 10, F8: 10
- **Covered by tasks: 98**
  - F1-AC-1 (2.1), F1-AC-2 (2.1), F1-AC-3 (2.1), F1-AC-4 (2.3), F1-AC-5 (2.6), F1-AC-6 (2.6), F1-AC-7 (2.2, 2.6, 4.4), F1-AC-8 (2.5, 2.6), F1-AC-9 (2.3), F1-AC-10 (2.3), F1-AC-11 (2.8), F1-AC-12 (2.8), F1-AC-13 (2.6), F1-AC-14 (2.6), F1-AC-15 (2.6), F1-AC-16 (2.6), F1-AC-17 (2.6), F1-AC-18 (2.3, 2.8), F1-AC-19 (2.9), F1-AC-20 (2.4, 2.5, 2.6), F1-AC-21 (2.7, 2.13)
  - F2-AC-1 (3.2), F2-AC-2 (3.2), F2-AC-3 (3.2), F2-AC-4 (3.2), F2-AC-5 (3.2), F2-AC-6 (1.1, 3.2, 3.3), F2-AC-7 (2.15, 3.3), F2-AC-8 (3.2)
  - F3-AC-1 (3.4, 3.5), F3-AC-2 (2.16, 3.4, 3.5), F3-AC-3 (2.16, 3.5), F3-AC-4 (3.4), F3-AC-5 (3.5), F3-AC-6 (3.5), F3-AC-7 (3.4), F3-AC-8 (3.4, 4.4), F3-AC-9 (3.5), F3-AC-10 (3.5, 4.1)
  - F4-AC-1 (3.5), F4-AC-2 (3.6), F4-AC-3 (3.8), F4-AC-4 (3.8), F4-AC-5 (3.7), F4-AC-6 (3.5), F4-AC-7 (3.1, 3.6, 3.8), F4-AC-8 (3.8), F4-AC-9 (3.8), F4-AC-10 (3.5), F4-AC-11 (3.6), F4-AC-12 (3.8)
  - F5-AC-1 (3.9), F5-AC-2 (3.9), F5-AC-3 (2.10, 3.11), F5-AC-4 (2.10, 3.11), F5-AC-5 (3.9), F5-AC-6 (3.9, 3.11), F5-AC-7 (3.9), F5-AC-8 (3.7), F5-AC-9 (3.9, 4.4), F5-AC-10 (3.9, 3.11), F5-AC-11 (3.7), F5-AC-12 (3.7), F5-AC-13 (3.10), F5-AC-14 (3.10)
  - F6-AC-1 (3.13), F6-AC-2 (2.14), F6-AC-3 (3.12), F6-AC-4 (3.12), F6-AC-5 (3.13), F6-AC-6 (3.12), F6-AC-7 (3.13), F6-AC-8 (2.14), F6-AC-9 (3.13), F6-AC-10 (3.12), F6-AC-11 (3.13), F6-AC-12 (3.13), F6-AC-13 (3.13)
  - F7-AC-1 (2.12, 3.14), F7-AC-2 (2.11), F7-AC-3 (3.14), F7-AC-4 (2.11, 3.14), F7-AC-5 (3.14), F7-AC-6 (2.8, 2.15, 4.4), F7-AC-7 (3.14), F7-AC-8 (2.12, 3.14), F7-AC-9 (2.11, 3.14), F7-AC-10 (2.12, 3.14)
  - F8-AC-1 (2.13, 3.15), F8-AC-2 (3.15), F8-AC-3 (3.15), F8-AC-4 (4.2), F8-AC-5 (4.2), F8-AC-6 (4.3), F8-AC-7 (4.3), F8-AC-8 (4.3), F8-AC-9 (4.3, 4.4), F8-AC-10 (4.1, 4.2)
- **Uncovered: 0**

---

### 이번 수정에서 바뀐 점
- **AC 표기 형식:** 모든 Covers를 `F1-AC-1`처럼 하이픈을 넣은 개별 ID로 적었습니다. 범위 표기(`AC-1~6`)는 없앴습니다.
- **파일 충돌 해소:** 이제 모든 파일은 태스크 하나에만 속합니다. SPEC이 한 파일로 정한 모듈은 다음과 같이 나눴습니다.

  | 모듈 | 나눈 방식 |
  |---|---|
  | `storage.ts` | `storageBase.ts`(2.5) + `storageRecords.ts`(2.6). `storage.ts`는 2.6에서 두 파일을 다시 내보냅니다. |
  | `meetingLifecycle.ts` | `finalize.ts`(2.8) + `meetingLifecycle.ts`(2.9) |
  | `challenge.ts` | `challengeRules.ts`(2.11) + `challenge.ts`(2.12) |

- **화면 분리:** 표시 조각을 먼저 만들고, 페이지 컨테이너 태스크가 조각을 조립합니다.

  | 화면 | 조각 태스크 | 컨테이너 태스크 |
  |---|---|---|
  | 설정 | `SetupForm`(3.2) | `SetupPage`(3.3) |
  | 회의 진행 | `MeetingTimerView`(3.4) | `MeetingPage`(3.5) |
  | 리포트 | `ReportBody`/`ReportActions`(3.7) | `ReportPage`(3.8) |
  | 기록 | `RecordList`(3.9), `RecordListTab`(3.10) | `HistoryPage`(3.11) |
  | 공유 카드 | `ShareCardActions`(3.12) | `ShareCardPage`(3.13) |

- **게이트 함수:** `gates.ts`를 `reportGate.ts`(3.8)와 `cardGate.ts`(3.13)로 나눴습니다.
- **`App.tsx`:** `StaleGate`(4.1)를 먼저 독립 컴포넌트로 확정하고, `App.tsx`는 4.2에서만 만듭니다.
- **남은 위험:** `saveBase64Data`와 `share`의 시그니처가 아직 확인되지 않았습니다(Open Question 1). 영향은 `src/lib/sdkShare.ts`(Task 3.12) 한 파일에만 미치도록 격리했습니다.