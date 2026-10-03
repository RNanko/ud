// Injectable timer keeps cancellation and exactly-once completion testable.
export function createHoldConfirm(schedule: (complete: () => void, duration: number) => () => void, complete: () => void, duration = 1200) {
  let cancelTimer: (() => void) | null = null;
  let active = false;
  let generation = 0;
  return {
    start() {
      if (active) return false;
      active = true;
      const current = ++generation;
      cancelTimer = schedule(() => {
        if (!active || generation !== current) return;
        active = false;
        cancelTimer = null;
        complete();
      }, duration);
      return true;
    },
    cancel() { active = false; generation++; cancelTimer?.(); cancelTimer = null; },
  };
}
