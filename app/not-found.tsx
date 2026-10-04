import { Button } from "@/app/components/ui/button";
import Link from "next/link";

const NotFound = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-80">
      <div className="p-6 rounded-lg shadow-md text-center">
        <h1 className="text-3xl font-bold mb-4">Not Found</h1>
        <p className="text-muted-foreground">We could not find this page.</p>
        <Button
          variant={"outline"}
          className="mt-4 ml-2 cursor-pointer"
          asChild
        >
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
