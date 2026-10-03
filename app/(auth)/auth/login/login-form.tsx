"use client";
import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { Field,GymButton } from "@/app/(main)/account/gym/GymUI";
import { PasswordInput } from "@/app/components/ui/password-input";
export function LoginForm({className,redirectLink,...props}:React.ComponentProps<"div">&{redirectLink?:string}){
 const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const target=redirectLink?.startsWith("/")&&!redirectLink.startsWith("//")?redirectLink:"/account";
 return <div className={cn("gym-scope account-settings-panel",className)} {...props}><form className="space-y-5" onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setError("");try{const result=await authClient.signIn.email({email,password});if(result.error)throw new Error("Email or password could not be verified. Use recovery if you need to set a password.");window.location.assign(target);}catch(e){setError(e instanceof Error?e.message:"Sign in failed — retry");}finally{setBusy(false);}}}><h1 className="text-2xl font-semibold">Welcome back</h1><p className="text-sm text-muted-foreground">Sign in with your email and password.</p><Field label="Email" type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/><label className="grid gap-2 text-sm font-medium">Password<PasswordInput required autoComplete="current-password" maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/></label><GymButton tone="blue" type="submit" disabled={busy}>{busy?"Signing in…":"Sign in"}</GymButton>{error&&<p role="alert" className="gym-error text-sm">{error}</p>}<p className="text-sm"><Link className="underline" href="/auth/forgot-password">Forgot password / previously used social login</Link></p><p className="text-sm">New here? <Link className="underline" href="/auth/registration">Verify email & create account</Link></p></form></div>;
}
