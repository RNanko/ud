import AccProfile from "@/components/shared/account/acc-profile";
import AccSidebar from "@/components/shared/account/acc-sidebar";
import GetAccountData from "@/lib/actions/account.actions";
import { auth } from "@/lib/auth"; // <-- IMPORTANT
import { headers } from "next/headers";

export default async function Account() {
  // SERVER-SIDE session
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const userId = session?.session?.userId;

  // Fetch DB data
  const user = await GetAccountData(userId!);

  return (
    <section
      className="
        flex flex-col gap-6 mx-10
        md:grid md:grid-cols-[220px_1fr_1fr] md:gap-10
      "
    >
      {/* LEFT NAVIGATION */}
      <AccSidebar />

      {/* MAIN CONTENT */}
      <div className="flex-center">
        <AccProfile user={user} />
      </div>

      {/* RIGHT COLUMN */}
      <div className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Table</h2>
        <p>{userId}</p>
        <p>
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Officia vitae
          numquam, sit, nobis quidem temporibus id voluptatum distinctio iste,
          quisquam aut?
        </p>
      </div>
    </section>
  );
}
