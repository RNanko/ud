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
    redirectLinkRaw && redirectLinkRaw.startsWith("/") ? redirectLinkRaw : "/";

  console.log(redirectLinkRaw);

  useEffect(() => {
    authClient.getSession().then((session) => {
      if (session.data) {
        router.replace(redirectLink);
      }
    });
  }, [router, redirectLink]);

  return (
    <div className="flex flex-col items-center justify-start gap-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col">
        <LoginForm redirectLink={redirectLink}/>
      </div>
    </div>
  );
}

// redirect
