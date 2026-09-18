import { describe, it, expect, vi } from "vitest";
import * as React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

const h = React.createElement;

vi.mock("@apps-in-toss/web-framework", () => ({
  generateHapticFeedback: vi.fn(),
  loadFullScreenAd: vi.fn(),
  showFullScreenAd: vi.fn(),
}));

vi.mock("@toss/tds-mobile", () => ({
  Top: Object.assign(({ title }: any) => h("header", null, title), {
    TitleParagraph: ({ children }: any) => h("h1", null, children),
  }),
  Paragraph: { Text: ({ children }: any) => h("p", null, children) },
  Spacing: () => null,
  Border: () => null,
  Badge: ({ children }: any) => h("span", null, children),
  Asset: { ContentIcon: () => null },
  Toast: ({ open, text }: any) => (open ? h("div", { role: "status" }, text) : null),
  AlertDialog: Object.assign(
    ({ open, title, alertButton }: any) => (open ? h("div", { role: "alertdialog" }, title, alertButton) : null),
    { AlertButton: ({ children, onClick }: any) => h("button", { onClick }, children) },
  ),
  FixedBottomCTA: ({ children, onClick, disabled }: any) =>
    h("button", { onClick, disabled }, children),
  Button: ({ children, onClick, disabled }: any) => h("button", { onClick, disabled }, children),
}));

// 게이트 모킹: 보상 완료 전에는 children을 숨기고, 버튼을 누르면 onRewarded 후 children을 노출한다.
vi.mock("@/components/TossRewardAd", () => {
  const Gate = ({ children, onRewarded }: any) => {
    const [ok, setOk] = React.useState(false);
    if (ok) return h(React.Fragment, null, children);
    return h(
      "div",
      { "data-testid": "reward-ad-gate" },
      h(
        "button",
        {
          onClick: () => {
            onRewarded?.();
            setOk(true);
          },
        },
        "광고 시청 완료",
      ),
    );
  };
  return { TossRewardAd: Gate, default: Gate };
});

vi.mock("@/components/RecordNotFound", () => {
  const C = () => h("p", null, "기록을 찾을 수 없어요");
  return { RecordNotFound: C, default: C };
});

import Report from "@/pages/Report";
import type { MeetingRecord } from "@/lib/types";

const KEY = "mcc:v1:records";
const rec: MeetingRecord = {
  id: "r1",
  title: "주간 회의",
  teamName: "제품팀",
  attendees: 5,
  annualSalaryManwon: 5000,
  plannedMinutes: 30,
  startedAt: "2026-09-14T01:00:00.000Z",
  endedAt: "2026-09-14T01:45:00.000Z",
  durationSec: 2700,
  totalCost: 90144,
  outcome: "none",
  wasteCost: 60096,
  reportUnlocked: false,
  shareUnlocked: false,
  createdAt: "2026-09-14T01:45:00.000Z",
  updatedAt: "2026-09-14T01:45:00.000Z",
};

function seed(patch: Partial<MeetingRecord> = {}) {
  localStorage.setItem(KEY, JSON.stringify([{ ...rec, ...patch }]));
}
function stored(): MeetingRecord {
  return JSON.parse(localStorage.getItem(KEY) ?? "[]")[0];
}

function Probe() {
  const loc = useLocation();
  return h(
    "div",
    null,
    h("div", { "data-testid": "path" }, loc.pathname),
    h("div", { "data-testid": "state" }, JSON.stringify(loc.state ?? null)),
  );
}
function renderAt(id: string) {
  return render(
    h(
      MemoryRouter,
      { initialEntries: [`/report/${id}`] },
      h(
        Routes,
        null,
        h(Route, { path: "/report/:id", element: h(Report) }),
        h(Route, { path: "*", element: h(Probe) }),
      ),
    ),
  );
}

describe("S5 리포트 페이지 (/report/:id: 보상형 광고 게이트, 낭비 분석, 액션)", () => {
  it("AC-1[P0]: reportUnlocked=true면 광고 없이 비용·낭비 수치가 바로 보인다", () => {
    seed({ reportUnlocked: true });
    renderAt("r1");
    expect(screen.queryByTestId("reward-ad-gate")).toBeNull();
    expect(screen.getByText("90,144원")).toBeInTheDocument();
    expect(screen.getAllByText("60,096원").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/67%/)).toBeInTheDocument();
  });

  it("AC-1[P0]: reportUnlocked=false면 완료 전에는 본문 수치가 숨겨진다", () => {
    seed({ reportUnlocked: false });
    renderAt("r1");
    expect(screen.getByTestId("reward-ad-gate")).toBeInTheDocument();
    expect(screen.queryByText("90,144원")).toBeNull();
    expect(screen.queryByText(/67%/)).toBeNull();
  });

  it("AC-2[P0]: 광고 완료 후 저장소의 reportUnlocked가 true가 되고 본문이 보인다", () => {
    seed({ reportUnlocked: false });
    renderAt("r1");
    expect(stored().reportUnlocked).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "광고 시청 완료" }));
    expect(stored().reportUnlocked).toBe(true);
    expect(screen.getByText("90,144원")).toBeInTheDocument();
    expect(screen.queryByTestId("reward-ad-gate")).toBeNull();
  });

  it("AC-3[P0]: 완료 후 저장이 quota로 실패해도 본문은 보이고 reportUnlocked는 false로 남는다", () => {
    seed({ reportUnlocked: false });
    renderAt("r1");
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    try {
      fireEvent.click(screen.getByRole("button", { name: "광고 시청 완료" }));
    } finally {
      spy.mockRestore();
    }
    expect(screen.getByText("90,144원")).toBeInTheDocument();
    expect(screen.getByText(/67%/)).toBeInTheDocument();
    expect(stored().reportUnlocked).toBe(false);
  });

  it("AC-4[P0]: '같은 설정으로 다시 시작'은 /setup으로 prefill state와 함께 이동한다", () => {
    seed({ reportUnlocked: true });
    renderAt("r1");
    fireEvent.click(screen.getByRole("button", { name: "같은 설정으로 다시 시작" }));
    expect(screen.getByTestId("path")).toHaveTextContent("/setup");
    expect(JSON.parse(screen.getByTestId("state").textContent ?? "null")).toEqual({
      prefill: {
        title: "주간 회의",
        teamName: "제품팀",
        attendees: 5,
        annualSalaryManwon: 5000,
        plannedMinutes: 30,
      },
    });
  });

  it("AC-4[P0]: '공유 카드 만들기'는 /report/r1/card로 이동한다", () => {
    seed({ reportUnlocked: true });
    renderAt("r1");
    fireEvent.click(screen.getByRole("button", { name: "공유 카드 만들기" }));
    expect(screen.getByTestId("path")).toHaveTextContent("/report/r1/card");
    expect(screen.getByTestId("state")).toHaveTextContent("null");
  });

  it("AC-5[P0]: outcome=null 기록은 /wrapup/r1로 보낸다", () => {
    seed({ outcome: null, wasteCost: null });
    renderAt("r1");
    expect(screen.getByTestId("path")).toHaveTextContent("/wrapup/r1");
    expect(screen.queryByText("90,144원")).toBeNull();
  });

  it("AC-5[P0]: 없는 id면 RecordNotFound를 보여주고 이동하지 않는다", () => {
    seed();
    renderAt("nope");
    expect(screen.getByText("기록을 찾을 수 없어요")).toBeInTheDocument();
    expect(screen.queryByTestId("path")).toBeNull();
  });
});
