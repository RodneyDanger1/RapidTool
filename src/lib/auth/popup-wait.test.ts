/**
 * Pins for `popup-wait.ts` — the settlement state machine behind the live-
 * preview popup sign-in.
 *
 * The bug this locks down: the old inline waiter settled on EITHER the
 * completion page's `postMessage` OR the `popup.closed` poll, with NO overall
 * ceiling. A browser that blocked `window.close()` (so `popup.closed` stayed
 * false) AND dropped the `postMessage` (a throw inside the popup page's inline
 * script, popup.server.ts) fired neither event — `signIn` awaited forever.
 * `resolves cause:timeout…` below is RED against that shape (the promise never
 * settles; the test's own deadline is the failure) and GREEN with the ceiling.
 *
 * The clock is virtual (no real timers) so every path is deterministic and the
 * suite is instant on both runtimes.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  POPUP_WAIT_TIMEOUT_MS,
  popupFailureMessage,
  waitForPopupOutcome,
  type PopupWaitHost,
  type PopupWaitOutcome,
} from "./popup-wait.ts";

type Timer = { id: number; at: number; every?: number; kind: "interval" | "timeout"; fn: () => void };
type Message = { origin: string; source: unknown; data: unknown };

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

/** A deterministic clock host — installed into the module as its browser. */
function makeClock() {
  let now = 0;
  let nextId = 1;
  const timers = new Map<number, Timer>();
  const listeners: Array<(event: Message) => void> = [];
  const host: PopupWaitHost = {
    origin: "https://app.grok-sandbox.com",
    addMessageListener: (listener) => {
      listeners.push(listener);
    },
    removeMessageListener: (listener) => {
      const i = listeners.indexOf(listener);
      if (i >= 0) listeners.splice(i, 1);
    },
    setInterval: (fn, ms) => {
      const id = nextId++;
      timers.set(id, { id, at: now + ms, every: ms, kind: "interval", fn });
      return id;
    },
    clearInterval: (id) => {
      timers.delete(id);
    },
    setTimeout: (fn, ms) => {
      const id = nextId++;
      timers.set(id, { id, at: now + ms, kind: "timeout", fn });
      return id;
    },
    clearTimeout: (id) => {
      timers.delete(id);
    },
  };
  /** Fire every due timer (earliest first) up to `now + ms`. */
  function advance(ms: number): void {
    const target = now + ms;
    for (;;) {
      let due: Timer | undefined;
      for (const t of timers.values()) {
        if (t.at <= target && (due === undefined || t.at < due.at || (t.at === due.at && t.id < due.id))) due = t;
      }
      if (!due) break;
      now = due.at;
      if (due.kind === "timeout") timers.delete(due.id);
      else due.at = due.at + (due.every ?? 0);
      due.fn();
    }
    now = target;
  }
  function emit(event: Message): void {
    for (const listener of [...listeners]) listener(event);
  }
  return { host, advance, emit, listeners: () => listeners.length };
}

const popupMessage = (token: string | null, error?: string): Message => {
  const data: Record<string, unknown> = { source: "grok-auth-popup", token };
  if (error !== undefined) data.error = error;
  return { origin: "https://app.grok-sandbox.com", source: { popup: true }, data };
};

describe("waitForPopupOutcome — bounded popup settlement", () => {
  it("the overall ceiling is a finite positive bound (never Infinity)", () => {
    assert.equal(Number.isFinite(POPUP_WAIT_TIMEOUT_MS), true);
    assert.ok(POPUP_WAIT_TIMEOUT_MS > 0, "a zero ceiling would cancel every sign-in");
  });

  it("resolves cause:token when THIS popup posts a bearer, and drops the listener", async () => {
    const popup = { closed: false };
    const clock = makeClock();
    const p = waitForPopupOutcome(popup, clock.host, { timeoutMs: 1000, pollMs: 100, closeGraceMs: 50 });
    assert.equal(clock.listeners(), 1, "one message listener is installed");
    const msg = popupMessage("bearer-abc");
    clock.emit({ ...msg, source: popup });
    assert.deepEqual(await p, { token: "bearer-abc", cause: "token" });
    assert.equal(clock.listeners(), 0, "the message listener is removed on settle");
  });

  it("ignores a message from another ORIGIN, then settles on the correct one", async () => {
    const popup = { closed: false };
    const clock = makeClock();
    const p = waitForPopupOutcome(popup, clock.host, { timeoutMs: 10000, pollMs: 100, closeGraceMs: 50 });
    let settled = false;
    void p.then(() => {
      settled = true;
    });
    clock.emit({ ...popupMessage("evil"), origin: "https://evil.example", source: popup });
    await flush();
    assert.equal(settled, false, "a cross-origin message must not settle the wait");
    clock.emit({ ...popupMessage("good"), source: popup });
    assert.deepEqual(await p, { token: "good", cause: "token" });
  });

  it("ignores a message whose source is a DIFFERENT popup (concurrent attempts cannot cross-settle)", async () => {
    const popupA = { closed: false };
    const popupB = { closed: false };
    const clock = makeClock();
    const p = waitForPopupOutcome(popupA, clock.host, { timeoutMs: 10000, pollMs: 100, closeGraceMs: 50 });
    let settled = false;
    void p.then(() => {
      settled = true;
    });
    clock.emit({ ...popupMessage("from-B"), source: popupB });
    await flush();
    assert.equal(settled, false, "popup B's completion must not settle popup A's waiter");
    clock.emit({ ...popupMessage("from-A"), source: popupA });
    assert.deepEqual(await p, { token: "from-A", cause: "token" });
  });

  it("ignores a same-window message that is not the auth-popup shape", async () => {
    const popup = { closed: false };
    const clock = makeClock();
    const p = waitForPopupOutcome(popup, clock.host, { timeoutMs: 10000, pollMs: 100, closeGraceMs: 50 });
    clock.emit({ origin: clock.host.origin, source: popup, data: { source: "other", token: "x" } });
    clock.emit({ origin: clock.host.origin, source: popup, data: null });
    let settled = false;
    void p.then(() => {
      settled = true;
    });
    await flush();
    assert.equal(settled, false, "a non-auth message must be ignored");
    clock.emit({ ...popupMessage("real"), source: popup });
    await p;
  });

  it("resolves cause:cancelled after the popup closes and the grace elapses", async () => {
    const popup = { closed: false };
    const clock = makeClock();
    const p = waitForPopupOutcome(popup, clock.host, { timeoutMs: 10000, pollMs: 100, closeGraceMs: 50 });
    popup.closed = true;
    clock.advance(100); // the poll notices the close and arms the grace timer
    clock.advance(50); // grace elapses with no message → cancelled
    assert.deepEqual(await p, { token: null, cause: "cancelled" });
  });

  it("a completion postMessage wins over a racing popup.closed (grace period)", async () => {
    const popup = { closed: false };
    const clock = makeClock();
    const p = waitForPopupOutcome(popup, clock.host, { timeoutMs: 10000, pollMs: 100, closeGraceMs: 200 });
    popup.closed = true;
    clock.advance(100); // poll fires → grace timer armed, not yet settled
    clock.emit({ ...popupMessage("raced"), source: popup });
    assert.deepEqual(await p, { token: "raced", cause: "token" });
    clock.advance(1000); // the grace timer was cleared; nothing settles twice
  });

  it("resolves cause:timeout when neither a message nor a close ever arrives (the hang)", async () => {
    // `window.close()` blocked → popup.closed stays false; postMessage dropped →
    // no message. The old waiter had no ceiling, so this never settled.
    const popup = { closed: false };
    const clock = makeClock();
    const p = waitForPopupOutcome(popup, clock.host, { timeoutMs: 1000, pollMs: 100, closeGraceMs: 50 });
    let settled = false;
    void p.then(() => {
      settled = true;
    });
    clock.advance(999);
    await flush();
    assert.equal(settled, false, "still waiting just below the ceiling");
    clock.advance(1);
    assert.deepEqual(await p, { token: null, cause: "timeout" });
  });

  it("a token arriving after the ceiling cannot resurrect a timed-out wait", async () => {
    const popup = { closed: false };
    const clock = makeClock();
    const p = waitForPopupOutcome(popup, clock.host, { timeoutMs: 500, pollMs: 100, closeGraceMs: 50 });
    clock.advance(500);
    const first = await p;
    assert.deepEqual(first, { token: null, cause: "timeout" });
    clock.emit({ ...popupMessage("late"), source: popup });
    await flush();
    assert.deepEqual(await p, first, "the first settlement is final");
  });

  it("a token:null completion resolves cause:failed carrying the popup's error", async () => {
    const popup = { closed: false };
    const clock = makeClock();
    const p = waitForPopupOutcome(popup, clock.host, { timeoutMs: 10000, pollMs: 100, closeGraceMs: 50 });
    clock.emit({ ...popupMessage(null, "oauth_init_failed_500"), source: popup });
    const outcome = (await p) as PopupWaitOutcome;
    assert.deepEqual(outcome, { token: null, cause: "failed", error: "oauth_init_failed_500" });
    assert.equal(popupFailureMessage(outcome), "Sign-in failed: oauth_init_failed_500");
  });

  it("popupFailureMessage names the timeout explicitly and stays generic otherwise", () => {
    assert.equal(
      popupFailureMessage({ token: null, cause: "timeout" }),
      "Sign-in timed out — close the sign-in pop-up and try again",
    );
    assert.equal(popupFailureMessage({ token: null, cause: "cancelled" }), "Sign-in was cancelled or failed");
    assert.equal(popupFailureMessage({ token: null, cause: "failed" }), "Sign-in was cancelled or failed");
  });
});
