import z from "zod";
import {defaultPreferences} from "./preferences";

// Calendar dates are kept as YYYY-MM-DD strings, never converted to an instant.
export function registrationToday(now=new Date()) {
 return new Intl.DateTimeFormat("en-CA",{timeZone:defaultPreferences.timezone,year:"numeric",month:"2-digit",day:"2-digit"}).format(now);
}
export const dateOfBirthSchema=z.iso.date({error:"Enter a valid date of birth."})
 .refine(value=>value>="0001-01-01"&&value<=registrationToday(),"Date of birth cannot be in the future.");
