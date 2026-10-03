"use client";
import { useState } from "react";
import { catalogueAssets } from "@/lib/gym/catalogue";
import type { ExerciseDefinition } from "@/lib/gym/types";
import { Field, GymButton, GymDialog } from "./GymUI";
import CatalogueIcon from "./CatalogueIcon";
import GymSafety from "./GymSafety";

export default function CatalogueGallery({exercises, onBuild}: {exercises: ExerciseDefinition[]; onBuild: (definition: ExerciseDefinition) => void}) {
  const [kind, setKind] = useState("exercise"), [query, setQuery] = useState(""), [page, setPage] = useState(0), [detail, setDetail] = useState<typeof catalogueAssets[number] | null>(null);
  const found = catalogueAssets.filter(asset => asset.type === kind && asset.name.toLowerCase().includes(query.toLowerCase()));
  const pages = Math.max(1, Math.ceil(found.length / 36));
  return <section className="space-y-4 rounded-3xl border border-border bg-card/20 p-4 sm:p-5" aria-label="Complete exercise and equipment catalogue">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Explore exercises & equipment</h2><p className="mt-1 text-sm text-muted-foreground">714 movements · 171 equipment items</p></div><div className="flex gap-2"><GymButton tone={kind === "exercise" ? "blue" : "neutral"} aria-pressed={kind === "exercise"} onClick={() => {setKind("exercise"); setPage(0);}}>Exercises</GymButton><GymButton tone={kind === "equipment" ? "blue" : "neutral"} aria-pressed={kind === "equipment"} onClick={() => {setKind("equipment"); setPage(0);}}>Equipment</GymButton></div></div>
    <Field label={`Search ${kind === "exercise" ? "exercise" : "equipment"} illustrations`} value={query} placeholder="Search by name" onChange={event => {setQuery(event.target.value); setPage(0);}} />
    <p className="text-xs text-muted-foreground">Illustrations for identification, not technique instructions. Only configured exercises can be added directly to a workout. Equipment items are never logged as exercises.</p>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{found.slice(page * 36, (page + 1) * 36).map(asset => <button type="button" key={asset.id} onClick={() => setDetail(asset)} className="gym-tile gym-button flex min-w-0 flex-col items-center gap-2 rounded-2xl border border-border bg-background p-3 text-center focus-visible:ring-2 focus-visible:ring-ring" aria-label={`View ${asset.name}`}>
      <CatalogueIcon id={asset.id} size={112} /><span className="text-sm font-semibold">{asset.name}</span><span className="text-xs text-muted-foreground">{asset.type === "equipment" ? "Equipment" : "Exercise"} · preview</span>
    </button>)}</div>
    {!found.length && <p className="rounded-2xl border border-dashed p-5">No matching illustrations.</p>}
    <div className="flex flex-wrap items-center justify-between gap-2"><GymButton disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</GymButton><span role="status" className="text-sm text-muted-foreground">{found.length} matches · page {page + 1} of {pages}</span><GymButton disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</GymButton></div>
    {detail && <GymDialog open title={detail.name} description={detail.type === "equipment" ? "Hardware illustration — separate from exercise records." : "Unreviewed movement illustration. Ask a trainer about setup and suitability."} onClose={() => setDetail(null)}>
      <div className="mx-auto"><CatalogueIcon id={detail.id} size={160} /></div><GymSafety compact />
      {detail.type === "exercise" && <><p className="text-sm">Tracking: {detail.tracking?.replaceAll("_", " ")}</p><p className="text-sm text-muted-foreground">{detail.flags}</p>{exercises.find(exercise => exercise.catalogueId === detail.id) ? <GymButton tone="blue" onClick={() => {onBuild(exercises.find(exercise => exercise.catalogueId === detail.id)!); setDetail(null);}}>Build with this exercise</GymButton> : <p className="text-sm text-muted-foreground">Browsing only. This movement has no configured logging form in this release. You can create a custom exercise after reviewing its tracking needs with a trainer.</p>}</>}
      {detail.equipmentIds.length > 0 && <div><h3 className="mb-2 font-semibold">Illustrated equipment</h3><div className="flex flex-wrap gap-2">{detail.equipmentIds.map(id => {const equipment = catalogueAssets.find(item => item.id === id); return <div key={id} className="flex max-w-full items-center gap-2 rounded-xl border p-2"><CatalogueIcon id={id} size={48} /><span className="text-xs">{equipment?.name || "Equipment"}</span></div>;})}</div></div>}
    </GymDialog>}
  </section>;
}
