"use client";

const channelName = "manforth-session-changed";

// Invalidation only: receivers must ask Better Auth for the identity. No user,
// token or private state is trusted from another tab.
export function announceSessionChange() {
  if (typeof window === "undefined") return;
  if (typeof BroadcastChannel !== "undefined") {
    try {
      const channel = new BroadcastChannel(channelName);
      channel.postMessage("revalidate");
      channel.close();
      return;
    } catch { /* Fall back when a browser blocks the channel. */ }
  }
  try { localStorage.setItem(channelName, crypto.randomUUID()); } catch { /* Poll/focus remains available. */ }
}

export function subscribeSessionChange(revalidate: () => void) {
  let channel: BroadcastChannel | null = null;
  try { if (typeof BroadcastChannel !== "undefined") channel = new BroadcastChannel(channelName); } catch { /* Storage/poll/focus remains available. */ }
  if (channel) channel.onmessage = revalidate;
  const storage = (event: StorageEvent) => { if (event.key === channelName) revalidate(); };
  window.addEventListener("storage", storage);
  return () => { channel?.close(); window.removeEventListener("storage", storage); };
}
