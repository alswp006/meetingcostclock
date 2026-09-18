import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import Meeting from "@/pages/Meeting";
import { saveActive, loadActive } from "@/lib/storageBase";
import {
  STORAGE_KEY_NO_MEETING_DAYS,
  STORAGE_KEY_RECORDS,
} from "@/lib/constants";
import { NO_MEETING_CANCELLED, TOO_SHORT } from "@/lib/messages";
import type { ActiveMeeting } from "@/lib/types";

const { pushSpy, hapticSpy } = vi.hoisted(() => ({
  pushSpy: vi.fn(),
  hapticSpy: vi.fn(),
}));

vi.mock("@toss/tds-mobile", () => {
  const R = require("react");
  const h = R.createElement;
  const Confirm: any = ({ open, title, description, cancelButton, confirmButton }: any) =>
    open
      ? h("div", { role: "dialog" }, title, description, cancelButton, confirmButton)
      : null;
  Confirm.Title = ({ children }: any) => h("h2", null, children);
  Confirm.Description = ({ children }: any) => h("p", null, children);
  Confirm.CancelButton = ({ children, onClick }: any) => h("button", { onClick }, children);
  Confirm.ConfirmButton = ({ children, onClick }: any) => h("button", { onClick }, children);
  const Alert: any = ({ open, title, description, alertButton, onClose }: any) =>
    open
      ? h(
          "div",
          { role: "alertdialog" },
          title,
          description,
          alertButton,
          h("button", { onClick: onClose }, "닫기"),
        )
      : null;
  Alert.AlertButton = ({ children, onClick }: any) => h("button", { onClick }, children);
  return {
    Button: ({ children, onClick, disabled }: any) => h("button", { onClick, disabled }, children),
    FixedBottomCTA: ({ children, onClick, disabled }: any) =>
      h("button", { onClick, disabled }, children),
    CTAButton: ({ children, onClick, disabled }: any) =>
      h("button", { onClick, disabled }, children),
    BottomCTA: Object.assign(({ children }: any) => h("div", null, children), {
      Double: ({ leftButton, rightButton }: any) => h("div", null, leftButton, rightButton),
    }),
    Spacing: ({ size }: any) => h("div", { "data-spacing": size }),
    Paragraph: { Text: ({ children }: any) => h("span", null, children) },
    Badge: ({ children }: any) => h("span", null, children),
    Border: () => h("hr"),
    Skeleton: () => h("div"),
    Top: Object.assign(({ title, children }: any) => h("nav", null, title, children), {
      TitleParagraph: ({ children }: any) => h("h1", null, children),
    }),
    Asset: {
      ContentIcon: () => h("span"),
      Icon: () => h("span"),
    },
    ConfirmDialog: Confirm,
    AlertDialog: Alert,
    Toast: ({ open, text }: any) => (open ? h("div", { role: "status" }, text) : null),
  };
});
vi.mock("@apps-in-toss/web-framework", () => ({
  generateHapticFeedback: hapticSpy,
  TossAds: {
    initialize: Object.assign(vi.fn(), { isSupported: () => false }),
    attachBanner: Object.assign(vi.fn(), { isSupported: () => false }),
  },
}));
vi.mock("@/hooks/useToastQueue", () => ({
  useToastQueue: () => ({ current: null, push: pushSpy, dismiss: vi.fn() }),
}));

// 2026-09-19 14:00 로컬 — 자정 경계를 피하려고 시각을 고정한다
const NOW = new Date(2026, 8, 19, 14, 0, 0).getTime();
const TODAY = "2026-09-19";

const makeActive = (elapsedSec: number, over: Partial<ActiveMeeting> = {}): ActiveMeeting => ({
  id: "active-12",
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
  ...over,
});

const Probe = () => {
  const loc = useLocation();
  return React.createElement("div", { "data-testid": "path" }, loc.pathname);
};

const renderMeeting = () =>
  render(
    React.createElement(
      MemoryRouter,
      { initialEntries: ["/meeting"] },
      React.createElement(
        Routes,
        null,
        React.createElement(Route, { path: "/meeting", element: React.createElement(Meeting) }),
        React.createElement(Route, { path: "*", element: React.createElement("div") }),
      ),
      React.createElement(Probe),
    ),
  );

const path = () => screen.getByTestId("path").textContent;
const records = (): unknown[] => JSON.parse(localStorage.getItem(STORAGE_KEY_RECORDS) ?? "[]");

describe("S3 회의 진행 페이지 (/meeting: 일시정지, 종료 확정, 자동 종료, 배너)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("AC-1[P0]: active 없이 /meeting에 진입하면 pathname이 '/'로 바뀐다", () => {
    renderMeeting();
    expect(path()).toBe("/");
    expect(loadActive()).toBeNull();
  });

  it("AC-1[P0]: active가 있으면 /meeting에 머문다", () => {
    saveActive(makeActive(120));
    renderMeeting();
    expect(path()).toBe("/meeting");
    expect(screen.getByRole("button", { name: "일시정지" })).toBeInTheDocument();
  });

  it("AC-2[P0]: '일시정지'를 탭하면 pausedAt이 저장되고 라벨이 '다시 시작'으로 바뀌며 tickWeak 햅틱이 울린다", () => {
    saveActive(makeActive(120));
    renderMeeting();
    fireEvent.click(screen.getByRole("button", { name: "일시정지" }));
    expect(loadActive()?.pausedAt).toBe(NOW);
    expect(screen.getByRole("button", { name: "다시 시작" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "일시정지" })).toBeNull();
    expect(hapticSpy).toHaveBeenCalledWith({ type: "tickWeak" });
  });

  it("AC-2[P0]: '다시 시작'을 탭하면 pausedAt이 null이 되고 라벨이 '일시정지'로 돌아온다", () => {
    saveActive(makeActive(120, { pausedAt: NOW - 30_000 }));
    renderMeeting();
    fireEvent.click(screen.getByRole("button", { name: "다시 시작" }));
    expect(loadActive()?.pausedAt).toBeNull();
    expect(loadActive()?.totalPausedMs).toBe(30_000);
    expect(screen.getByRole("button", { name: "일시정지" })).toBeInTheDocument();
  });

  it("AC-3[P0]: '회의 종료' → 다이얼로그 '종료'로 기록을 저장하고 /wrapup/{id}로 이동한다", () => {
    saveActive(makeActive(120));
    renderMeeting();
    fireEvent.click(screen.getByRole("button", { name: "회의 종료" }));
    expect(screen.getByRole("button", { name: "닫기" })).toBeInTheDocument();
    expect(records()).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "종료" }));
    const saved = records() as { id: string; durationSec: number }[];
    expect(saved).toHaveLength(1);
    expect(saved[0].id).toBe("active-12");
    expect(saved[0].durationSec).toBe(120);
    expect(path()).toBe("/wrapup/active-12");
    expect(loadActive()).toBeNull();
  });

  it("AC-3[P0]: 다이얼로그 '닫기'는 회의를 종료하지 않고 /meeting에 머문다", () => {
    saveActive(makeActive(120));
    renderMeeting();
    fireEvent.click(screen.getByRole("button", { name: "회의 종료" }));
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(records()).toHaveLength(0);
    expect(loadActive()?.id).toBe("active-12");
    expect(path()).toBe("/meeting");
  });

  it("AC-4[P0]: 경과 5초에 종료하면 TOO_SHORT 토스트를 띄우고 records 개수가 변하지 않으며 홈으로 간다", () => {
    saveActive(makeActive(5));
    renderMeeting();
    fireEvent.click(screen.getByRole("button", { name: "회의 종료" }));
    fireEvent.click(screen.getByRole("button", { name: "종료" }));
    expect(pushSpy).toHaveBeenCalledWith(TOO_SHORT);
    expect(records()).toHaveLength(0);
    expect(path()).toBe("/");
  });

  it("AC-5[P0]: NoMeetingDay가 취소되면 NO_MEETING_CANCELLED 토스트가 큐에 추가된다", () => {
    saveActive(makeActive(120));
    localStorage.setItem(
      STORAGE_KEY_NO_MEETING_DAYS,
      JSON.stringify([
        {
          id: "nmd-1",
          date: TODAY,
          createdAt: "2026-09-19T00:00:00.000Z",
          updatedAt: "2026-09-19T00:00:00.000Z",
        },
      ]),
    );
    renderMeeting();
    fireEvent.click(screen.getByRole("button", { name: "회의 종료" }));
    fireEvent.click(screen.getByRole("button", { name: "종료" }));
    expect(pushSpy).toHaveBeenCalledWith(NO_MEETING_CANCELLED);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY_NO_MEETING_DAYS) ?? "[]")).toHaveLength(0);
    expect(path()).toBe("/wrapup/active-12");
  });

  it("만료된 active(9시간 경과)는 진입 시 autoFinalizeStale로 종료되어 기록이 저장된다", () => {
    saveActive(makeActive(9 * 3600));
    act(() => {
      renderMeeting();
    });
    expect(records()).toHaveLength(1);
    expect(loadActive()).toBeNull();
  });
});
