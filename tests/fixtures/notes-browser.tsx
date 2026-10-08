import { createRoot } from "react-dom/client";
import { useCallback, useEffect, useRef, useState } from "react";
import AccountPreferencesProvider from "../../app/components/shared/account/AccountPreferencesProvider";
import PrivateIdentityBoundary from "../../app/components/shared/account/PrivateIdentityBoundary";
import NotesClient from "../../app/(main)/account/notes/NotesClient";
import { defaultNotifications, defaultPreferences } from "../../lib/account/preferences";
import SessionProvider, { useAuthSession } from "../../app/components/shared/account/SessionProvider";
import type { NotesCommand, NotesSnapshot } from "../../lib/notes";

function App() {
  const [initial, setInitial] = useState<NotesSnapshot | null>(null);
  const fault = useRef({ lose: false, slow: false });
  const session = useAuthSession();
  useEffect(() => { void fetch("/fixture/notes").then(response => response.json()).then(setInitial); }, []);
  async function control(value: { loseNext?: boolean; slowNext?: boolean; changeFirst?: boolean; loggedOut?: boolean }) {
    if (value.loseNext) { fault.current.lose = true; return; }
    if (value.slowNext) { fault.current.slow = true; return; }
    await fetch("/fixture/control", { method: "POST", body: JSON.stringify(value) });
  }
  const commit = useCallback(async (command: NotesCommand) => {
    const lose = fault.current.lose, slow = fault.current.slow;
    fault.current = { lose: false, slow: false };
    const response = await fetch("/fixture/commit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(command) });
    if (!response.ok) throw Error("Synthetic transport failure");
    const result = await response.json();
    if (slow) await new Promise(resolve => setTimeout(resolve, 2500));
    // Lose the acknowledgement after the actual SQL commit, independently of
    // browser/network automatic retries. The application sees an unknown outcome.
    if (lose) throw Error("Synthetic lost postcommit response");
    return result;
  }, []);
  return <AccountPreferencesProvider initial={{ preferences: { ...defaultPreferences, timezone: "Europe/Warsaw" }, notifications: defaultNotifications, revision: 0 }}>
    <div className="mx-auto max-w-6xl p-4 sm:p-8">
      <details className="mb-6 rounded-xl border p-3 text-xs"><summary>Isolated Notes QA controls</summary><div className="mt-2 flex flex-wrap gap-3">
        <button onClick={() => control({ loseNext: true })}>Lose next save response</button>
        <button onClick={() => control({ slowNext: true })}>Slow next save</button>
        <button onClick={() => control({ changeFirst: true })}>Change first note elsewhere</button>
        <button onClick={async () => { await control({ loggedOut: true }); await session.refetch(); }}>Confirm logout</button>
        <button onClick={async () => { await control({ loggedOut: false }); location.reload(); }}>Restore fixture session</button>
      </div></details>
      <PrivateIdentityBoundary owner="notes-browser-owner">{initial ? <NotesClient initial={initial} commit={commit} /> : <p>Loading isolated notes…</p>}</PrivateIdentityBoundary>
    </div>
  </AccountPreferencesProvider>;
}
createRoot(document.getElementById("root")!).render(<SessionProvider><App /></SessionProvider>);
