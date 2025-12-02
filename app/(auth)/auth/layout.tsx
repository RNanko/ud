// app/layout.tsx
import Header from "@/components/shared/layouts/header";
import LightRays from "@/components/ui/LightRays";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  

  return (
    <div className="relative min-h-screen flex flex-col">
      <LightRays className="inset-0 z-0" />
      <Header />
      <main className="relative z-10 ">{children}</main>
    </div>
  );
}
