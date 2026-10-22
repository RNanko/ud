"use client";
import {useState} from 'react';
import {Check,Search,Minus} from 'lucide-react';
import {Input} from '@/app/components/ui/input';
import {financeCategoryIcons,financeCategoryIcon} from '@/lib/finance-category-icons';
import FinanceCategoryIcon from './FinanceCategoryIcon';

export default function FinanceCategoryIconPicker({type,value,onChange,disabled=false}:{type:'+'|'-';value:string|null;onChange:(icon:string|null)=>void;disabled?:boolean}) {
 const [search,setSearch]=useState('');
 const kind=type==='+'?'revenue':'spending';
 const icons=financeCategoryIcons.filter(icon=>icon.kind===kind&&icon.label.toLowerCase().includes(search.trim().toLowerCase()));
 const selected=financeCategoryIcon(value);
 return <fieldset disabled={disabled} className="min-w-0 space-y-3">
  <legend className="mb-2 text-sm font-medium">Category icon <span className="font-normal text-muted-foreground">· optional</span></legend>
  <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5">
   {selected?<FinanceCategoryIcon icon={value} className="size-11"/>:<Minus className="m-2 size-7 text-muted-foreground"/>}
   <span className="flex-1 text-sm">{selected?.label??'No icon'}</span>
   {value&&<button type="button" onClick={()=>onChange(null)} className="min-h-11 px-2 text-xs text-muted-foreground hover:text-foreground">Clear</button>}
  </div>
  <div className="relative"><Search size={16} aria-hidden="true" className="absolute left-3 top-3.5 text-muted-foreground"/><Input aria-label="Search category icons" value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')e.preventDefault();}} placeholder={`Search ${kind} icons`} className="h-11 pl-9"/></div>
  <div role="group" aria-label={`${kind} icons`} className="grid max-h-52 grid-cols-5 gap-1.5 overflow-y-auto overscroll-contain rounded-xl border border-border bg-background p-2 sm:grid-cols-7">
   {icons.map(icon=><button key={icon.id} type="button" title={icon.label} aria-label={icon.label} aria-pressed={value===icon.id} onClick={()=>onChange(icon.id)} className={`relative flex min-h-14 cursor-pointer items-center justify-center rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 ${value===icon.id?'border-primary bg-primary/10':'border-transparent hover:border-border hover:bg-muted/50'}`}><FinanceCategoryIcon icon={icon.id} className="size-12"/>{value===icon.id&&<Check aria-hidden="true" size={12} className="absolute right-1 top-1 text-primary-plus"/>}</button>)}
   {!icons.length&&<p className="col-span-full p-4 text-center text-sm text-muted-foreground">No matching icons.</p>}
  </div>
 </fieldset>;
}
