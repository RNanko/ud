"use client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { redirect } from "next/navigation";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { PasswordInput } from "@/components/ui/password-input";
import { LoadingSwap } from "@/components/ui/loading-swap";
import Link from "next/link";

const regSchema = z
  .object({
    name: z.string().min(4, "Name is required"),
    email: z.email("Invalid email"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z
      .string()
      .min(8, "Confirm password must be at least 8 characters"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Password don't match",
    path: ["confirmPassword"],
  });

type regForm = z.infer<typeof regSchema>;

export default function RegistrationForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const form = useForm<regForm>({
    resolver: zodResolver(regSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const { isSubmitting } = form.formState;

  async function handleReg(data: regForm) {
    authClient.signUp.email(
      { ...data, callbackURL: "/account" },
      {
        onError: (error) => {
          toast.error(error.error.message || "Failed to create account");
        },
        onSuccess: () => redirect("/account"),
      }
    );
    await new Promise((r) => setTimeout(r, 1500));
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Create your account</CardTitle>
          <CardDescription>
            Enter your email below to create your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form className="space-y-5" onSubmit={form.handleSubmit(handleReg)}>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => {
                  return (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      {/* <FormMessage /> */}
                    </FormItem>
                  );
                }}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="relative">
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage className="absolute right-10 top-[-4] text-red-300 text-sm" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => {
                  return (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <PasswordInput {...field} />
                      </FormControl>
                      <FieldDescription>
                        Must be at least 8 characters long.
                      </FieldDescription>
                    </FormItem>
                  );
                }}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => {
                  return (
                    <FormItem>
                      <FormLabel>Confirm Password</FormLabel>
                      <FormControl>
                        <PasswordInput {...field} />
                      </FormControl>
                    </FormItem>
                  );
                }}
              />

              <div className="flex-center">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-[30%]"
                >
                  <LoadingSwap isLoading={isSubmitting}>Sign Up</LoadingSwap>
                </Button>
              </div>
              <FieldDescription className="text-center">
                Already have an account? <Link href="/auth/login">Login</Link>
              </FieldDescription>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
