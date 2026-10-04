import z from "zod";
import {defaultPreferences} from "./preferences";

// Calendar dates are kept as YYYY-MM-DD strings, never converted to an instant.
export function registrationToday(now=new Date()) {
 return new Intl.DateTimeFormat("en-CA",{timeZone:defaultPreferences.timezone,year:"numeric",month:"2-digit",day:"2-digit"}).format(now);
}
export const dateOfBirthSchema=z.iso.date({error:"Enter a valid date of birth."})
 .refine(value=>value>="0001-01-01"&&value<=registrationToday(),"Date of birth cannot be in the future.");

export function birthDateInputValue(value: string) {
 const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
 return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
}
export function birthDateFromInput(value: string) {
 const text=value.trim(),match=/^(\d{2})[/.](\d{2})[/.](\d{4})$/.exec(text);
 const candidate=match ? `${match[3]}-${match[2]}-${match[1]}` : text;
 const parsed=dateOfBirthSchema.safeParse(candidate);
 return parsed.success ? parsed.data : "";
}
