import { Suspense } from "react";
import Loader from "@/app/components/shared/loader";
import { Finance } from "./Finance";
// The private workspace waits for a verified session before rendering this page.
export const instant = false;

export default function Page() {
  return (
    <Suspense fallback={<Loader />}>
      <Finance />
    </Suspense>
  );
}
