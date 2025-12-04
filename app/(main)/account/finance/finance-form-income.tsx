"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addIncome } from "@/lib/actions/finance.actions";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { motion } from "framer-motion";

export default function FinanceFormIncome() {
  const [data, action] = useActionState(addIncome, {
    success: false,
    message: "",
  });

  const SubmitButton = () => {
    const { pending } = useFormStatus();
    return (
      <div className="flex-center">
        <Button
          disabled={pending}
          className="w-1/2 hover:ring-2 hover:ring-offset-foreground"
        >
          {pending ? "Saving..." : "Save Expense"}
        </Button>
      </div>
    );
  };

  return (
    <form action={action}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0, transition: { duration: 1 } }}
        className="flex justify-center items-start w-full"
      >
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Your Income</CardTitle>
            <CardDescription>Track when your get money.</CardDescription>
          </CardHeader>

          <CardContent className="grid gap-3">
            <div className="grid gap-3">
              <Label htmlFor="date">Date</Label>
              <Input type="date" name="date" required />
            </div>

            <div className="grid gap-3">
              <Label htmlFor="category">Category</Label>
              <Input type="text" name="category" required />
            </div>

            <div className="grid gap-3">
              <Label htmlFor="subcategory">Sub Category</Label>
              <Input type="text" name="subcategory" required />
            </div>

            <div className="grid gap-3">
              <Label htmlFor="amount">Amount</Label>
              <Input type="number" name="amount" required />
            </div>

            <div className="grid gap-3">
              <Label htmlFor="comment">Comment</Label>
              <Input type="text" name="comment" />
            </div>

            <SubmitButton />
          </CardContent>
          {data && !data.success && (
            <div className="text-center text-destructive">{data.message}</div>
          )}
        </Card>
      </motion.div>
    </form>
  );
}
