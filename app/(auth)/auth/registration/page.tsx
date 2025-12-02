"use client"

import { useRouter } from "next/navigation";
import RegistrationForm from "./reg-form";
import { useEffect } from "react";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  useEffect(() => {
    authClient.getSession().then((session) => {
      if (session.data != null) router.push("/");
    });
  }, [router]);
  return (
    <div className="flex flex-col items-center justify-start gap-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col">
        <RegistrationForm />
      </div>
    </div>
  );
}
