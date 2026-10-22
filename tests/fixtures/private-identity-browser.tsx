import { createRoot } from "react-dom/client";
import { useState } from "react";
import Boundary from "../../app/components/shared/account/PrivateIdentityBoundary";
import { authClient } from "../../lib/auth-client";
import SessionProvider from "../../app/components/shared/account/SessionProvider";

function Finance() {
  const [draft, setDraft] = useState("");
  return <section className="mt-6 space-y-4 rounded-3xl border bg-card p-6"><h2 className="text-xl font-semibold">Alice Finance</h2><p className="text-sm text-muted-foreground">Saved expense: 123.45 USD</p>
    <label className="block space-y-2"><span>Unsaved draft</span><input className="block w-full max-w-md rounded-xl border bg-background px-4 py-3" value={draft} onChange={event => setDraft(event.target.value)} /></label>
  </section>;
}
function App() {
  const session = authClient.useSession();
  async function state(value: object) {
    await fetch("/fixture/state", { method: "POST", body: JSON.stringify(value) });
  }
  return <main className="gym-scope mx-auto max-w-4xl space-y-4 p-6"><h1 className="text-2xl font-semibold">Session refresh verification</h1>
    <p className="text-sm text-muted-foreground">Synthetic workspace. Session checks run every 15 minutes without hiding your draft.</p>
    <p role="status" className="text-sm text-primary-plus">{session.isRefetching ? "Session check in background" : "Session confirmed"}</p>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
      <button onClick={async () => { await state({ owner: "alice", failure: false }); location.reload(); }}>Reset Alice</button>
      <button onClick={async () => { await state({ failure: true }); await session.refetch(); }}>Network failure</button>
      <button onClick={async () => { await state({ failure: false }); await session.refetch(); }}>Revalidate session</button>
      <button onClick={() => authClient.signOut()}>Log out in this tab</button>
      <button onClick={() => authClient.signIn.email({ email: "bob@example.invalid", password: "synthetic-only" })}>Sign in Bob</button>
      <button onClick={async () => { await state({ expired: true }); await session.refetch(); }}>Expire session</button>
      <button onClick={async () => { await state({ hold: true }); void session.refetch(); }}>Hold old session response</button>
      <button onClick={() => state({ release: true })}>Release old session response</button>
    </div>
    <Boundary owner="alice"><Finance /></Boundary>
  </main>;
}
createRoot(document.getElementById("root")!).render(<SessionProvider><App /></SessionProvider>);
