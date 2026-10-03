"use client";
import { useAccountPreferences } from "@/app/components/shared/account/AccountPreferencesProvider";
import { useAccountCalendar } from "./use-account-calendar";
export function useAccountFormat() {
  const { settings } = useAccountPreferences(), calendar = useAccountCalendar();
  const formatter = new Intl.NumberFormat(settings.preferences.numberLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return { formatAmount: (value: string | number) => formatter.format(Number(value)), formatFinanceDate: calendar.dateLabel, investmentMoney:(value:number|null)=>value===null?"—":new Intl.NumberFormat(settings.preferences.numberLocale,{style:"currency",currency:"USD",minimumFractionDigits:2,maximumFractionDigits:Math.abs(value)>0&&Math.abs(value)<0.01?8:2}).format(value), investmentQuantity:(value:string)=>new Intl.NumberFormat(settings.preferences.numberLocale,{maximumFractionDigits:12}).format(Number(value)) };
}
