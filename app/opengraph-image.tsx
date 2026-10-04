import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { brand } from "@/lib/brand";

export const alt = "ManForth by B1-Way — Plan your week. Record your work. Review your progress.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Build-time, local artwork only. Satori needs PNG/JPEG; sharp is Next's installed image engine.
const artwork = await readFile(join(process.cwd(), "public/manforth/finance-1100.webp"));
const png = await sharp(artwork).resize(900).png({ palette: true, colours: 128 }).toBuffer();

export default async function SocialImage() {
  const rendered = new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", background: "#09090b", color: "#fafafa", position: "relative", fontFamily: "sans-serif" }}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={`data:image/png;base64,${png.toString("base64")}`} alt="" width={1200} height={630} style={{ position: "absolute", left: 0, top: 0, objectFit: "cover", opacity: 0.8 }} />
    <div style={{ display: "flex", position: "absolute", left: 0, top: 0, width: 1200, height: 630, backgroundImage: "linear-gradient(90deg, rgba(9,9,11,1) 0%, rgba(9,9,11,0.94) 38%, rgba(9,9,11,0.15) 100%)" }} />
    <div style={{ display: "flex", flexDirection: "column", padding: "50px 58px", width: "100%", height: "100%", position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}><div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 76, height: 76, borderRadius: 20, border: "2px solid #38bdf8", color: "#38bdf8", fontSize: 34, fontWeight: 700 }}>MF</div><div style={{ display: "flex", flexDirection: "column" }}><span style={{ color: "#38bdf8", fontSize: 32, fontWeight: 700 }}>{brand.wordmark}</span><span style={{ color: "#bbc4d2", fontSize: 18 }}>{brand.brandLine}</span></div></div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 62, fontSize: 58, fontWeight: 700, lineHeight: 1.15 }}><span>Plan your week.</span><span>Record your work.</span><span style={{ color: "#38bdf8" }}>Review your progress.</span></div>
      <div style={{ display: "flex", gap: 15, fontSize: 21, marginTop: 32, color: "#d8dee8" }}><span>Training</span><span style={{ color: "#fb923c" }}>·</span><span>Tasks</span><span style={{ color: "#fb923c" }}>·</span><span>Money</span><span style={{ color: "#fb923c" }}>·</span><span>Goals</span></div>
    </div>
  </div>, size);
  const optimized = await sharp(Buffer.from(await rendered.arrayBuffer())).png({ palette: true, colours: 128, compressionLevel: 9 }).toBuffer();
  return new Response(new Uint8Array(optimized), { headers: { "Content-Type": contentType } });
}
