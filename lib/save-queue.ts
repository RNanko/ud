// Serialize snapshots so a slower, older save cannot overwrite a newer edit.
export function createSaveQueue<T>(save: (data: T) => Promise<unknown>) {
  let pending: Promise<void> = Promise.resolve();
  let lastError: unknown;
  return {
    enqueue(data: T) {
      const job = pending.then(() => save(data));
      pending = job.then(
        () => { lastError = undefined; },
        (error) => { lastError = error; },
      );
      return job;
    },
    async flush() {
      await pending;
      if (lastError) throw lastError;
    },
  };
}
