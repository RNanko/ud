"use client";
import { useEffect } from "react";
import { LoginForm } from "./login-form";
import { authClient } from "@/lib/auth-client";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const params = useSearchParams();

  const redirectLinkRaw = params.get("redirect");
  const redirectLink =
    redirectLinkRaw && redirectLinkRaw.startsWith("/") && !redirectLinkRaw.startsWith("//") && !redirectLinkRaw.includes("\\")
      ? redirectLinkRaw : "/account";

  useEffect(() => {
    authClient.getSession().then((session) => {
      if (session.data) {
        router.replace(redirectLink);
      }
    });
  }, [router, redirectLink]);

  return (
    <div className="auth-page"><LoginForm redirectLink={redirectLink}/></div>
  );
}

// redirect
