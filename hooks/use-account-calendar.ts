"use client";
import { useMemo } from "react";
import { useAccountPreferences } from "@/app/components/shared/account/AccountPreferencesProvider";
import { dateInZone, dateLabel, weekStart, weekDates } from "@/lib/gym/dates";
import { formatAccountDate } from "@/lib/account/format";
export function useAccountCalendar(){
 const {settings}=useAccountPreferences(),{timezone,weekStart:start,dateFormat,timeFormat,numberLocale}=settings.preferences;
 return useMemo(()=>({timezone,startsOn:start,localDate:(date=new Date())=>dateInZone(date,timezone),browserTimezone:()=>timezone,weekStart:(date:string)=>weekStart(date,start),weekDates:(date:string)=>weekDates(date,start),dateLabel:(date:string,options?:Intl.DateTimeFormatOptions)=>options?dateLabel(date,options):formatAccountDate(date,{dateFormat}),hour12:timeFormat==="12",formatNumber:(value:number)=>new Intl.NumberFormat(numberLocale).format(value)}),[timezone,start,dateFormat,timeFormat,numberLocale]);
}
