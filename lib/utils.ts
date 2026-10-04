import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { publicErrorMessage } from "./account/errors";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function formatError(error: unknown) {
  return publicErrorMessage(error);
}

export function getCurrentWeekYear() {
  const now = new Date();

  // Copy date & reset time
  const date = new Date(Date.UTC(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ));

  // ISO week: Thursday determines the year
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);

  const year = date.getUTCFullYear();

  // First week of year
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const currentWeek = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

  return { year, currentWeek };
}
