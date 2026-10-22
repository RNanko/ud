export function notifyScheduleChange() {
  window.dispatchEvent(new Event("event-schedules-changed"));
  try { localStorage.setItem("event-schedules-signal", `${Date.now()}:${crypto.randomUUID()}`); } catch { /* Same-tab updates still work when storage is unavailable. */ }
}
