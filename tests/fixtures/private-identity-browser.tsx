import { createRoot } from "react-dom/client";
import { useState } from "react";
import Boundary from "../../app/components/shared/account/PrivateIdentityBoundary";
import { authClient } from "../../lib/auth-client";

function Finance() {
  const [draft, setDraft] = useState("");
  return <section><h2>Alice Finance</h2><p>Saved expense: 123.45 USD</p>
    <label>Unsaved draft <input value={draft} onChange={event => setDraft(event.target.value)} /></label>
  </section>;
}
function App() {
  const session = authClient.useSession();
  async function state(value: object) {
    await fetch("/fixture/state", { method: "POST", body: JSON.stringify(value) });
  }
  return <main><h1>Isolated private identity browser regression</h1>
    <p>Synthetic users only. No application database or provider connection.</p>
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
createRoot(document.getElementById("root")!).render(<App />);
