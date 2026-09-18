# Changelog

## [0.1.0] - 2026-09-18

20/20 packets completed.

### Added
- feat: 엔티티 타입, RouteState 계약, 전역 상수 (packet 0001)
- feat: 비용 계산, 표시 포맷, 사용자 문구 순수 함수 (packet 0002)
- feat: 회의 시간 상한/날짜 범위 함수와 스키마 검증 (packet 0003)
- feat: 저장소 계층 (안전 읽기/쓰기, CRUD, 페이지 조회, storage.ts 공개 모듈) (packet 0004)
- feat: 회의 수명주기 (startMeeting, 일시정지/재개, finalizeActive 롤백, autoFinalizeStale) (packet 0005)
- feat: 팀 랭킹, 챌린지 규칙, declareNoMeetingDay (challenge.ts) (packet 0006)
- feat: 홈 이번 주 합계와 공유 카드 텍스트/캔버스 렌더러 (packet 0007)
- feat: 상태 훅 (useActiveMeeting, useNow, useToastQueue, useRecordParam, RecordNotFound) (packet 0008)
- feat: S2 설정 폼 조각 (입력, 범위 검증, 시급 미리보기) (packet 0009)
- feat: S2 회의 설정 페이지 (/setup: 프리필, 진행 중 다이얼로그, 시작) (packet 0010)
- feat: S3 타이머 표시 조각 (실시간 비용, 경과 시간, 초과 표시) (packet 0011)
- feat: S3 회의 진행 페이지 (/meeting: 일시정지, 종료 확정, 자동 종료, 배너) (packet 0012)
- feat: S4 회고 페이지 (/wrapup/:id: 결론 여부 선택) (packet 0013)
- feat: S5 리포트 페이지 (/report/:id: 보상형 광고 게이트, 낭비 분석, 액션) (packet 0014)
- feat: S1 홈 대시보드 (/: 진행 중 카드, 이번 주 합계, 최근 회의) (packet 0015)
- feat: [부가] S6 공유 카드 페이지 (/report/:id/card: 광고 게이트, 이미지 저장, 텍스트 공유) (packet 0016)
- feat: [부가] S7 기록 페이지 (/history: 목록 탭, 팀 랭킹 탭, 삭제, 배너) (packet 0017)
- feat: [부가] S8 챌린지 페이지 (/challenge: 회의 없는 날 선언, 연속 기록, 배지) (packet 0018)
- feat: App.tsx 라우팅, FloatingTabBar, ErrorBoundary, StaleGate 배선 (packet 0019)
- feat: 검수 준수 정적 테스트와 핵심 여정 E2E (packet 0020)
