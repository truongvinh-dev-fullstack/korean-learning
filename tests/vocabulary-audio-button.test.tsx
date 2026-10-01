// @vitest-environment happy-dom
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VocabularyAudioButton } from "@/components/lessons/vocabulary-audio-button";

class FakeAudio extends EventTarget {
  static instances: FakeAudio[] = [];
  static playResult: () => Promise<void> = () => Promise.resolve();
  src = "";
  preload = "";
  play = vi.fn(() => FakeAudio.playResult());
  pause = vi.fn();
  load = vi.fn();
  removeAttribute = vi.fn();
  constructor() { super(); FakeAudio.instances.push(this); }
}
const flushPlayback = () => act(async () => { await Promise.resolve(); });

beforeEach(() => {
  FakeAudio.instances = [];
  FakeAudio.playResult = () => Promise.resolve();
  vi.stubGlobal("Audio", FakeAudio);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe("Vocabulary pronunciation button", () => {
  it("does not create or load audio before the learner clicks", async () => {
    render(<VocabularyAudioButton hangul="물" audioUrl="/audio/vocab/mul.ogg" />);
    expect(FakeAudio.instances).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Nghe phát âm 물" }));
    expect(FakeAudio.instances[0].src).toBe("/audio/vocab/mul.ogg");
    expect(FakeAudio.instances[0].preload).toBe("none");
    expect(screen.getByRole("status").textContent).toContain("Đang tải");
    await flushPlayback();
    expect(screen.getByRole("button", { name: "Dừng phát âm 물" }).getAttribute("aria-pressed")).toBe("true");
  });

  it.each([null, "", "javascript:alert(1)", "//evil.example/audio"])("disables unavailable or unsafe audio %s", (audioUrl) => {
    render(<VocabularyAudioButton hangul="물" audioUrl={audioUrl} />);
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("status").textContent).toBe("Chưa có âm thanh");
    expect(FakeAudio.instances).toHaveLength(0);
  });

  it("stops the current word when another button is clicked", async () => {
    render(<><VocabularyAudioButton hangul="물" audioUrl="/audio/vocab/mul.ogg" /><VocabularyAudioButton hangul="아이" audioUrl="/audio/vocab/ai.ogg" /></>);
    fireEvent.click(screen.getByRole("button", { name: "Nghe phát âm 물" }));
    await flushPlayback();
    fireEvent.click(screen.getByRole("button", { name: "Nghe phát âm 아이" }));
    await flushPlayback();
    expect(FakeAudio.instances[0].pause).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Nghe phát âm 물" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: "Dừng phát âm 아이" })).toBeTruthy();
  });

  it("cancels during loading and ignores late callbacks from the canceled play", async () => {
    render(<VocabularyAudioButton hangul="물" audioUrl="/audio/vocab/mul.ogg" />);
    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByRole("button"));
    await flushPlayback();
    expect(FakeAudio.instances).toHaveLength(1);
    expect(FakeAudio.instances[0].pause).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Nghe phát âm 물" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("resets when playback finishes and replays from a new audio instance", async () => {
    render(<VocabularyAudioButton hangul="물" audioUrl="/audio/vocab/mul.ogg" />);
    fireEvent.click(screen.getByRole("button"));
    await flushPlayback();
    act(() => { FakeAudio.instances[0].dispatchEvent(new Event("ended")); });
    fireEvent.click(screen.getByRole("button", { name: "Nghe phát âm 물" }));
    await flushPlayback();
    expect(FakeAudio.instances).toHaveLength(2);
  });

  it("reports a failed recording and allows retry", async () => {
    render(<VocabularyAudioButton hangul="물" audioUrl="/audio/missing.ogg" />);
    fireEvent.click(screen.getByRole("button"));
    act(() => { FakeAudio.instances[0].dispatchEvent(new Event("error")); });
    await flushPlayback();
    expect(screen.getByRole("status").textContent).toContain("Không phát được");
    fireEvent.click(screen.getByRole("button"));
    await flushPlayback();
    expect(FakeAudio.instances).toHaveLength(2);
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("handles play() rejection without an unhandled promise", async () => {
    FakeAudio.playResult = () => Promise.reject(new Error("NotAllowedError"));
    render(<VocabularyAudioButton hangul="물" audioUrl="/audio/vocab/mul.ogg" />);
    fireEvent.click(screen.getByRole("button"));
    await flushPlayback();
    expect(screen.getByRole("status").textContent).toContain("Không phát được");
    expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe("false");
  });

  it("times out a stalled download and ignores a late play resolution", async () => {
    vi.useFakeTimers();
    let resolvePlay: () => void;
    FakeAudio.playResult = () => new Promise<void>((resolve) => { resolvePlay = resolve; });
    render(<VocabularyAudioButton hangul="물" audioUrl="/audio/vocab/mul.ogg" />);
    fireEvent.click(screen.getByRole("button"));
    act(() => { vi.advanceTimersByTime(15_000); });
    expect(screen.getByRole("status").textContent).toContain("Không phát được");
    await act(async () => { resolvePlay(); await Promise.resolve(); });
    expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe("false");
  });

  it("stops audio when its URL changes or the component unmounts", async () => {
    const view = render(<VocabularyAudioButton hangul="물" audioUrl="/audio/vocab/mul.ogg" />);
    fireEvent.click(screen.getByRole("button"));
    await flushPlayback();
    view.rerender(<VocabularyAudioButton hangul="물" audioUrl="/audio/new.ogg" />);
    expect(FakeAudio.instances[0].pause).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button"));
    await flushPlayback();
    view.unmount();
    expect(FakeAudio.instances[1].pause).toHaveBeenCalledOnce();
  });

  it("stops when the lesson's native audio player starts", async () => {
    const view = render(<><audio controls /><VocabularyAudioButton hangul="물" audioUrl="/audio/vocab/mul.ogg" /></>);
    fireEvent.click(screen.getByRole("button"));
    await flushPlayback();
    fireEvent.play(view.container.querySelector("audio")!);
    expect(FakeAudio.instances[0].pause).toHaveBeenCalledOnce();
    expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe("false");
  });
});
