import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const h = React.createElement;

const mockShare = vi.fn<(args: unknown) => Promise<void>>(async () => {
  throw new Error("share unsupported");
});
const mockSetClipboardText = vi.fn(async () => undefined);

vi.mock("@apps-in-toss/web-framework", () => ({
  generateHapticFeedback: vi.fn(),
  share: (...a: unknown[]) => (mockShare as any)(...a),
  setClipboardText: (...a: unknown[]) => (mockSetClipboardText as any)(...a),
  saveBase64Data: vi.fn(async () => undefined),
}));

vi.mock("@/components/TossRewardAd", () => ({
  TossRewardAd: ({ children, onRewarded }: any) =>
    h(
      "div",
      { "data-testid": "reward-ad" },
      h("button", { onClick: () => onRewarded?.() }, "광고 시청 완료"),
      children,
    ),
}));

vi.mock("@/lib/shareCard", async () => ({
  ...(await vi.importActual<any>("@/lib/shareCard")),
  renderShareCard: vi.fn(() => ({ ok: true })),
}));

vi.mock("@toss/tds-mobile", () => ({
  Top: Object.assign(({ title }: any) => h("header", null, title), {
    TitleParagraph: ({ children }: any) => h("h1", null, children),
  }),
  Paragraph: { Text: ({ children }: any) => h("p", null, children) },
  Spacing: () => null,
  Toast: ({ open, text }: any) => (open ? h("div", { role: "status" }, text) : null),
  FixedBottomCTA: ({ children, onClick, disabled }: any) =>
    h("button", { onClick, disabled }, children),
  Button: ({ children, onClick, disabled }: any) => h("button", { onClick, disabled }, children),
  Asset: { ContentIcon: () => null },
}));

vi.mock("@/components/RecordNotFound", () => ({
  RecordNotFound: () => h("p", null, "기록을 찾을 수 없어요"),
}));

import Card from "@/pages/Card";
import { buildShareText } from "@/lib/shareCard";
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
  reportUnlocked: true,
  shareUnlocked: false,
  createdAt: "2026-09-14T01:45:00.000Z",
  updatedAt: "2026-09-14T01:45:00.000Z",
};

function seed(extra: Partial<MeetingRecord> = {}) {
  localStorage.setItem(KEY, JSON.stringify([{ ...rec, ...extra }]));
}
function renderAt(id: string) {
  return render(
    h(
      MemoryRouter,
      { initialEntries: [`/report/${id}/card`] },
      h(
        Routes,
        null,
        h(Route, { path: "/report/:id/card", element: h(Card) }),
      ),
    ),
  );
}
function stored() {
  return JSON.parse(localStorage.getItem(KEY) ?? "[]")[0];
}

describe("[부가] S6 공유 카드 페이지 (/report/:id/card)", () => {
  const writeText = vi.fn(async () => undefined);
  beforeEach(() => {
    mockShare.mockClear();
    mockSetClipboardText.mockClear();
    writeText.mockClear();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  });

  it("AC-1[P0]: shareUnlocked=false면 TossRewardAd가 렌더되고 완료 콜백 후 저장소가 true가 된다", async () => {
    seed({ shareUnlocked: false });
    renderAt("r1");
    expect(screen.getAllByTestId("reward-ad")).toHaveLength(1);
    expect(stored().shareUnlocked).toBe(false);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "광고 시청 완료" }));
    });
    expect(stored().shareUnlocked).toBe(true);
    expect(stored().id).toBe("r1");
  });

  it("AC-1[P0]: 이미 shareUnlocked=true면 광고 게이트가 0건이다", () => {
    seed({ shareUnlocked: true });
    const { container } = renderAt("r1");
    expect(screen.queryAllByTestId("reward-ad")).toHaveLength(0);
    expect(container.querySelector("canvas")).not.toBeNull();
  });

  it("AC-2[P0]: shareUnlocked=true면 canvas와 '이미지 저장'·'텍스트 공유' 버튼이 표시된다", () => {
    seed({ shareUnlocked: true });
    const { container } = renderAt("r1");
    expect(container.querySelectorAll("canvas")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "이미지 저장" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "텍스트 공유" })).toBeInTheDocument();
  });

  it("AC-2[P1]: '이미지 저장'은 canvas.toDataURL 결과로 a[download] 클릭을 일으킨다", () => {
    seed({ shareUnlocked: true });
    const toDataURL = vi
      .spyOn(HTMLCanvasElement.prototype, "toDataURL")
      .mockReturnValue("data:image/png;base64,AAAA");
    const clicked: HTMLAnchorElement[] = [];
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        clicked.push(this);
      });
    renderAt("r1");
    fireEvent.click(screen.getByRole("button", { name: "이미지 저장" }));
    expect(toDataURL).toHaveBeenCalled();
    expect(clicked.length).toBeGreaterThanOrEqual(1);
    expect(clicked[0].href).toContain("data:image/png;base64,AAAA");
    expect(clicked[0].hasAttribute("download")).toBe(true);
    toDataURL.mockRestore();
    clickSpy.mockRestore();
  });

  it("AC-3[P0]: '텍스트 공유'는 buildShareText 결과를 클립보드로 보내고 복사 토스트를 띄운다(폴백)", async () => {
    seed({ shareUnlocked: true });
    renderAt("r1");
    const text = buildShareText(rec);
    fireEvent.click(screen.getByRole("button", { name: "텍스트 공유" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("공유 문구를 복사했어요"));
    const sent = [...writeText.mock.calls, ...mockSetClipboardText.mock.calls].map((c: any[]) =>
      typeof c[0] === "string" ? c[0] : c[0]?.text,
    );
    expect(sent).toContain(text);
    expect(text).toContain("주간 회의");
  });

  it("AC-3[P1]: 공유 함수가 성공하면 buildShareText 결과가 share로 전달된다", async () => {
    seed({ shareUnlocked: true });
    mockShare.mockImplementationOnce(async () => undefined);
    renderAt("r1");
    fireEvent.click(screen.getByRole("button", { name: "텍스트 공유" }));
    await waitFor(() => expect(mockShare).toHaveBeenCalledTimes(1));
    expect(JSON.stringify(mockShare.mock.calls[0])).toContain("주간 회의");
    expect(writeText).not.toHaveBeenCalled();
  });

  it("AC-4[P0]: 없는 id면 '기록을 찾을 수 없어요'가 보이고 TossRewardAd는 0건이다", () => {
    seed({ shareUnlocked: false });
    const { container } = renderAt("nope");
    expect(screen.getByText("기록을 찾을 수 없어요")).toBeInTheDocument();
    expect(screen.queryAllByTestId("reward-ad")).toHaveLength(0);
    expect(container.querySelector("canvas")).toBeNull();
  });

  it("AC-7: 회고를 안 한 기록(outcome=null)은 /wrapup/:id로 보낸다", () => {
    seed({ outcome: null });
    const { container } = renderAt("r1");
    expect(container.querySelector("canvas")).toBeNull();
    expect(screen.queryAllByTestId("reward-ad")).toHaveLength(0);
  });

  it("AC-12: 리포트를 안 연 기록(reportUnlocked=false)은 카드 게이트에 들어가지 않는다", () => {
    seed({ reportUnlocked: false });
    renderAt("r1");
    expect(screen.queryAllByTestId("reward-ad")).toHaveLength(0);
  });
});
