import { Suspense } from "react";
import LegalReader from "@/app/components/legal/LegalReader";
export { metadata } from "../page";
async function Version({ params }: { params: Promise<{ version: string }> }) {
  return <LegalReader kind="terms" version={(await params).version} />;
}
export default function Page(props: { params: Promise<{ version: string }> }) {
  return (
    <Suspense
      fallback={
        <p className="p-8" role="status">
          Loading terms version…
        </p>
      }
    >
      <Version {...props} />
    </Suspense>
  );
}
