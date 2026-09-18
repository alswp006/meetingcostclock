import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { MemoryRouter } from "react-router-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";

// ── TDS mock (jsdom 충돌 방지) — ConfirmDialog 등 앱이 실제로 쓰는 컴포넌트 전부 ──
vi.mock("@toss/tds-mobile", async () => {
  const R = await import("react");
  const h = R.createElement;
  const passthrough = (tag: string) => ({ children }: any) => h(tag, null, children);
  const btn = ({ children, onClick, disabled }: any) =>
    h("button", { onClick, disabled: disabled || undefined }, children);
  return {
    Button: btn,
    FixedBottomCTA: ({ children, onClick, disabled, loading }: any) =>
      h("button", { onClick, disabled: disabled || loading || undefined }, children),
    Spacing: () => h("div"),
    Paragraph: { Text: passthrough("span") },
    Top: Object.assign(({ title }: any) => h("nav", null, title), {
      TitleParagraph: passthrough("h1"),
    }),
    TextField: ({ label, placeholder, value, onChange, help, hasError }: any) =>
      h(
        "div",
        null,
        h("label", null, label, h("input", { placeholder, value, onChange, "aria-label": label })),
        hasError && help ? h("span", { role: "alert" }, help) : null,
      ),
    AlertDialog: Object.assign(
      ({ open, title, alertButton }: any) =>
        open ? h("div", { role: "alertdialog" }, h("h2", null, title), alertButton) : null,
      { AlertButton: btn },
    ),
    ConfirmDialog: Object.assign(
      ({ open, title, description, cancelButton, confirmButton }: any) =>
        open ? h("div", { role: "dialog" }, title, description, cancelButton, confirmButton) : null,
      {
        Title: passthrough("h2"),
        Description: passthrough("p"),
        CancelButton: btn,
        ConfirmButton: btn,
      },
    ),
    Toast: ({ open, text }: any) => (open ? h("div", { role: "status" }, text) : null),
    Chip: ({ children, onClick, selected }: any) =>
      h("button", { onClick, "aria-pressed": !!selected }, children),
    Asset: {
      ContentIcon: () => h("span"),
      Icon: () => h("span"),
      Image: () => h("span"),
    },
    Skeleton: () => h("div"),
    ListRow: Object.assign(
      ({ children, contents, left, right, onClick }: any) =>
        h("div", { onClick }, left, contents, children, right),
      {
        Texts: ({ top, bottom }: any) => h(R.Fragment, null, h("span", null, top), h("span", null, bottom)),
      },
    ),
    BottomSheet: Object.assign(({ children, open }: any) => (open ? h("div", null, children) : null), {
      Header: passthrough("div"),
    }),
    Tab: Object.assign(passthrough("div"), { Item: btn }),
  };
});

// ── SDK mock: 광고는 즉시 완료, 햅틱/배너는 no-op ──
vi.mock("@apps-in-toss/web-framework", () => {
  const supported = (fn: any) => Object.assign(fn, { isSupported: () => false });
  return {
    generateHapticFeedback: vi.fn(),
    loadFullScreenAd: vi.fn((o: any) => {
      setTimeout(() => o.onEvent?.({ type: "loaded" }), 0);
    }),
    showFullScreenAd: vi.fn((o: any) => {
      setTimeout(() => o.onEvent?.({ type: "rewarded" }), 0);
    }),
    TossAds: {
      initialize: supported(vi.fn()),
      attachBanner: supported(vi.fn()),
    },
    Analytics: { screen: vi.fn(), click: vi.fn(), impression: vi.fn() },
    share: vi.fn(),
  };
});

// ───────────── 정적 스캔 헬퍼 ─────────────
const SRC = path.resolve(__dirname, "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "__tests__" || e.name === "node_modules") continue;
      walk(p, out);
    } else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

function grepSrc(re: RegExp): string[] {
  const hits: string[] = [];
  for (const f of walk(SRC)) {
    fs.readFileSync(f, "utf8")
      .split("\n")
      .forEach((line, i) => {
        if (re.test(line)) hits.push(`${path.relative(SRC, f)}:${i + 1}: ${line.trim()}`);
      });
  }
  return hits;
}

describe("검수 준수 정적 테스트와 핵심 여정 E2E", () => {
  it("AC-1[P0]: compliance.test.ts가 존재하고 HEX 색상 리터럴 정규식을 검사한다", () => {
    const file = path.join(SRC, "__tests__", "compliance.test.ts");
    expect(fs.existsSync(file)).toBe(true);
    const body = fs.readFileSync(file, "utf8");
    expect(body).toContain("[0-9a-fA-F]{3,8}");
    expect(body).toMatch(/readdirSync|glob|walk/);
  });

  it("AC-1[P0]: src(테스트 제외)에 #RRGGBB 색상 리터럴이 0건이다", () => {
    const hits = grepSrc(/#[0-9a-fA-F]{3,8}\b/);
    expect(hits).toEqual([]);
    expect(walk(SRC).length).toBeGreaterThan(20);
  });

  it("AC-2[P0]: 금지 라이브러리 import가 0건이다", () => {
    const banned = /(from\s+|import\s*\(|require\()\s*["'](@mui|antd|@chakra-ui|stripe|@stripe|@tosspayments|firebase\/auth|.*admob)/i;
    const hits = grepSrc(banned);
    expect(hits).toEqual([]);
    expect(grepSrc(/from\s+["']@toss\/tds-mobile["']/).length).toBeGreaterThan(0);
  });

  it("AC-2[P0]: 금지 정적 패턴(취소 버튼·설치 유도·Tailwind p-/gap-)이 0건이다", () => {
    expect(grepSrc(/(CancelButton|AlertButton)[^>]*>\s*취소\s*</)).toEqual([]);
    expect(grepSrc(/["'`>]\s*[^"'`<]*(앱\s*설치|다운로드)[^"'`<]*["'`<]/)).toEqual([]);
    expect(grepSrc(/className=["'][^"']*\b(p|px|py|gap)-\d/)).toEqual([]);
  });

  it("AC-3[P0]: journey.e2e.test.tsx가 존재하고 핵심 여정 값을 검증한다", () => {
    const file = path.join(SRC, "__tests__", "journey.e2e.test.tsx");
    expect(fs.existsSync(file)).toBe(true);
    const body = fs.readFileSync(file, "utf8");
    expect(body).toContain("60,096원");
    expect(body).toContain("console");
    expect(body).toContain("2700");
  });

  describe("AC-3/4: 홈 → 설정 → 회의 → 종료 → 결론 → 리포트 여정", () => {
    let errorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      vi.useFakeTimers({
        toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"],
      });
      vi.setSystemTime(new Date("2026-09-19T10:00:00+09:00"));
      errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    });
    afterEach(() => {
      errorSpy.mockRestore();
    });

    it("AC-3[P0]/AC-4[P0]: 2700초 회의 후 '결론이 없었어요' → 리포트에 60,096원, console.error 0건", async () => {
      const { default: App } = await import("@/App");
      render(React.createElement(MemoryRouter, { initialEntries: ["/"] }, React.createElement(App)));

      // 홈 → 설정
      fireEvent.click(screen.getByRole("button", { name: "새 회의 시작" }));
      const attendees = screen.getByPlaceholderText("예: 5");
      fireEvent.change(attendees, { target: { value: "5" } });
      fireEvent.change(screen.getByPlaceholderText("예: 5000"), { target: { value: "5000" } });
      fireEvent.change(screen.getByPlaceholderText("예: 30"), { target: { value: "30" } });
      expect((attendees as HTMLInputElement).value).toBe("5");

      // 회의 시작 → 진행 화면
      fireEvent.click(screen.getByRole("button", { name: "회의 시작" }));
      expect(screen.getByRole("button", { name: "회의 종료" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "일시정지" })).toBeInTheDocument();

      // 가짜 타이머로 2700초 진행
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2700 * 1000);
      });

      // 종료 → 확인 다이얼로그 → 종료
      fireEvent.click(screen.getByRole("button", { name: "회의 종료" }));
      fireEvent.click(screen.getByRole("button", { name: "종료" }));
      expect(screen.getByText("결론이 났나요?")).toBeInTheDocument();
      expect(screen.getAllByText("90,144원").length).toBeGreaterThan(0);

      // 결론 선택 → 리포트 보기
      fireEvent.click(screen.getByRole("button", { name: "결론이 없었어요" }));
      fireEvent.click(screen.getByRole("button", { name: "리포트 보기" }));

      // 광고 목 완료(로드 → 시청 → rewarded)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10);
      });
      fireEvent.click(screen.getByRole("button", { name: "광고 보고 확인하기" }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10);
      });

      expect(screen.getAllByText(/60,096원/).length).toBeGreaterThan(0);
      expect(errorSpy).toHaveBeenCalledTimes(0);
    });

    it("AC-3[P0]: 잘못된 입력(참석자 1명)이면 회의가 시작되지 않고 설정 화면에 머문다", async () => {
      const { default: App } = await import("@/App");
      render(React.createElement(MemoryRouter, { initialEntries: ["/setup"] }, React.createElement(App)));
      fireEvent.change(screen.getByPlaceholderText("예: 5"), { target: { value: "1" } });
      fireEvent.change(screen.getByPlaceholderText("예: 5000"), { target: { value: "5000" } });
      expect(screen.getByRole("button", { name: "회의 시작" })).toBeDisabled();
      expect(screen.getByText("참석자는 2~100명까지 입력할 수 있어요")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "회의 종료" })).toBeNull();
      expect(errorSpy).toHaveBeenCalledTimes(0);
    });
  });
});
