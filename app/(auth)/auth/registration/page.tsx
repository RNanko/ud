"use client"

import { useRouter } from "next/navigation";
import RegistrationForm from "./reg-form";
import { useEffect } from "react";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  useEffect(() => {
    authClient.getSession().then((session) => {
      if (session.data != null) router.push("/account?section=membership");
    });
  }, [router]);
  return (
    <div className="auth-page"><RegistrationForm /></div>
  );
}
