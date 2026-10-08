import RegistrationForm from "./reg-form";

// The auth layout waits for a session before showing a guest form.
export const instant = false;

export default function RegistrationPage() {
  return (
    <div className="auth-page"><RegistrationForm /></div>
  );
}
