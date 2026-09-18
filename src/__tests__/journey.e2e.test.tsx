// 핵심 여정 E2E — App 전체를 렌더링해 홈 → 설정 → 회의 → 종료 → 결론 → 리포트를 순회하고,
// 그동안 console.error가 한 번도 호출되지 않는지 확인한다(검수: 콘솔 에러 0건).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";

// ── TDS mock (jsdom 충돌 방지) — 여정에서 실제로 렌더되는 컴포넌트 전부 ──
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
        Texts: ({ top, bottom }: any) =>
          h(R.Fragment, null, h("span", null, top), h("span", null, bottom)),
      },
    ),
    BottomSheet: Object.assign(({ children, open }: any) => (open ? h("div", null, children) : null), {
      Header: passthrough("div"),
    }),
    Tab: Object.assign(passthrough("div"), { Item: btn }),
  };
});

// ── SDK mock: 햅틱 등은 no-op ──
vi.mock("@apps-in-toss/web-framework", () => ({
  generateHapticFeedback: vi.fn(),
  loadFullScreenAd: vi.fn(),
  showFullScreenAd: vi.fn(),
  TossAds: {
    initialize: Object.assign(vi.fn(), { isSupported: () => false }),
    attachBanner: Object.assign(vi.fn(), { isSupported: () => false }),
  },
  Analytics: { screen: vi.fn(), click: vi.fn(), impression: vi.fn() },
  share: vi.fn(),
}));

// ── 광고 컴포넌트 mock: 보상형 광고는 버튼 클릭 → 다음 틱에 시청 완료, 배너는 렌더하지 않는다 ──
vi.mock("@/components/TossRewardAd", async () => {
  const R = await import("react");
  const h = R.createElement;
  return {
    TossRewardAd: ({ children, onRewarded, buttonText = "광고 보고 확인하기" }: any) => {
      const [unlocked, setUnlocked] = R.useState(false);
      if (unlocked) return h(R.Fragment, null, children);
      return h(
        "button",
        {
          onClick: () =>
            setTimeout(() => {
              setUnlocked(true);
              onRewarded?.();
            }, 0),
        },
        buttonText,
      );
    },
  };
});
vi.mock("@/components/AdSlot", () => ({ AdSlot: () => null }));

import App from "@/App";

const MEETING_SECONDS = 2700;

describe("핵심 여정 E2E", () => {
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

  it("AC-3/AC-4: 홈 → 5명·5000만 원·30분 → 2700초 → 종료 → '결론이 없었어요' → 리포트 60,096원, console.error 0건", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    // 홈 → 설정
    fireEvent.click(screen.getByRole("button", { name: "새 회의 시작" }));
    fireEvent.change(screen.getByPlaceholderText("예: 5"), { target: { value: "5" } });
    fireEvent.change(screen.getByPlaceholderText("예: 5000"), { target: { value: "5000" } });
    fireEvent.change(screen.getByPlaceholderText("예: 30"), { target: { value: "30" } });
    expect(screen.getByRole("button", { name: "회의 시작" })).not.toBeDisabled();

    // 회의 시작 → 진행 화면
    fireEvent.click(screen.getByRole("button", { name: "회의 시작" }));
    expect(screen.getByRole("button", { name: "회의 종료" })).toBeInTheDocument();

    // 가짜 타이머로 2700초 진행
    await act(async () => {
      await vi.advanceTimersByTimeAsync(MEETING_SECONDS * 1000);
    });

    // 종료 → 확인 다이얼로그(왼쪽 버튼은 '닫기') → 종료
    fireEvent.click(screen.getByRole("button", { name: "회의 종료" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "취소" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "종료" }));

    // 마무리: 5명 · 연봉 5000만 원 · 45분 회의의 총비용 = 90,144원
    expect(screen.getByText("결론이 났나요?")).toBeInTheDocument();
    expect(screen.getAllByText("90,144원").length).toBeGreaterThan(0);

    // 결론 없음 → 리포트
    fireEvent.click(screen.getByRole("button", { name: "결론이 없었어요" }));
    fireEvent.click(screen.getByRole("button", { name: "리포트 보기" }));

    // 광고 목 완료
    fireEvent.click(screen.getByRole("button", { name: "광고 보고 확인하기" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    // 낭비 비용: 초과 15분 30,048원 + 계획 30분 60,096원 × 결론 없음 50% = 60,096원
    expect(screen.getAllByText(/60,096원/).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "같은 설정으로 다시 시작" })).toBeInTheDocument();

    expect(errorSpy).toHaveBeenCalledTimes(0);
  });

  it("AC-4: 잘못된 입력(참석자 1명)은 회의를 시작하지 않고 인라인 안내를 보여주며 console.error 0건", () => {
    render(
      <MemoryRouter initialEntries={["/setup"]}>
        <App />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByPlaceholderText("예: 5"), { target: { value: "1" } });
    fireEvent.change(screen.getByPlaceholderText("예: 5000"), { target: { value: "5000" } });
    expect(screen.getByRole("button", { name: "회의 시작" })).toBeDisabled();
    expect(screen.getByText("참석자는 2~100명까지 입력할 수 있어요")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "회의 종료" })).toBeNull();
    expect(errorSpy).toHaveBeenCalledTimes(0);
  });
});
