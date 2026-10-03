"use client";
import { useAccountCalendar } from "@/hooks/use-account-calendar";
import WeekNavigatorView from "./WeekNavigatorView";
export default function WeekNavigator({selected,today,onSelect}:{selected:string;today:string;onSelect:(date:string)=>void}) {
 const calendar=useAccountCalendar();
 return <WeekNavigatorView selected={selected} today={today} onSelect={onSelect} startsOn={calendar.startsOn} label={calendar.dateLabel}/>;
}
