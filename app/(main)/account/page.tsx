import AccProfile from "@/components/shared/account/acc-profile";
import Loader from "@/components/shared/loader";

import GetAccountData from "@/lib/actions/account.actions";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { Suspense } from "react";

export default function Page() {
  return (
    <Suspense fallback={<Loader />}>
      <Account />
    </Suspense>
  );
}

async function Account() {
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
    w-full
    flex flex-col justify-between 
    gap-5
    lg:flex-row lg:justify-between
  "
    >
      {/* MAIN CONTENT */}

      <div>
        <div>
          <AccProfile user={user} />
          <p>
            Lorem ipsum dolor sit amet, consectetur adipisicing elit. Obcaecati,
            quae odit quaerat enim hic similique, deleniti vel praesentium,
            iusto blanditiis a officia sit nemo officiis corporis sunt illo
            facilis dolores!
          </p>
        </div>
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
        <p>
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Officia vitae
          numquam, sit, nobis quidem temporibus id voluptatum distinctio iste,
          quisquam aut?
        </p>
        <p>
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Officia vitae
          numquam, sit, nobis quidem temporibus id voluptatum distinctio iste,
          quisquam aut?
        </p>
      </div>
    </section>
  );
}
