import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mockTds, mockAppsInToss } from "@/__tests__/__helpers__/mocks";

mockTds();
mockAppsInToss();

import Home from "@/pages/Home";

describe("Home 레이아웃", () => {
  it("빈 상태에서 1차 CTA는 하나이고 주간 히어로는 없다", () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.getAllByRole("button", { name: "새 회의 시작" })).toHaveLength(1);
    expect(screen.queryAllByTestId("week-summary-hero")).toHaveLength(0);
  });
});
