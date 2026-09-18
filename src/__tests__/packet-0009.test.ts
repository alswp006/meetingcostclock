import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SetupForm from "@/components/setup/SetupForm";

vi.mock("@toss/tds-mobile", () => {
  const R = require("react");
  const h = R.createElement;
  const Btn = ({ children, onClick, disabled, loading, display, variant, color, size, ...p }: any) =>
    h("button", { onClick, disabled: disabled || loading || undefined, ...p }, children);
  return {
    Button: Btn,
    FixedBottomCTA: Btn,
    Spacing: ({ size }: any) => h("div", { "data-spacing": size }),
    Paragraph: {
      Text: ({ children, typography, ...p }: any) => h("span", { "data-typography": typography, ...p }, children),
    },
    TextField: R.forwardRef(({ label, help, hasError, variant, suffix, prefix, ...p }: any, ref: any) =>
      h(
        "label",
        null,
        label,
        h("input", { ref, "data-has-error": hasError ? "true" : "false", ...p }),
        help ? h("span", { "data-testid": "help" }, help) : null,
      ),
    ),
    Top: Object.assign(({ title }: any) => h("div", { "data-testid": "top" }, title), {
      TitleParagraph: ({ children }: any) => h("h1", null, children),
    }),
  };
});
vi.mock("@apps-in-toss/web-framework", () => ({
  generateHapticFeedback: vi.fn(),
}));

const renderForm = (props: Record<string, unknown> = {}) => {
  const onSubmit = vi.fn();
  render(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(SetupForm, { onSubmit, ...props } as any),
    ),
  );
  return onSubmit;
};

const change = (label: RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("S2 설정 폼 조각 (입력, 범위 검증, 시급 미리보기)", () => {
  it("AC-1: 참석자 5, 연봉 5000이면 시급 미리보기를 보여준다", () => {
    renderForm();
    change(/참석자/, "5");
    change(/연봉/, "5000");
    expect(screen.getByText(/팀 시급 120,192원/)).toBeTruthy();
    expect(screen.getByText(/1인 시급 24,038원/)).toBeTruthy();
    expect(screen.getByText(/분당 2,003원/)).toBeTruthy();
  });

  it("AC-1: 입력이 유효하지 않으면 미리보기를 숨긴다", () => {
    renderForm();
    change(/참석자/, "1");
    change(/연봉/, "5000");
    expect(screen.queryByText(/팀 시급/)).toBeNull();
    expect(screen.queryByText(/분당/)).toBeNull();
  });

  it("AC-2: 참석자 1이면 hasError이고 '회의 시작' 버튼이 disabled다", () => {
    const onSubmit = renderForm({
      initial: { title: "주간 회의", teamName: "개발팀", attendees: 5, annualSalaryManwon: 5000, plannedMinutes: 30 },
    });
    const button = screen.getByRole("button", { name: /회의 시작/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    change(/참석자/, "1");
    expect(screen.getByLabelText(/참석자/).getAttribute("data-has-error")).toBe("true");
    expect((screen.getByRole("button", { name: /회의 시작/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /회의 시작/ }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("AC-3: 회의명·팀명을 비우고 제출하면 기본값이 전달된다", () => {
    const onSubmit = renderForm({
      initial: { title: "", teamName: "", attendees: 5, annualSalaryManwon: 5000, plannedMinutes: 30 },
    });
    fireEvent.click(screen.getByRole("button", { name: /회의 시작/ }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      title: "이름 없는 회의",
      teamName: "우리 팀",
      attendees: 5,
      annualSalaryManwon: 5000,
      plannedMinutes: 30,
    });
  });

  it("AC-3: initial prop으로 프리필된 값이 그대로 제출된다", () => {
    const onSubmit = renderForm({
      initial: { title: "스프린트 회고", teamName: "플랫폼팀", attendees: 8, annualSalaryManwon: 6000, plannedMinutes: 45 },
    });
    expect((screen.getByLabelText(/회의명/) as HTMLInputElement).value).toBe("스프린트 회고");
    fireEvent.click(screen.getByRole("button", { name: /회의 시작/ }));
    expect(onSubmit.mock.calls[0][0]).toEqual({
      title: "스프린트 회고",
      teamName: "플랫폼팀",
      attendees: 8,
      annualSalaryManwon: 6000,
      plannedMinutes: 45,
    });
  });

  it("AC-4: 숫자 필드는 inputMode numeric이고 숫자 아닌 문자는 제거된다", () => {
    renderForm();
    for (const label of [/참석자/, /연봉/, /예정 시간/]) {
      expect(screen.getByLabelText(label).getAttribute("inputmode")).toBe("numeric");
    }
    change(/참석자/, "1a2b");
    expect((screen.getByLabelText(/참석자/) as HTMLInputElement).value).toBe("12");
    change(/연봉/, "5,0k00원");
    expect((screen.getByLabelText(/연봉/) as HTMLInputElement).value).toBe("5000");
  });
});
