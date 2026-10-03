"use client";

import { useEffect, useRef, useState } from "react";
import { saveGymSession } from "@/lib/actions/gym.actions";
import { createSaveQueue } from "@/lib/save-queue";
import type { SaveState, SessionData, SessionRecord } from "@/lib/gym/types";
import { sessionSchema } from "@/lib/gym/validation";
type Job = {
  data: SessionData;
  mutationId: string;
};
export function useGymSession(initial: SessionRecord, onSaved: (record: SessionRecord) => void) {
  const [data, setData] = useState(initial.data),
    [state, setState] = useState<SaveState>("saved"),
    [error, setError] = useState("");
  const latest = useRef(initial.data),
    saved = useRef(initial.data),
    revision = useRef(initial.revision),
    failed = useRef<Job | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    callback = useRef(onSaved);
  useEffect(() => {
    callback.current = onSaved;
  }, [onSaved]);
  // The queue invokes this callback after an edit, never during lazy initialization.
  // eslint-disable-next-line react-hooks/refs
  const [queue] = useState(() => createSaveQueue<Job>(async job => {
    const send = async (command: Job) => {
      const result = await saveGymSession({
        id: initial.id,
        revision: revision.current,
        ...command
      });
      if (!result.success) throw new Error(result.message);
      revision.current = result.session.revision;
      saved.current = command.data;
      callback.current(result.session);
    };
    try {
      // Replay a failed command before sending later edits. The server recognizes its mutation ID.
      if (failed.current && failed.current.mutationId !== job.mutationId) {
        await send(failed.current);
        failed.current = null;
      }
      failed.current = job;
      await send(job);
      failed.current = null;
      setError("");
      if (latest.current === job.data) setState("saved");
    } catch (reason) {
      setState("failed");
      setError(reason instanceof Error ? reason.message : "Save failed — retry");
      throw reason;
    }
  }));
  const enqueue = (value: SessionData) => {
    const checked = sessionSchema.safeParse(value);
    if (!checked.success) {
      const reason = new Error(checked.error.issues[0].message);
      setState("failed");
      setError(reason.message);
      return Promise.reject(reason);
    }
    setState("saving");
    return queue.enqueue({
      data: value,
      mutationId: crypto.randomUUID()
    });
  };
  const update = (value: SessionData | ((current: SessionData) => SessionData)) => {
    const next = typeof value === "function" ? value(latest.current) : value;
    latest.current = next;
    setData(next);
    setState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      void enqueue(latest.current).catch(() => undefined);
    }, 650);
  };
  const flush = async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    await queue.flush().catch(() => undefined);
    if (failed.current) {
      setState("saving");
      await queue.enqueue(failed.current);
    }
    if (latest.current !== saved.current) await enqueue(latest.current);
    await queue.flush();
  };
  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => {
      if (latest.current !== saved.current || failed.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", protect);
    return () => {
      window.removeEventListener("beforeunload", protect);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  return {
    data,
    state,
    error,
    update,
    flush
  };
}
