import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function formatError(error: any) {
  if (error.name === "ZodError") {
    //Handle Zod error
    // const fieldErrors = Object.keys(error.errors).map(
    //   (f) => error.errors[f].message
    // );

    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fieldErrors = error.issues.map((issue: any) => issue.message);
    console.log(fieldErrors);
    return fieldErrors.join(". "); // "\r\n"
  } else {
    //Handle other errors
    return typeof error.message === "string"
      ? error.message
      : JSON.stringify(error.message);
  }
}
