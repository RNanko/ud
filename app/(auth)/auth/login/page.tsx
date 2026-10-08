import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { AuthSessionLoading } from "@/app/components/shared/account/SignedOutBoundary";

// The auth layout waits for a session before showing a guest form.
export const instant = false;

async function Login({ searchParams }: { searchParams: Promise<{ redirect?: string }> }) {
  const redirectLinkRaw = (await searchParams).redirect;
  const redirectLink =
    redirectLinkRaw && redirectLinkRaw.startsWith("/") && !redirectLinkRaw.startsWith("//") && !redirectLinkRaw.includes("\\")
      ? redirectLinkRaw : "/account";

  return (
    <div className="auth-page"><LoginForm redirectLink={redirectLink}/></div>
  );
}

export default function LoginPage({ searchParams }: { searchParams: Promise<{ redirect?: string }> }) {
  return <Suspense fallback={<AuthSessionLoading/>}><Login searchParams={searchParams}/></Suspense>;
}
