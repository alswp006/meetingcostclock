import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, act } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import App from "@/App";
import * as ErrorBoundaryModule from "@/components/ErrorBoundary";
import { saveActive, loadActive } from "@/lib/storageBase";
import { STORAGE_KEY_RECORDS } from "@/lib/constants";
import { AUTO_CLOSED_8H } from "@/lib/messages";
import type { ActiveMeeting } from "@/lib/types";

vi.mock("@toss/tds-mobile", () => {
  const R = require("react");
  const h = R.createElement;
  return {
    Button: ({ children, onClick }: any) => h("button", { onClick }, children),
    FixedBottomCTA: ({ children, onClick }: any) => h("button", { onClick }, children),
    CTAButton: ({ children, onClick }: any) => h("button", { onClick }, children),
    Spacing: () => h("div"),
    Paragraph: { Text: ({ children }: any) => h("span", null, children) },
    Top: Object.assign(({ title }: any) => h("nav", null, title), {
      TitleParagraph: ({ children }: any) => h("h1", null, children),
    }),
    Asset: { ContentIcon: () => h("span"), Icon: () => h("span") },
    Toast: ({ open, text }: any) => (open ? h("div", { role: "status" }, text) : null),
  };
});
vi.mock("@apps-in-toss/web-framework", () => ({
  generateHapticFeedback: vi.fn(),
  TossAds: {
    initialize: Object.assign(vi.fn(), { isSupported: () => false }),
    attachBanner: Object.assign(vi.fn(), { isSupported: () => false }),
  },
}));
// 페이지 본문은 이 패킷의 관심사가 아니다 — 라우트 매칭만 확인하는 스텁
vi.mock("@/pages/Home", () => ({ default: () => React.createElement("div", null, "PAGE-HOME") }));
vi.mock("@/pages/Setup", () => ({ default: () => React.createElement("div", null, "PAGE-SETUP") }));
vi.mock("@/pages/Meeting", () => ({ default: () => React.createElement("div", null, "PAGE-MEETING") }));
vi.mock("@/pages/Wrapup", () => ({ default: () => React.createElement("div", null, "PAGE-WRAPUP") }));
vi.mock("@/pages/Report", () => ({ default: () => React.createElement("div", null, "PAGE-REPORT") }));
vi.mock("@/pages/Card", () => ({ default: () => React.createElement("div", null, "PAGE-CARD") }));
vi.mock("@/pages/History", () => ({ default: () => React.createElement("div", null, "PAGE-HISTORY") }));
vi.mock("@/pages/Challenge", () => ({ default: () => React.createElement("div", null, "PAGE-CHALLENGE") }));

const NOW = new Date(2026, 8, 19, 14, 0, 0).getTime();

const Probe = () => React.createElement("div", { "data-testid": "path" }, useLocation().pathname);

const renderApp = (entry: string) =>
  render(
    React.createElement(
      MemoryRouter,
      { initialEntries: [entry] },
      React.createElement(App),
      React.createElement(Probe),
    ),
  );

const makeActive = (elapsedSec: number): ActiveMeeting => ({
  id: "active-19",
  setup: {
    title: "주간 스프린트 회의",
    teamName: "프론트엔드팀",
    attendees: 5,
    annualSalaryManwon: 5000,
    plannedMinutes: 30,
  },
  startedAt: NOW - elapsedSec * 1000,
  pausedAt: null,
  totalPausedMs: 0,
  createdAt: "2026-09-19T04:00:00.000Z",
  updatedAt: "2026-09-19T04:00:00.000Z",
});

const records = (): any[] => JSON.parse(localStorage.getItem(STORAGE_KEY_RECORDS) ?? "[]");

describe("App.tsx 라우팅, FloatingTabBar, ErrorBoundary, StaleGate 배선", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("AC-1[P0]: /history에서는 FloatingTabBar(홈/기록/챌린지)가 보인다", () => {
    renderApp("/history");
    expect(screen.getByText("PAGE-HISTORY")).toBeInTheDocument();
    expect(screen.getAllByRole("tablist")).toHaveLength(1);
    expect(screen.getByText("홈")).toBeInTheDocument();
    expect(screen.getByText("기록")).toBeInTheDocument();
    expect(screen.getByText("챌린지")).toBeInTheDocument();
  });

  it("AC-1[P0]: /meeting, /setup에서는 FloatingTabBar가 0건이다", () => {
    const { unmount } = renderApp("/meeting");
    expect(screen.getByText("PAGE-MEETING")).toBeInTheDocument();
    expect(screen.queryAllByRole("tablist")).toHaveLength(0);
    unmount();
    renderApp("/setup");
    expect(screen.getByText("PAGE-SETUP")).toBeInTheDocument();
    expect(screen.queryAllByRole("tablist")).toHaveLength(0);
  });

  it("AC-1[P1]: /, /challenge에서도 탭바가 보이고 /report/:id/card에서는 없다", () => {
    const a = renderApp("/");
    expect(screen.getAllByRole("tablist")).toHaveLength(1);
    a.unmount();
    const b = renderApp("/challenge");
    expect(screen.getByText("PAGE-CHALLENGE")).toBeInTheDocument();
    expect(screen.getAllByRole("tablist")).toHaveLength(1);
    b.unmount();
    renderApp("/report/abc/card");
    expect(screen.getByText("PAGE-CARD")).toBeInTheDocument();
    expect(screen.queryAllByRole("tablist")).toHaveLength(0);
  });

  it("AC-2[P0]: 9시간 경과한 active는 마운트 시 28800초 기록 1건으로 종료되고 AUTO_CLOSED_8H 토스트가 뜬다", async () => {
    saveActive(makeActive(9 * 3600));
    await act(async () => {
      renderApp("/");
    });
    const saved = records();
    expect(saved).toHaveLength(1);
    expect(saved[0].durationSec).toBe(28800);
    expect(loadActive()).toBeNull();
    expect(screen.getByText(AUTO_CLOSED_8H)).toBeInTheDocument();
  });

  it("AC-2[P0]: 만료되지 않은 active(10분)는 종료하지 않고 토스트도 없다", async () => {
    saveActive(makeActive(600));
    await act(async () => {
      renderApp("/");
    });
    expect(records()).toHaveLength(0);
    expect(loadActive()?.id).toBe("active-19");
    expect(screen.queryByText(AUTO_CLOSED_8H)).toBeNull();
  });

  it("AC-3[P0]: 자식이 throw하면 '문제가 생겼어요'와 '홈으로' 버튼이 표시된다", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const EB: any =
      (ErrorBoundaryModule as any).ErrorBoundary ?? (ErrorBoundaryModule as any).default;
    const Boom = () => {
      throw new Error("boom");
    };
    render(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(EB, null, React.createElement(Boom)),
      ),
    );
    expect(screen.getByText("문제가 생겼어요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "홈으로" })).toBeInTheDocument();
    spy.mockRestore();
  });

  it("AC-3[P1]: 정상 자식은 그대로 렌더되고 에러 문구가 없다", () => {
    const EB: any =
      (ErrorBoundaryModule as any).ErrorBoundary ?? (ErrorBoundaryModule as any).default;
    render(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(EB, null, React.createElement("p", null, "정상 화면")),
      ),
    );
    expect(screen.getByText("정상 화면")).toBeInTheDocument();
    expect(screen.queryByText("문제가 생겼어요")).toBeNull();
    expect(screen.queryByRole("button", { name: "홈으로" })).toBeNull();
  });

  it("AC-4[P0]: 정의되지 않은 경로 /xyz는 /로 리다이렉트된다", () => {
    renderApp("/xyz");
    expect(screen.getByTestId("path").textContent).toBe("/");
    expect(screen.getByText("PAGE-HOME")).toBeInTheDocument();
  });

  it("통합: 8개 경로가 각자의 페이지로 매칭된다", () => {
    const table: Array<[string, string]> = [
      ["/", "PAGE-HOME"],
      ["/setup", "PAGE-SETUP"],
      ["/meeting", "PAGE-MEETING"],
      ["/wrapup/r1", "PAGE-WRAPUP"],
      ["/report/r1", "PAGE-REPORT"],
      ["/report/r1/card", "PAGE-CARD"],
      ["/history", "PAGE-HISTORY"],
      ["/challenge", "PAGE-CHALLENGE"],
    ];
    for (const [p, label] of table) {
      const { unmount } = renderApp(p);
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.getByTestId("path").textContent).toBe(p);
      unmount();
    }
  });
});
