import Footer from "@/app/components/shared/layouts/footer";
import Header from "@/app/components/shared/layouts/header";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col max-w-800 mx-auto">
      <Header />
      {children}
      <Footer />
    </div>
  );
}