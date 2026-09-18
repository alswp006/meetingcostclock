🇰🇷 [English](./README.md)

# 회의비용시계 — 실시간 회의 원가 계산기

토스 앱을 위한 미니앱으로, 참석자 수와 평균 연봉을 기반으로 회의의 실시간 노동 원가를 계산합니다. 직장인이 불필요한 회의 비용을 이해하고 줄이는 데 도움을 줍니다.

사용자는 회의 정보(참석자, 평균 연봉, 예상 시간)를 입력하고 타이머를 시작하면 누적된 노동 원가가 실시간으로 표시됩니다. 회의가 끝나면 원가 내역을 확인하고 회의 결과에 따라 낭비를 추정할 수 있습니다.

## 기능

- 📊 **실시간 원가 계산** — 회의 원가가 초 단위로 누적되는 라이브 타이머
- 📈 **주간 요약** — 주간 회의 총액과 최근 회의 기록을 보여주는 대시보드
- ⏱️ **회의 관리** — 회의 시작, 일시중지, 종료 및 자동 초과 시간 추적
- 📋 **원가 보고서** — 회의 결과에 따른 낭비 추정을 포함한 상세 원가 내역
- 🏆 **팀 랭킹** — 챌린지 성과를 추적하는 리더보드
- 📱 **회의 기록** — 기간별 필터링이 가능한 전체 회의 기록
- 🎯 **챌린지 규칙** — 일일/주간 챌린지와 회의 없는 날 선언
- 📢 **광고 통합** — 기록 보기의 배너 광고와 보고서 잠금 해제용 리워드 광고

## 기술 스택

- **프레임워크**: Vite + React 18 + TypeScript
- **UI 컴포넌트**: @toss/tds-mobile (Toss Design System)
- **라우팅**: React Router DOM
- **상태 관리**: React hooks + localStorage
- **배포**: App-in-Toss WebView (CSR)
- **테스트**: Vitest + @testing-library/react, Playwright (시각 회귀 테스트)

## 시작하기

### 의존성 설치
```bash
npm install
```

### 운영 빌드
```bash
npx vite build
```
토스 CDN 호스팅용 정적 번들을 `dist/`에 생성합니다.

### 토스에 빌드 및 배포
```bash
npx ait build
npx ait deploy
```
앱을 토스 검수에 제출하고 운영 환경에 배포합니다. (토스 개발자 자격증명 필요)

### 테스트 실행
```bash
npx vitest run              # 단위 테스트
npm run test:visual         # 시각 회귀 테스트 (Playwright)
npm run typecheck           # TypeScript 타입 검사
```

## 환경 변수

| 변수 | 설명 | 필수 |
|------|------|------|
| `VITE_APP_NAME` | 토스 콘솔에 등록된 앱 ID (배포용) | 아니오 (apps-in-toss.config.ts에서 가져옴) |

참고: 이는 백엔드가 없는 클라이언트 전용 앱입니다. 모든 설정은 `apps-in-toss.config.ts`에 있습니다.

## 프로젝트 구조

```
src/
  pages/
    Home.tsx                 # 대시보드: 진행 중인 회의, 주간 요약, 최근 회의
    Setup.tsx                # 회의 입력 폼
    Meeting.tsx              # 원가 표시와 함께하는 라이브 타이머
    Wrapup.tsx               # 회의 종료 폼
    Report.tsx               # 원가 내역 및 낭비 분석
    Card.tsx                 # 공유 가능한 회의 카드 상세
    History.tsx              # 필터링이 가능한 전체 회의 기록
    Challenge.tsx            # 팀 랭킹 및 챌린지 규칙
  components/
    ScreenScaffold.tsx       # 페이지 레이아웃 래퍼 (SafeArea + Top/Bottom 슬롯)
    SummaryHero.tsx          # 주요 지표를 위한 대형 히어로 카드
    CountUp.tsx              # 애니메이션 숫자 카운터
    Card.tsx                 # 재사용 가능한 카드 컨테이너
    Amount.tsx               # 줄바꿈 방지가 있는 통화 표시
    StateView.tsx            # 빈 상태/로딩 상태 컴포넌트
    FloatingTabBar.tsx       # 하단 네비게이션 (3개 탭)
    AdSlot.tsx               # 배너 광고 컨테이너
    TossRewardAd.tsx         # 리워드 광고 게이트 컴포넌트
    BottomCTA.tsx            # 고정 하단 CTA 버튼
  lib/
    cost.ts                  # 원가 계산 공식
    storage.ts               # localStorage 헬퍼
    types.ts                 # TypeScript 도메인 타입
    constants.ts             # 고정값 (연봉, 시간 제한)
    messages.ts              # Toast/알림 문구
  hooks/
    useActiveMeeting.ts      # 회의 생명주기 상태
    useToastQueue.ts         # Toast 알림 관리자
```

## 배포

### 전제조건
- 토스 콘솔에 등록된 앱이 있는 토스 개발자 계정
- `apps-in-toss.config.ts`에 설정된 앱 이름 (대소문자 구분)

### 단계
1. **빌드**: `npm run build`로 TypeScript를 검증하고 운영 번들 생성
2. **배포**: `npx ait build && npx ait deploy`로 토스 CDN에 패키징하여 제출
3. **검수**: 토스 팀이 규정 준수 검토 (외부 링크 없음, 19세 이상 콘텐츠만, 콘솔 에러 0개)
4. **라이브**: 승인되면 `https://{appName}.web.tossmini.com`에서 호스팅됨

앱은 토스 WebView에서 CSR (클라이언트 사이드 렌더링만)로 실행됩니다. 서버 사이드 코드나 외부 API는 없습니다.

## 라이선스

MIT
