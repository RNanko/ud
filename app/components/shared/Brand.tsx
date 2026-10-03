import { brand } from "@/lib/brand";
export default function Brand({ compact = false }: { compact?: boolean }) {
  return <span className="inline-flex flex-col leading-none" aria-label={`${brand.productName}, ${brand.brandLine}`}>
    <span aria-hidden="true" className={`${compact ? "text-lg sm:text-2xl" : "text-2xl"} font-extrabold tracking-tight text-primary-plus`}>{brand.wordmark}</span>
    <span aria-hidden="true" className="mt-1.5 text-[10px] tracking-[.12em] text-muted-foreground">{brand.brandLine}</span>
  </span>;
}
