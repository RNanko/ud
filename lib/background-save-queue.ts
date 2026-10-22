export type SaveFailureStatus = "unknown" | "conflict" | "rejected";

export class BackgroundSaveError<S = unknown> extends Error {
  constructor(message: string, public status: SaveFailureStatus = "unknown", public snapshot?: S) {
    super(message);
  }
}

export type BackgroundSaveState<S, O, C> = {
  snapshot: S;
  count: number;
  phase: "idle" | "saving" | "failed";
  failure: BackgroundSaveError<S> | null;
  head: { input: O; command?: C } | null;
  inputs: readonly O[];
};

// Keep refresh/close protection alive even when client navigation unmounts a
// board. Its queue still finishes in memory; a full page close cannot do that.
const outstanding = new Set<object>();
export type DetachedSave = { id: number; owner: string; failure: BackgroundSaveError; retry: () => Promise<unknown>; discard: () => boolean };
const detached = new Map<object, DetachedSave>();
const recoveryListeners = new Set<() => void>();
let recoverySnapshot: DetachedSave[] = [];
let serial = 0;
export const getDetachedSaves = () => recoverySnapshot;
export const subscribeDetachedSaves = (listener: () => void) => {
  recoveryListeners.add(listener);
  return () => { recoveryListeners.delete(listener); };
};
function protectClose(event: BeforeUnloadEvent) {
  event.preventDefault();
  event.returnValue = "";
}
function protect(queue: object, active: boolean) {
  if (typeof window === "undefined") return;
  if (active) {
    if (!outstanding.size) window.addEventListener("beforeunload", protectClose);
    outstanding.add(queue);
  } else {
    outstanding.delete(queue);
    if (!outstanding.size) window.removeEventListener("beforeunload", protectClose);
  }
}

type Waiter<S> = { resolve: (snapshot: S) => void; reject: (error: Error) => void };
type Entry<S, O, C> = { input: O; command?: C; waiters: Waiter<S>[] };

/** Optimistic view + one acknowledged write at a time. Commands are prepared
 * from confirmed state, never from a revision belonging to an unsaved drag. */
export class BackgroundSaveQueue<S, O, C> {
  private id = ++serial;
  private confirmed: S;
  private entries: Entry<S, O, C>[] = [];
  private listeners = new Set<() => void>();
  private running = false;
  private failure: BackgroundSaveError<S> | null = null;
  private state: BackgroundSaveState<S, O, C>;

  constructor(initial: S, private options: {
    reduce: (snapshot: S, input: O) => S;
    prepare: (snapshot: S, input: O) => C;
    save: (command: C) => Promise<S>;
    owner?: string;
  }) {
    this.confirmed = initial;
    this.state = { snapshot: initial, count: 0, phase: "idle", failure: null, head: null, inputs: [] };
  }

  getState = () => this.state;
  configure(options: typeof this.options) { this.options = options; }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    this.updateRecovery();
    return () => { this.listeners.delete(listener); this.updateRecovery(); };
  };

  private updateRecovery() {
    if (this.failure && this.entries.length && !this.listeners.size && this.options.owner) {
      detached.set(this, { id: this.id, owner: this.options.owner, failure: this.failure, retry: () => this.retry(), discard: () => this.discard() });
    } else if (!detached.delete(this)) return;
    recoverySnapshot = [...detached.values()];
    recoveryListeners.forEach(listener => listener());
  }

  private publish() {
    this.state = {
      // An uncertain response keeps the intended view. A known conflict or
      // rejection shows saved data while retaining intentions for review.
      snapshot: this.failure && this.failure.status !== "unknown"
        ? this.confirmed
        : this.entries.reduce((snapshot, entry) => this.options.reduce(snapshot, entry.input), this.confirmed),
      count: this.entries.length,
      phase: this.failure ? "failed" : this.entries.length ? "saving" : "idle",
      failure: this.failure,
      head: this.entries[0] ?? null,
      inputs: this.entries.map(entry => entry.input),
    };
    protect(this, this.entries.length > 0);
    this.updateRecovery();
    this.listeners.forEach(listener => listener());
  }

  enqueue(input: O, base?: S): Promise<S> {
    if (this.failure) return Promise.reject(this.failure);
    if (!this.entries.length && base !== undefined) this.confirmed = base;
    const captured = structuredClone(input);
    const promise = new Promise<S>((resolve, reject) => {
      this.entries.push({ input: captured, waiters: [{ resolve, reject }] });
    });
    this.publish();
    void this.drain();
    return promise;
  }

  private async drain() {
    if (this.running || this.failure) return;
    this.running = true;
    try {
      while (this.entries.length && !this.failure) {
        const entry = this.entries[0];
        try {
          // On an ambiguous failure, retry this exact command/operation ID.
          entry.command ??= this.options.prepare(this.confirmed, entry.input);
          this.publish();
          const saved = await this.options.save(entry.command);
          this.confirmed = saved;
          this.entries.shift();
          this.publish();
          entry.waiters.forEach(waiter => waiter.resolve(saved));
        } catch (error) {
          this.failure = error instanceof BackgroundSaveError
            ? error as BackgroundSaveError<S>
            : new BackgroundSaveError("Could not confirm the save. Retry to check it safely.");
          if (this.failure.snapshot !== undefined) this.confirmed = this.failure.snapshot;
          // Stop subsequent writes; sending them at an uncertain revision could
          // overwrite or duplicate an earlier operation.
          for (const queued of this.entries) {
            queued.waiters.forEach(waiter => waiter.reject(this.failure!));
            queued.waiters = [];
          }
          this.publish();
        }
      }
    } finally {
      this.running = false;
    }
  }

  retry(): Promise<S> {
    if (!this.entries.length) return Promise.resolve(this.confirmed);
    if (this.running) return this.flush();
    if (this.failure?.status === "conflict") return Promise.reject(this.failure);
    this.failure = null;
    const promise = this.flush();
    this.publish();
    void this.drain();
    return promise;
  }

  flush(): Promise<S> {
    if (this.failure) return Promise.reject(this.failure);
    const last = this.entries.at(-1);
    if (!last) return Promise.resolve(this.confirmed);
    return new Promise<S>((resolve, reject) => last.waiters.push({ resolve, reject }));
  }

  discard(): boolean {
    // A missing response might already have committed. Never abandon its ID.
    if (this.running || !this.failure || this.failure.status === "unknown") return false;
    this.entries = [];
    this.failure = null;
    this.publish();
    return true;
  }
}
