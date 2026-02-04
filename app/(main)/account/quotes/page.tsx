import { getQuotes } from "@/lib/actions/quotes.actions";
import QouteList from "./QouteList";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export default async function Page() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const userId = session!.session.userId;
  const quotes = await getQuotes(userId);

  return <QouteList quotes={quotes} />;
}
