import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import * as React from "react";

vi.mock("@apps-in-toss/web-framework", () => ({ generateHapticFeedback: vi.fn() }));
vi.mock("@toss/tds-mobile", () => {
  const h = React.createElement;
  return {
    Top: Object.assign(({ title }: any) => h("header", null, title), {
      TitleParagraph: ({ children }: any) => h("h1", null, children),
    }),
    Paragraph: { Text: ({ children }: any) => h("p", null, children) },
    Spacing: () => null,
    Chip: ({ children, selected, onClick }: any) =>
      h("button", { "aria-pressed": !!selected, onClick }, children),
    Toast: ({ open, text }: any) => (open ? h("div", { role: "status" }, text) : null),
    FixedBottomCTA: ({ children, onClick, disabled }: any) =>
      h("button", { onClick, disabled }, children),
    Button: ({ children, onClick }: any) => h("button", { onClick }, children),
  };
});

vi.mock("@/components/RecordNotFound", () => ({
  RecordNotFound: () => React.createElement("p", null, "기록을 찾을 수 없어요"),
}));

import Wrapup from "@/pages/Wrapup";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { QUOTA_TOAST } from "@/lib/messages";
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
  outcome: null,
  wasteCost: null,
  reportUnlocked: false,
  shareUnlocked: false,
  createdAt: "2026-09-14T01:45:00.000Z",
  updatedAt: "2026-09-14T01:45:00.000Z",
};

function Path() {
  return <div data-testid="path">{useLocation().pathname}</div>;
}
function renderAt(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/wrapup/${id}`]}>
      <Routes>
        <Route path="/wrapup/:id" element={<Wrapup />} />
        <Route path="*" element={<Path />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Wrapup", () => {
  it("AC-1: 없는 id면 안내를 보여준다", () => {
    renderAt("nope");
    expect(screen.getByText(/기록을 찾을 수 없어요/)).toBeInTheDocument();
  });

  it("AC-2: outcome 선택 전에는 리포트 보기가 disabled다", () => {
    localStorage.setItem(KEY, JSON.stringify([rec]));
    renderAt("r1");
    expect(screen.getByText("90,144원")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "리포트 보기" })).toBeDisabled();
  });

  it("AC-3: 결론 없음 저장 후 /report/r1로 이동한다", () => {
    localStorage.setItem(KEY, JSON.stringify([rec]));
    renderAt("r1");
    fireEvent.click(screen.getByRole("button", { name: "결론이 없었어요" }));
    expect(generateHapticFeedback).toHaveBeenCalledWith({ type: "tickWeak" });
    fireEvent.click(screen.getByRole("button", { name: "리포트 보기" }));
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "[]")[0];
    expect(saved.outcome).toBe("none");
    expect(saved.wasteCost).toBe(60096);
    expect(screen.getByTestId("path")).toHaveTextContent("/report/r1");
  });

  it("AC-4: quota 실패면 토스트를 띄우고 이동하지 않는다", () => {
    localStorage.setItem(KEY, JSON.stringify([rec]));
    renderAt("r1");
    fireEvent.click(screen.getByRole("button", { name: "결론이 없었어요" }));
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    fireEvent.click(screen.getByRole("button", { name: "리포트 보기" }));
    spy.mockRestore();
    expect(screen.getByRole("status")).toHaveTextContent(QUOTA_TOAST);
    expect(screen.queryByTestId("path")).toBeNull();
  });
});
