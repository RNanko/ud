import { Suspense } from "react";
import Loader from "@/app/components/shared/loader";
import { getGymData } from "@/lib/actions/gym.actions";
import GymClient from "./GymClient";
async function Gym() {
  return <GymClient initial={await getGymData()} />;
}
export default function Page() {
  return <Suspense fallback={<Loader />}>
    <Gym />
  </Suspense>;
}
