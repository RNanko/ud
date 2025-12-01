import Link from "next/link";

export default function Footer() {
  return (
    <footer className="w-full border-t py-10">
      <div className="w-full max-w-6xl mx-auto px-5 grid grid-cols-1 sm:grid-cols-3 gap-10">
        <div className="flex flex-col gap-2">
          <Link href="/">Test</Link>
   
        </div>

        <div className="flex flex-col gap-2">
          <Link href="/">Test</Link>
          <Link href="/">Test</Link>
          <Link href="/">Test</Link>
        </div>

        <div className="flex flex-col gap-2">
          <Link href="/">Test</Link>
          <Link href="/">Test</Link>
        </div>
      </div>
    </footer>
  );
}
