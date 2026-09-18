import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { act, render, renderHook, screen, fireEvent } from "@testing-library/react";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual<typeof import("react-router-dom")>("react-router-dom")),
  useNavigate: () => mockNavigate,
}));

vi.mock("@toss/tds-mobile", () => ({
  Button: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) =>
    React.createElement("button", { onClick }, children),
  Paragraph: {
    Text: ({ children }: { children?: React.ReactNode }) => React.createElement("p", null, children),
  },
  Spacing: () => null,
  Skeleton: () => null,
  Asset: { ContentIcon: () => null },
}));
vi.mock("@apps-in-toss/web-framework", () => ({
  generateHapticFeedback: vi.fn(),
}));
vi.mock("@/state/AppStateContext", () => ({
  useAppState: () => ({ setInput: vi.fn() }),
}));

import { useNow } from "@/hooks/useNow";
import { useToastQueue } from "@/hooks/useToastQueue";
import { useRecordParam } from "@/hooks/useRecordParam";
import { useActiveMeeting } from "@/hooks/useActiveMeeting";
import * as RecordNotFoundModule from "@/components/RecordNotFound";
import { saveRecord, loadActive } from "@/lib/storage";
import type { MeetingRecord } from "@/lib/types";

const RecordNotFound: React.ComponentType =
  (RecordNotFoundModule as any).RecordNotFound ?? (RecordNotFoundModule as any).default;

const setup = {
  title: "주간 스프린트 회의",
  teamName: "제품팀",
  attendees: 5,
  annualSalaryManwon: 5000,
  plannedMinutes: 30,
};

describe("상태 훅 (useActiveMeeting, useNow, useToastQueue, useRecordParam, RecordNotFound)", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("AC-1[P0]: useNow는 3000ms 후 값이 3000 증가한다", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_000);
    const { result } = renderHook(() => useNow());
    const first = result.current;
    expect(first).toBe(1_700_000_000_000);
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current).toBe(first + 3000);
    expect(typeof result.current).toBe("number");
  });

  it("AC-1[P0]: 언마운트하면 interval이 해제된다", () => {
    vi.useFakeTimers();
    const { unmount } = renderHook(() => useNow());
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("AC-2[P0]: useToastQueue는 push한 순서대로 1개씩 current로 노출한다", () => {
    const { result } = renderHook(() => useToastQueue());
    expect(result.current.current).toBeNull();
    act(() => {
      result.current.push("저장했어요");
      result.current.push("공유 카드를 복사했어요");
    });
    expect(result.current.current).toBe("저장했어요");
    act(() => {
      result.current.dismiss();
    });
    expect(result.current.current).toBe("공유 카드를 복사했어요");
    act(() => {
      result.current.dismiss();
    });
    expect(result.current.current).toBeNull();
  });

  it("AC-3[P0]: useRecordParam은 존재하지 않는 id면 null, 존재하면 기록을 반환한다", () => {
    const wrapperFor = (path: string) => ({ children }: { children?: React.ReactNode }) =>
      React.createElement(
        MemoryRouter,
        { initialEntries: [path] },
        React.createElement(Routes, null, React.createElement(Route, { path: "/records/:id", element: children as React.ReactElement })),
      );
    const missing = renderHook(() => useRecordParam(), { wrapper: wrapperFor("/records/nope") });
    expect(missing.result.current).toBeNull();

    const saved = saveRecord({
      title: "디자인 리뷰",
      teamName: "디자인팀",
      attendees: 4,
      annualSalaryManwon: 4800,
      plannedMinutes: 30,
      startedAt: new Date(1_700_000_000_000).toISOString(),
      endedAt: new Date(1_700_000_600_000).toISOString(),
      durationSec: 600,
      totalCost: 55000,
      outcome: "decided",
      wasteCost: 0,
      reportUnlocked: false,
      shareUnlocked: false,
    } as any);
    expect(saved.ok).toBe(true);
    const stored: MeetingRecord[] = JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => /record/i.test(k))!)!);
    const found = renderHook(() => useRecordParam(), { wrapper: wrapperFor(`/records/${stored[0].id}`) });
    expect(found.result.current?.id).toBe(stored[0].id);
    expect(found.result.current?.title).toBe("디자인 리뷰");
  });

  it("AC-3[P0]: RecordNotFound는 안내 문구와 '홈으로' 버튼을 렌더링한다", () => {
    render(React.createElement(MemoryRouter, null, React.createElement(RecordNotFound)));
    expect(screen.getByText("기록을 찾을 수 없어요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "홈으로" })).toBeInTheDocument();
  });

  it("AC-4[P0]: '홈으로'를 탭하면 '/'로 navigate한다", () => {
    render(React.createElement(MemoryRouter, null, React.createElement(RecordNotFound)));
    fireEvent.click(screen.getByRole("button", { name: "홈으로" }));
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });

  it("useActiveMeeting: start/pause/resume/finalize 호출 후 active를 다시 읽는다", () => {
    const { result } = renderHook(() => useActiveMeeting());
    expect(result.current.active).toBeNull();
    act(() => {
      result.current.start(setup);
    });
    expect(result.current.active?.setup.title).toBe("주간 스프린트 회의");
    expect(result.current.active?.pausedAt).toBeNull();
    act(() => {
      result.current.pause();
    });
    expect(result.current.active?.pausedAt).not.toBeNull();
    act(() => {
      result.current.resume();
    });
    expect(result.current.active?.pausedAt).toBeNull();
    act(() => {
      result.current.finalize();
    });
    expect(loadActive()).toBeNull();
    expect(result.current.active).toBeNull();
  });
});
