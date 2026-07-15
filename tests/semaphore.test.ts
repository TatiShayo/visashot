import { describe, it, expect } from "vitest";
import { __newSemaphoreForTests } from "@/lib/semaphore";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

describe("processing semaphore", () => {
  it("allows up to maxConcurrent immediately", async () => {
    const sem = __newSemaphoreForTests(2, 2);
    const a = await sem.acquire();
    const b = await sem.acquire();
    expect(a).toBeTypeOf("function");
    expect(b).toBeTypeOf("function");
    expect(sem.state).toEqual({ inUse: 2, queued: 0 });
    a!();
    b!();
    expect(sem.state.inUse).toBe(0);
  });

  it("queues the next acquire and hands the slot over on release", async () => {
    const sem = __newSemaphoreForTests(1, 2);
    const first = await sem.acquire();
    let secondGot = false;
    const secondP = sem.acquire().then((rel) => {
      secondGot = true;
      return rel;
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(secondGot).toBe(false);
    expect(sem.state.queued).toBe(1);
    first!();
    const second = await secondP;
    expect(secondGot).toBe(true);
    second!();
  });

  it("sheds load (returns null) when slots AND queue are full", async () => {
    const sem = __newSemaphoreForTests(1, 1);
    const held = await sem.acquire();
    const queuedP = sem.acquire(); // fills the queue
    const rejected = await sem.acquire(); // over capacity — fail fast
    expect(rejected).toBeNull();
    held!();
    (await queuedP)!();
  });

  it("run() executes inside a slot and reports saturation without running", async () => {
    const sem = __newSemaphoreForTests(1, 0);
    const gate = deferred();
    const running = sem.run(async () => {
      await gate.promise;
      return 42;
    });
    await new Promise((r) => setTimeout(r, 10));
    let ran = false;
    const shed = await sem.run(async () => {
      ran = true;
      return 0;
    });
    expect(shed.ok).toBe(false);
    expect(ran).toBe(false);
    gate.resolve();
    const done = await running;
    expect(done).toEqual({ ok: true, value: 42 });
    // Slot free again after completion.
    const after = await sem.run(async () => "free");
    expect(after).toEqual({ ok: true, value: "free" });
  });

  it("release is idempotent — double release never over-frees", async () => {
    const sem = __newSemaphoreForTests(1, 1);
    const rel = await sem.acquire();
    rel!();
    rel!(); // no-op
    expect(sem.state.inUse).toBe(0);
    const again = await sem.acquire();
    expect(again).toBeTypeOf("function");
    expect(sem.state.inUse).toBe(1);
    again!();
  });
});
