import { notFound } from "next/navigation";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { getQuote } from "@/lib/actions/quotes.actions";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowBigLeft } from "lucide-react";

export default async function Page({ params }: { params: { id: string } }) {
  const { id } = await params;

  const quote = await getQuote(id);

  if (!quote) notFound();

  return (
    <section className="relative">
      <Button variant={"ghost"} asChild className="absolute left-5">
        <Link href="./">
          <ArrowBigLeft /> Back
        </Link>
      </Button>
      <div className="flex flex-col justify-center items-center">
        <Card className="p-4 h-fit">
          <CardContent className="italic text-lg">“{quote.quote}”</CardContent>
          <CardFooter className="justify-end text-xl text-muted-foreground">
            — {quote.author}
          </CardFooter>
        </Card>
      </div>
    </section>
  );
}
