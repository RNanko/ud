import Link from "next/link";
import { productAccess } from "@/lib/account/access";
export default async function AccountNotice({ owner }: { owner: string }) {
  let access;
  try {
    access = await productAccess(owner);
  } catch {
    console.error("Account notice unavailable; account controls remain accessible.");
    return <aside aria-label="Account notices" className="space-y-2 mb-5"><p role="status" className="rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">Membership status couldn&apos;t be loaded. Your account controls remain available. <Link className="text-primary underline underline-offset-4" href="/account?section=membership">Retry membership</Link></p></aside>;
  }
  return <aside aria-label="Account notices" className="space-y-2 mb-5">
    {(access.readOnly || access.state === "trial") && <p role="status" className="rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">{access.readOnly ? "Membership is read-only. Your saved records, settings and export remain available." : "Your trial is active. Membership choices are in Account & Settings."} <Link className="text-primary underline underline-offset-4" href="/account?section=membership">Manage membership</Link></p>}
  </aside>;
}
