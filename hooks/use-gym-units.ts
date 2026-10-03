"use client";
import { useAccountPreferences } from "@/app/components/shared/account/AccountPreferencesProvider";
import { saveAccountSettings } from "@/lib/actions/account.actions";
import { useState, useRef } from "react";
import type { Units } from "@/lib/gym/types";
export function useGymUnits(){
 const {settings,replace}=useAccountPreferences();
 const [state,setState]=useState<"saved"|"failed"|"loading"|"default">("saved");
 const units:Units={weight:settings.preferences.exerciseLoad,distance:settings.preferences.distance};
 const pending=useRef<Units|null>(null);
 const changeUnits=async(next:Units)=>{pending.current=next;setState("loading");try{replace(await saveAccountSettings({section:"preferences",revision:settings.revision,value:{...settings.preferences,exerciseLoad:next.weight,distance:next.distance}}));pending.current=null;setState("saved");}catch{setState("failed");}};
 return {units,changeUnits,state,retry:()=>changeUnits(pending.current??units)};
}
