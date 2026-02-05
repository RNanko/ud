import Loader from "@/components/shared/loader";
import GetAccountData from "@/lib/actions/account.actions";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { Suspense } from "react";
import AvatarSection from "./AvatarSection";

export default function Page() {
  return (
    <Suspense fallback={<Loader />}>
      <Account />
    </Suspense>
  );
}

async function Account() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const userId = session?.session?.userId;
  if (!userId) {
    return <div>Not authenticated</div>;
  }

  const user = await GetAccountData(userId);

  if (!user) {
    return <div>User not found</div>;
  }

  return (
    <section className="w-full flex flex-col lg:flex-row justify-around gap-10">
      <div className="flex gap-10">
        <AvatarSection image={user.image ?? undefined} />

        <div></div>
      </div>

      <div>
        <h2>Table</h2>
        <h2>Quote</h2>
        <h2>Goals</h2>
        <h2>To-Do</h2>
      </div>
    </section>
  );
}
