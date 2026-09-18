import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@apps-in-toss/web-framework", () => ({
  generateHapticFeedback: vi.fn(),
  Analytics: { screen: vi.fn(), click: vi.fn() },
}));

vi.mock("@toss/tds-mobile", () => {
  const h = React.createElement;
  const overrides: Record<string, unknown> = {
    Top: Object.assign(({ title }: any) => h("header", null, title), {
      TitleParagraph: ({ children }: any) => h("h1", null, children),
    }),
    Paragraph: { Text: ({ children }: any) => h("p", null, children) },
    Spacing: () => null,
    Toast: ({ open, text, children }: any) => (open ? h("div", { role: "status" }, text ?? children) : null),
    Button: ({ children, onClick, disabled }: any) => h("button", { onClick, disabled }, children),
    FixedBottomCTA: ({ children, onClick, disabled }: any) => h("button", { onClick, disabled }, children),
    ListRow: Object.assign(
      ({ contents, right, children }: any) => h("li", null, contents, right, children),
      {
        Texts: ({ top, bottom }: any) => h("span", null, top, bottom),
        AssetIcon: () => null,
        AssetText: ({ children }: any) => h("span", null, children),
      },
    ),
    BottomSheet: Object.assign(
      ({ open, children }: any) => (open ? h("div", { role: "dialog" }, children) : null),
      {
        Header: ({ children }: any) => h("div", null, children),
        HeaderTitle: ({ children }: any) => h("div", null, children),
        HeaderDescription: ({ children }: any) => h("div", null, children),
        CTA: ({ children, onClick }: any) => h("button", { onClick }, children),
      },
    ),
  };
  const generic = ({ children }: any) => h("div", null, children);
  return new Proxy(overrides, {
    get: (t, k: string) => (k === "then" || k === "__esModule" ? undefined : (t[k] ?? generic)),
    has: () => true,
  });
});

import Challenge from "@/pages/Challenge";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { QUOTA_TOAST } from "@/lib/messages";

const DAYS = "mcc:v1:noMeetingDays";
const BADGES = "mcc:v1:badges";
const RECORDS = "mcc:v1:records";

const WEDNESDAY = new Date(2026, 8, 16, 10, 0, 0); // 2026-09-16 수
const SATURDAY = new Date(2026, 8, 19, 10, 0, 0); // 2026-09-19 토

function setNow(d: Date) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(d);
}

function renderPage() {
  return render(React.createElement(MemoryRouter, null, React.createElement(Challenge)));
}

const declareBtn = () => screen.getByRole("button", { name: /오늘은 회의 없는 날|오늘은 선언했어요/ });

describe("[부가] S8 챌린지 페이지 (/challenge)", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("AC-1[P0]: 평일에 기록이 없으면 버튼이 활성이고, 탭하면 오늘 키가 저장되고 '오늘은 선언했어요'(disabled)로 바뀐다", () => {
    setNow(WEDNESDAY);
    renderPage();
    const btn = screen.getByRole("button", { name: "오늘은 회의 없는 날" });
    expect(btn).not.toBeDisabled();

    fireEvent.click(btn);

    const saved = JSON.parse(localStorage.getItem(DAYS) ?? "[]");
    expect(saved).toHaveLength(1);
    expect(saved[0].date).toBe("2026-09-16");
    expect(generateHapticFeedback).toHaveBeenCalledWith({ type: "success" });
    const after = screen.getByRole("button", { name: "오늘은 선언했어요" });
    expect(after).toBeDisabled();
  });

  it("AC-1[P0]: 이미 선언한 날이면 처음부터 '오늘은 선언했어요'(disabled)로 보인다", () => {
    setNow(WEDNESDAY);
    localStorage.setItem(
      DAYS,
      JSON.stringify([
        { id: "2026-09-16", date: "2026-09-16", createdAt: WEDNESDAY.toISOString(), updatedAt: WEDNESDAY.toISOString() },
      ]),
    );
    renderPage();
    expect(screen.getByRole("button", { name: "오늘은 선언했어요" })).toBeDisabled();
    expect(JSON.parse(localStorage.getItem(DAYS) ?? "[]")).toHaveLength(1);
  });

  it("AC-2[P0]: 주말이면 버튼이 disabled이고 '주말에는 선언할 수 없어요'가 보이며 저장되지 않는다", () => {
    setNow(SATURDAY);
    renderPage();
    expect(declareBtn()).toBeDisabled();
    expect(screen.getByText("주말에는 선언할 수 없어요")).toBeInTheDocument();
    fireEvent.click(declareBtn());
    expect(localStorage.getItem(DAYS)).toBeNull();
  });

  it("AC-3[P0]: 오늘 종료된 회의 기록이 있으면 disabled이고 '오늘은 이미 회의가 있었어요'가 보인다", () => {
    setNow(WEDNESDAY);
    const ended = new Date(2026, 8, 16, 9, 0, 0).toISOString();
    localStorage.setItem(
      RECORDS,
      JSON.stringify([
        {
          id: "r1",
          title: "주간 회의",
          teamName: "제품팀",
          attendees: 5,
          annualSalaryManwon: 5000,
          plannedMinutes: 30,
          startedAt: new Date(2026, 8, 16, 8, 15, 0).toISOString(),
          endedAt: ended,
          durationSec: 2700,
          totalCost: 90144,
          outcome: null,
          wasteCost: null,
          reportUnlocked: false,
          shareUnlocked: false,
          createdAt: ended,
          updatedAt: ended,
        },
      ]),
    );
    renderPage();
    expect(declareBtn()).toBeDisabled();
    expect(screen.getByText("오늘은 이미 회의가 있었어요")).toBeInTheDocument();
    expect(localStorage.getItem(DAYS)).toBeNull();
  });

  it("AC-4[P0]: 첫 선언에 성공하면 first_free_day 배지가 저장되고 BottomSheet가 열린다", () => {
    setNow(WEDNESDAY);
    renderPage();
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "오늘은 회의 없는 날" }));

    const badges = JSON.parse(localStorage.getItem(BADGES) ?? "[]");
    expect(badges.map((b: any) => b.badgeId)).toEqual(["first_free_day"]);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("AC-4[P0]: 새 배지가 없으면(두 번째 선언) BottomSheet가 열리지 않는다", () => {
    setNow(WEDNESDAY);
    const prev = new Date(2026, 8, 14, 10, 0, 0).toISOString(); // 월요일 선언 이력 (연속 아님)
    localStorage.setItem(DAYS, JSON.stringify([{ id: "2026-09-14", date: "2026-09-14", createdAt: prev, updatedAt: prev }]));
    localStorage.setItem(BADGES, JSON.stringify([{ id: "first_free_day", badgeId: "first_free_day", createdAt: prev, updatedAt: prev }]));
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "오늘은 회의 없는 날" }));
    expect(JSON.parse(localStorage.getItem(DAYS) ?? "[]")).toHaveLength(2);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("AC-4[P0]: quota로 실패하면 QUOTA_TOAST를 표시하고 선언되지 않는다", () => {
    setNow(WEDNESDAY);
    renderPage();
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    fireEvent.click(screen.getByRole("button", { name: "오늘은 회의 없는 날" }));
    spy.mockRestore();
    expect(screen.getByRole("status")).toHaveTextContent(QUOTA_TOAST);
    expect(localStorage.getItem(DAYS)).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "오늘은 회의 없는 날" })).not.toBeDisabled();
  });
});
