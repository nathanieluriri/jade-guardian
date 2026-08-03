import "@testing-library/jest-dom";
import { afterEach } from "vitest";

/**
 * jsdom ships no ResizeObserver. `input-otp` (the OTP field) constructs one on
 * mount to track slot height, so without this stub every screen that renders
 * the code input throws.
 */
class ResizeObserverStub implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = ResizeObserverStub;
}

/**
 * jsdom ships no IntersectionObserver. `@lottiefiles/dotlottie-react` uses it to
 * track visibility, so without this stub the Lottie component throws.
 */
class IntersectionObserverStub implements IntersectionObserver {
  readonly root: Element | null = null;
  readonly rootMargin: string = "";
  readonly thresholds: ReadonlyArray<number> = [];

  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

if (typeof globalThis.IntersectionObserver === "undefined") {
  globalThis.IntersectionObserver =
    IntersectionObserverStub as unknown as typeof globalThis.IntersectionObserver;
}

/**
 * jsdom implements no layout, so `Element.prototype.scrollIntoView` is missing
 * entirely. `cmdk` (the ⌘K palette) calls it in a layout effect to keep the
 * selected item visible, which throws the moment the dialog mounts.
 */
if (typeof Element !== "undefined" && typeof Element.prototype.scrollIntoView !== "function") {
  Element.prototype.scrollIntoView = function scrollIntoViewStub(): void {};
}

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

/**
 * Timer teardown guard.
 *
 * `input-otp` re-syncs the hidden input's selection through a helper that fans
 * one callback out over three timers (`setTimeout(fn, 0)`, `10`, `50`) and
 * returns no cleanup from the effect that schedules them — see the `syncTimeouts`
 * call in `input-otp/dist/index.js`, keyed on `[value, isFocused]`. Unmounting
 * the field therefore leaves up to three armed timers whose callback still
 * touches `Event`/`window`.
 *
 * A test that renders the OTP field, types into it and finishes inside 50ms
 * leaves those timers to fire *after* Vitest has torn the jsdom environment
 * down and deleted its globals — surfacing as an intermittent unhandled
 * "window is not defined" attributed to whichever file happened to be last.
 * It reproduced roughly one run in four, which is exactly the signature of a
 * race against teardown rather than a bug in the test.
 *
 * Rather than patch the dependency or sprinkle waits over every OTP test, every
 * timer a test arms is tracked and any still pending once that test's tree is
 * unmounted is cancelled. A timer still armed at that point has no test left to
 * observe it, so cancelling it can only remove noise. This hook is registered
 * before `@testing-library/react`'s auto-cleanup, and Vitest unwinds `afterEach`
 * hooks in reverse registration order, so it runs *after* the DOM is unmounted.
 *
 * Fake timers are untouched: while `vi.useFakeTimers()` is installed it owns
 * these globals, so nothing reaches the wrappers and no fake id can end up in
 * the registry.
 */
type TimerId = ReturnType<typeof setTimeout>;

const armedTimers = new Set<TimerId>();
const realSetTimeout = globalThis.setTimeout;
const realClearTimeout = globalThis.clearTimeout;
const realSetInterval = globalThis.setInterval;
const realClearInterval = globalThis.clearInterval;

globalThis.setTimeout = ((...args: Parameters<typeof setTimeout>) => {
  const id = realSetTimeout(...args);
  armedTimers.add(id);
  return id;
}) as typeof globalThis.setTimeout;

globalThis.clearTimeout = ((id?: TimerId) => {
  if (id !== undefined) armedTimers.delete(id);
  return realClearTimeout(id);
}) as typeof globalThis.clearTimeout;

globalThis.setInterval = ((...args: Parameters<typeof setInterval>) => {
  const id = realSetInterval(...args);
  armedTimers.add(id);
  return id;
}) as typeof globalThis.setInterval;

globalThis.clearInterval = ((id?: TimerId) => {
  if (id !== undefined) armedTimers.delete(id);
  return realClearInterval(id);
}) as typeof globalThis.clearInterval;

afterEach(() => {
  for (const id of armedTimers) {
    realClearTimeout(id);
    realClearInterval(id);
  }
  armedTimers.clear();
});
