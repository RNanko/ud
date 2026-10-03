"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import { MotionConfig } from "framer-motion";
import { defaultPreferences, defaultNotifications, type AccountPreferences, type NotificationPreferences } from "@/lib/account/preferences";
export type SettingsSnapshot={preferences:AccountPreferences;notifications:NotificationPreferences;revision:number};
const initial:SettingsSnapshot={preferences:defaultPreferences,notifications:defaultNotifications,revision:0};
const Context=createContext({settings:initial,replace:((next:SettingsSnapshot)=>{void next;})});
export function useAccountPreferences(){return useContext(Context);}
export default function AccountPreferencesProvider({initial,children}:{initial:SettingsSnapshot;children:ReactNode}){
 const [settings,replace]=useState(initial);
 return <Context.Provider value={{settings,replace}}><MotionConfig reducedMotion={settings.preferences.reducedMotion==="reduce"?"always":"user"}><div data-reduced-motion={settings.preferences.reducedMotion} data-account-locale={settings.preferences.numberLocale}>{children}</div></MotionConfig></Context.Provider>;
}
