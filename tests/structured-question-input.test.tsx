// @vitest-environment happy-dom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  StructuredQuestionInput,
  isQuestionAnswered,
} from "@/components/exercises/structured-question-input";
import type { SanitizedQuestion } from "@/modules/exercises/exercise.service";

describe("StructuredQuestionInput - TRUE_FALSE", () => {
  const tfQuestion: SanitizedQuestion = {
    id: "q-tf-1",
    exerciseId: "ex-1",
    type: "TRUE_FALSE",
    prompt: "Trước khi Hangeul ra đời, người Hàn chủ yếu sử dụng chữ Hán trong văn bản.",
    audioUrl: null,
    displayOrder: 1,
    options: [],
    content: {},
  };

  it("renders Đúng and Sai options clearly", () => {
    render(
      <StructuredQuestionInput
        question={tfQuestion}
        answer={{}}
        onChange={vi.fn()}
      />
    );

    const dungButton = screen.getByRole("radio", { name: /Đúng/i });
    const saiButton = screen.getByRole("radio", { name: /Sai/i });

    expect(dungButton).not.toBeNull();
    expect(saiButton).not.toBeNull();
    expect(dungButton.getAttribute("aria-checked")).toBe("false");
    expect(saiButton.getAttribute("aria-checked")).toBe("false");
    expect(screen.getByText(/Nhấp chọn một trong hai phương án/i)).not.toBeNull();
  });

  it("calls onChange with textAnswer: 'true' when clicking Đúng", () => {
    const onChange = vi.fn();
    render(
      <StructuredQuestionInput
        question={tfQuestion}
        answer={{}}
        onChange={onChange}
      />
    );

    const dungButton = screen.getByRole("radio", { name: /Đúng/i });
    fireEvent.click(dungButton);

    expect(onChange).toHaveBeenCalledWith({ textAnswer: "true" });
  });

  it("calls onChange with textAnswer: 'false' when clicking Sai", () => {
    const onChange = vi.fn();
    render(
      <StructuredQuestionInput
        question={tfQuestion}
        answer={{}}
        onChange={onChange}
      />
    );

    const saiButton = screen.getByRole("radio", { name: /Sai/i });
    fireEvent.click(saiButton);

    expect(onChange).toHaveBeenCalledWith({ textAnswer: "false" });
  });

  it("highlights the selected answer when textAnswer is 'true'", () => {
    render(
      <StructuredQuestionInput
        question={tfQuestion}
        answer={{ textAnswer: "true" }}
        onChange={vi.fn()}
      />
    );

    const dungButton = screen.getByRole("radio", { name: /Đúng/i });
    const saiButton = screen.getByRole("radio", { name: /Sai/i });

    expect(dungButton.getAttribute("aria-checked")).toBe("true");
    expect(saiButton.getAttribute("aria-checked")).toBe("false");
    expect(dungButton.className).toContain("ring-2");
    expect(dungButton.className).toContain("border-indigo-500");
    expect(screen.getByText("Đang chọn")).not.toBeNull();
    expect(screen.getByText(/Bạn đang chọn:/i)).not.toBeNull();
  });

  it("highlights the selected answer when textAnswer is 'false'", () => {
    render(
      <StructuredQuestionInput
        question={tfQuestion}
        answer={{ textAnswer: "false" }}
        onChange={vi.fn()}
      />
    );

    const dungButton = screen.getByRole("radio", { name: /Đúng/i });
    const saiButton = screen.getByRole("radio", { name: /Sai/i });

    expect(dungButton.getAttribute("aria-checked")).toBe("false");
    expect(saiButton.getAttribute("aria-checked")).toBe("true");
    expect(saiButton.className).toContain("ring-2");
    expect(saiButton.className).toContain("border-indigo-500");
    expect(screen.getByText("Đang chọn")).not.toBeNull();
    expect(screen.getByText(/Bạn đang chọn:/i)).not.toBeNull();
  });

  it("evaluates isQuestionAnswered correctly for TRUE_FALSE", () => {
    expect(isQuestionAnswered(tfQuestion, undefined)).toBe(false);
    expect(isQuestionAnswered(tfQuestion, {})).toBe(false);
    expect(isQuestionAnswered(tfQuestion, { textAnswer: "" })).toBe(false);
    expect(isQuestionAnswered(tfQuestion, { textAnswer: "true" })).toBe(true);
    expect(isQuestionAnswered(tfQuestion, { textAnswer: "false" })).toBe(true);
  });
});
