# Sprint Contract: App.tsx 라우팅, FloatingTabBar, ErrorBoundary, StaleGate 배선

## 만들 항목
1. **src/App.tsx** — BrowserRouter 아래 8개 Route (/, /setup, /meeting, /wrapup/:id, /report/:id, /report/:id/card, /history, /challenge) 정의. FloatingTabBar는 /, /history, /challenge에서만 조건부 렌더.
2. **src/components/StaleGate.tsx** — 앱 마운트 시 autoFinalizeStale() 호출, AUTO_CLOSED_8H 또는 12H 토스트 노출.
3. **src/components/ErrorBoundary.tsx** — App.tsx 루트에서 배선, 렌더 에러 시 재시도 버튼 포함.

## 사용할 TypeScript 타입 (types.ts import)
- `RouteState` — navigate() state 검증
- `MeetingSetupInput`, `MeetingSetup`, `ActiveMeeting`, `MeetingRecord` — 필요 시 타입 가드
- `MeetingOutcome`, `BadgeId`, `Page<T>`, `TeamRank` — 미리 인지

## 검증 방법
- `npx tsc --noEmit` 전 Route 경로 일치 확인
- `npm run test:visual` — 홈/기록/챌린지에서만 FloatingTabBar 보임 + 다른 화면에서 숨김
- 오래된 회의 자동 종료 후 토스트 노출 확인 (mock으로 테스트)
- ErrorBoundary 배치 후 렌더 에러 발생 시 폴백 UI 확인

## 절대 하면 안 되는 것
- **main.tsx 수정 금지** (@AI:ANCHOR) — TDSMobileAITProvider/BrowserRouter 이미 배치
- Route 경로 typo (navigate() 호출처와 정확히 일치)
- FloatingTabBar에 하단 고정 1차 CTA 겹침 — SubmitFooter는 /, /history, /challenge에 금지
