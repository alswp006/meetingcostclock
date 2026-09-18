// @ai-factory:wiring-first — 스캐폴드가 설계(SPEC 화면 표·패킷 목록)로부터 결정론으로 깐 라우트 골격이다.
// 진입점(App.tsx) 패킷: 처음부터 다시 쓰지 마라 — SPEC과 경로를 대조·보완하고, 전역 Provider(광고/결제 SDK·앱 상태)를
//   <Routes>를 감싸는 자리에 끼워라. 라우트 경로는 지우지 말고 고쳐라(화면 파일은 이 경로로 navigate한다).
// 화면 패킷: 이 파일을 건드리지 마라 — 자기 페이지 파일(자리 페이지)만 통째로 교체한다.
import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { StaleGate } from './components/StaleGate';
import { FloatingTabBar } from './components/FloatingTabBar';
import type { TabItem } from './components/FloatingTabBar';
import Home from './pages/Home';
import Setup from './pages/Setup';
import Meeting from './pages/Meeting';
import Wrapup from './pages/Wrapup';
import Report from './pages/Report';
import Card from './pages/Card';
import History from './pages/History';
import Challenge from './pages/Challenge';

// Dev-only TDS Gallery route — `import.meta.env.DEV` is statically replaced
// (true in dev, false in prod) so the entire import + Route is tree-shaken
// from production builds. Verify with: `grep -r "TdsGallery" dist/` → empty.
const DevTdsGallery = import.meta.env.DEV
  ? lazy(() => import('./pages/__TdsGallery'))
  : null;

// 하단 탭은 탭-루트 화면(홈/기록/챌린지)에서만 — 회의 진행·입력·결과 화면엔 CTA와 겹치므로 숨긴다.
const TABS: TabItem[] = [
  { label: '홈', path: '/' },
  { label: '기록', path: '/history' },
  { label: '챌린지', path: '/challenge' },
];
const TAB_PATHS = new Set(TABS.map((t) => t.path));

export default function App() {
  const { pathname } = useLocation();
  return (
    // @ai-factory:providers — 전역 Provider는 <Routes>를 감싸는 이 자리에 둔다(main.tsx는 @AI:ANCHOR, 수정 금지).
    <ErrorBoundary resetKey={pathname}>
    <StaleGate>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/setup" element={<Setup />} />
      <Route path="/meeting" element={<Meeting />} />
      <Route path="/wrapup/:id" element={<Wrapup />} />
      <Route path="/report/:id" element={<Report />} />
      <Route path="/report/:id/card" element={<Card />} />
      <Route path="/history" element={<History />} />
      <Route path="/challenge" element={<Challenge />} />
      {DevTdsGallery && (
        <Route
          path="/__tds-gallery"
          element={
            <Suspense fallback={null}>
              <DevTdsGallery />
            </Suspense>
          }
        />
      )}
      {/* 미정의 경로 → 홈. NotFound 화면이 설계에 생기면 이 줄을 그 화면으로 바꿔라. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    {TAB_PATHS.has(pathname) && <FloatingTabBar items={TABS} />}
    </StaleGate>
    </ErrorBoundary>
  );
}
