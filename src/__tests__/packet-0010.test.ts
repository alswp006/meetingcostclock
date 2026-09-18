import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Setup from "@/pages/Setup";
import { QUOTA_TOAST, RESTART_SAVED } from "@/lib/messages";
import {
  STORAGE_KEY_ACTIVE,
  STORAGE_KEY_LAST_SETUP,
  STORAGE_KEY_RECORDS,
} from "@/lib/constants";

vi.mock("@toss/tds-mobile", () => {
  const R = require("react");
  const h = R.createElement;
  const Dialog = ({ open, title, description, alertButton, confirmButton, cancelButton, children }: any) =>
    open
      ? h(
          "div",
          { role: "alertdialog" },
          h("h2", null, title),
          description && h("p", null, description),
          children,
          cancelButton,
          confirmButton,
          alertButton,
        )
      : null;
  return {
    Button: ({ children, onClick, disabled }: any) => h("button", { onClick, disabled }, children),
    FixedBottomCTA: ({ children, onClick, disabled }: any) =>
      h("button", { onClick, disabled: disabled || undefined }, children),
    Spacing: ({ size }: any) => h("div", { "data-spacing": size }),
    Paragraph: { Text: ({ children }: any) => h("span", null, children) },
    Border: () => h("hr"),
    Badge: ({ children }: any) => h("span", null, children),
    AlertDialog: Object.assign(Dialog, {
      AlertButton: ({ children, onClick }: any) => h("button", { onClick }, children),
    }),
    ConfirmDialog: Dialog,
    BottomSheet: Object.assign(
      ({ open, children }: any) => (open ? h("div", { role: "dialog" }, children) : null),
      { Header: ({ children }: any) => h("div", null, children) },
    ),
    Toast: ({ open, text }: any) => (open ? h("div", { role: "status" }, text) : null),
    TextField: R.forwardRef(({ label, help, hasError, variant, ...p }: any, ref: any) =>
      h(
        "div",
        null,
        h("label", null, label),
        h("input", { ref, ...p }),
        hasError && help && h("span", { role: "alert" }, help),
      ),
    ),
    Top: Object.assign(({ title, children }: any) => h("nav", null, title, children), {
      TitleParagraph: ({ children }: any) => h("h1", null, children),
    }),
  };
});
vi.mock("@apps-in-toss/web-framework", () => ({
  generateHapticFeedback: vi.fn(),
}));
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual<typeof import("react-router-dom")>("react-router-dom")),
  useNavigate: () => mockNavigate,
}));

const LAST = {
  id: "lastSetup",
  title: "주간 스프린트",
  teamName: "플랫폼팀",
  attendees: 4,
  annualSalaryManwon: 6000,
  plannedMinutes: 45,
  createdAt: "2026-09-01T01:00:00.000Z",
  updatedAt: "2026-09-01T01:00:00.000Z",
};
const PREFILL = {
  title: "디자인 리뷰",
  teamName: "디자인팀",
  attendees: 7,
  annualSalaryManwon: 5500,
  plannedMinutes: 60,
};
const makeActive = () => ({
  id: "act-1",
  setup: { title: "진행 중 회의", teamName: "프론트엔드팀", attendees: 5, annualSalaryManwon: 5000, plannedMinutes: 30 },
  startedAt: Date.now() - 10 * 60_000,
  pausedAt: null,
  totalPausedMs: 0,
  createdAt: "2026-09-19T01:00:00.000Z",
  updatedAt: "2026-09-19T01:00:00.000Z",
});

const renderSetup = (state?: unknown) =>
  render(
    React.createElement(
      MemoryRouter,
      { initialEntries: [{ pathname: "/setup", state: state ?? null }] },
      React.createElement(Setup),
    ),
  );
const attendeesInput = () => screen.getByPlaceholderText(/예: 5$/) as HTMLInputElement;
const readJson = (k: string) => JSON.parse(localStorage.getItem(k) ?? "null");

beforeEach(() => {
  mockNavigate.mockClear();
  localStorage.setItem(STORAGE_KEY_LAST_SETUP, JSON.stringify(LAST));
});
afterEach(() => vi.restoreAllMocks());

describe("S2 회의 설정 페이지 (/setup: 프리필, 진행 중 다이얼로그, 시작)", () => {
  it("AC-1[P0]: prefill이 있으면 참석자 필드에 7이 표시된다", () => {
    renderSetup({ prefill: PREFILL });
    expect(attendeesInput().value).toBe("7");
    expect((screen.getByPlaceholderText(/예: 5000/) as HTMLInputElement).value).toBe("5500");
  });

  it("AC-1[P0]: 가드를 통과하지 못하는 prefill은 무시하고 lastSetup 값을 쓴다", () => {
    renderSetup({ prefill: { ...PREFILL, attendees: "x" } });
    expect(attendeesInput().value).toBe("4");
    expect((screen.getByPlaceholderText(/예: 5000/) as HTMLInputElement).value).toBe("6000");
  });

  it("AC-1[P1]: state가 없으면 lastSetup 값을 쓴다", () => {
    renderSetup();
    expect(attendeesInput().value).toBe("4");
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("AC-2[P0]: active가 있으면 다이얼로그가 열리고 '이어서 진행'은 /meeting으로 보낸다", () => {
    localStorage.setItem(STORAGE_KEY_ACTIVE, JSON.stringify(makeActive()));
    renderSetup();
    expect(screen.getByText("진행 중인 회의가 있어요")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "이어서 진행" }));
    expect(mockNavigate.mock.calls[0][0]).toBe("/meeting");
    expect(readJson(STORAGE_KEY_ACTIVE)?.id).toBe("act-1");
  });

  it("AC-2[P0]: active가 없으면 다이얼로그가 열리지 않는다", () => {
    renderSetup();
    expect(screen.queryByText("진행 중인 회의가 있어요")).toBeNull();
    expect(screen.queryByRole("button", { name: "이어서 진행" })).toBeNull();
  });

  it("AC-3[P0]: '종료하고 새로 시작'은 outcome:null 기록 1건을 남기고 active를 비우며 토스트를 띄운다", async () => {
    localStorage.setItem(STORAGE_KEY_ACTIVE, JSON.stringify(makeActive()));
    renderSetup();
    fireEvent.click(screen.getByRole("button", { name: "종료하고 새로 시작" }));
    await waitFor(() => expect(screen.getByText(RESTART_SAVED)).toBeInTheDocument());
    const records = readJson(STORAGE_KEY_RECORDS);
    expect(records).toHaveLength(1);
    expect(records[0].outcome).toBeNull();
    expect(records[0].title).toBe("진행 중 회의");
    expect(readJson(STORAGE_KEY_ACTIVE)).toBeNull();
    expect(screen.queryByText("진행 중인 회의가 있어요")).toBeNull();
  });

  it("AC-4[P0]: 유효한 입력으로 '회의 시작'하면 active 저장, lastSetup 갱신, /meeting 이동", () => {
    renderSetup({ prefill: PREFILL });
    fireEvent.click(screen.getByRole("button", { name: "회의 시작" }));
    const active = readJson(STORAGE_KEY_ACTIVE);
    expect(active.setup).toEqual(PREFILL);
    expect(typeof active.startedAt).toBe("number");
    const last = readJson(STORAGE_KEY_LAST_SETUP);
    expect(last.attendees).toBe(7);
    expect(last.updatedAt).not.toBe(LAST.updatedAt);
    expect(mockNavigate.mock.calls[0][0]).toBe("/meeting");
  });

  it("AC-4[P0]: 저장 공간이 부족하면 QUOTA_TOAST를 표시하고 이동하지 않는다", () => {
    renderSetup({ prefill: PREFILL });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw Object.assign(new Error("full"), { name: "QuotaExceededError", code: 22 });
    });
    fireEvent.click(screen.getByRole("button", { name: "회의 시작" }));
    expect(screen.getByText(QUOTA_TOAST)).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(readJson(STORAGE_KEY_ACTIVE)).toBeNull();
  });
});
