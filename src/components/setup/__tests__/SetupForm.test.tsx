import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { mockAll } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";
import { SetupForm } from "@/components/setup/SetupForm";

mockAll();

const change = (label: RegExp, value: string) =>
  fireEvent.change(screen.getByPlaceholderText(label), { target: { value } });

describe("SetupForm", () => {
  it("AC-1: 시급 미리보기", () => {
    renderWithRouter(<SetupForm onSubmit={vi.fn()} />);
    change(/예: 5$/, "5");
    change(/예: 5000/, "5000");
    expect(screen.getByText("팀 시급 120,192원")).toBeInTheDocument();
    expect(screen.getByText("1인 시급 24,038원")).toBeInTheDocument();
    expect(screen.getByText("분당 2,003원")).toBeInTheDocument();
  });

  it("AC-2: 참석자 1이면 오류와 disabled", () => {
    renderWithRouter(<SetupForm onSubmit={vi.fn()} />);
    change(/예: 5$/, "1");
    expect(screen.getByRole("alert")).toHaveTextContent("2~100명");
    expect(screen.getByRole("button", { name: "회의 시작" })).toBeDisabled();
  });

  it("AC-3: 빈 이름은 기본값으로 제출", () => {
    const onSubmit = vi.fn();
    renderWithRouter(<SetupForm onSubmit={onSubmit} />);
    change(/예: 5$/, "5");
    change(/예: 5000/, "5000");
    fireEvent.click(screen.getByRole("button", { name: "회의 시작" }));
    expect(onSubmit).toHaveBeenCalledWith({
      title: "이름 없는 회의",
      teamName: "우리 팀",
      attendees: 5,
      annualSalaryManwon: 5000,
      plannedMinutes: 30,
    });
  });

  it("AC-4: numeric 입력, 숫자 외 문자 제거", () => {
    renderWithRouter(<SetupForm onSubmit={vi.fn()} />);
    const input = screen.getByPlaceholderText(/예: 5$/) as HTMLInputElement;
    expect(input).toHaveAttribute("inputmode", "numeric");
    change(/예: 5$/, "1a2b");
    expect(input.value).toBe("12");
  });

  it("빈 필드로 제출하면 안내 문구를 보이고 제출하지 않는다", () => {
    const onSubmit = vi.fn();
    renderWithRouter(<SetupForm onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: "회의 시작" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("참석자 수를 입력해주세요")).toBeInTheDocument();
  });
});
