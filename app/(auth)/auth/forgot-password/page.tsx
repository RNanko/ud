import RecoveryForm from "./RecoveryForm";
// The auth layout waits for a session before showing a guest form.
export const instant = false;
export default function Page() {
  return (
    <div className="auth-page">
      <RecoveryForm />
    </div>
  );
}
