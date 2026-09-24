import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { mockTds } from "@/__tests__/__helpers__/mocks";

mockTds();

import { ReportBody } from "@/components/report/ReportBody";
import type { MeetingRecord } from "@/lib/types";

// TDS MobileTypography — 큰 것부터 작은 것 순(설치본 .d.ts 선언 순서). st6은 t2와 t3 사이의 '제목급'이다.
const TYPO_ORDER = ["t1", "st1", "st2", "st3", "t2", "st4", "st5", "st6", "t3", "st7", "t4", "st8", "st9", "t5", "st10", "t6", "st11", "t7", "st12", "st13"];
const rank = (t: string | null) => TYPO_ORDER.indexOf(t ?? "");

const rec: MeetingRecord = {
  id: "r12",
  title: "주간회의",
  teamName: "제품팀",
  attendees: 6,
  annualSalaryManwon: 6000,
  plannedMinutes: 30,
  startedAt: "2026-09-24T01:00:00.000Z",
  endedAt: "2026-09-24T01:00:12.000Z",
  durationSec: 12,
  totalCost: 576,
  outcome: "partial",
  wasteCost: 144,
  reportUnlocked: true,
  shareUnlocked: false,
  createdAt: "2026-09-24T01:00:12.000Z",
  updatedAt: "2026-09-24T01:00:12.000Z",
};

describe("ReportBody", () => {
  it("M3: 계산 방식 설명은 제목 크기가 아니라 보조 캡션(t7)이다 — 제목 위계는 그대로", () => {
    render(<ReportBody record={rec} outcome="partial" />);
    const note = screen.getByText("초과 시간 비용 + 결론 여부에 따른 비율로 계산해요");
    const typo = note.getAttribute("data-typography");
    expect(typo).toBe("t7");
    // 항목 행(t6)보다 작고, 히어로 금액(t1)은 여전히 가장 크다
    expect(rank(typo)).toBeGreaterThan(rank(screen.getByText("기본 비용").getAttribute("data-typography")));
    expect(within(screen.getByTestId("report-summary-hero")).getByText("576원")).toHaveAttribute("data-typography", "t1");
    expect(screen.getByText("이번 회의 비용")).toHaveAttribute("data-typography", "st11");
    // 보조색은 adaptive 토큰(다크모드) — HEX 금지
    expect(note.getAttribute("color") ?? "").toMatch(/^var\(--adaptive/);
  });

  it("M2: 12초 회의의 히어로 캡션은 '1분'이 아니라 '12초'다", () => {
    render(<ReportBody record={rec} outcome="partial" />);
    expect(screen.getByText(/^12초 · 6명 · 팀 시급/)).toBeInTheDocument();
    expect(screen.queryByText(/^1분 ·/)).toBeNull();
  });

  it("초과 분은 회의 길이와 같은 버림 규칙이다 — 30분 계획에 30분 30초면 '30분'·'초과 비용 (0분)'(반올림이면 1분으로 어긋난다)", () => {
    render(<ReportBody record={{ ...rec, durationSec: 1830 }} outcome="partial" />);
    expect(screen.getByText(/^30분 · 6명 · 팀 시급/)).toBeInTheDocument();
    expect(screen.getByText("초과 비용 (0분)")).toBeInTheDocument();
  });
});
