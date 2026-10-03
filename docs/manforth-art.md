# ManForth landing artwork

The five landing carousel illustrations use the PNG attachments selected by the user. Only delivery resizing, mobile cropping and WebP encoding are applied. Original files are left untouched on the user's Desktop; no new images are generated and no original PNG masters are shipped to the browser.

| Landing scene | Attached source |
| --- | --- |
| Finance | `s-r.png` |
| Investments | `investment.png` |
| To-Do | `todo.png` |
| Events | `events.png` |
| Gym | `gym.png` |

The supplied artwork depicts futuristic workspaces, charts, task boards, calendars and training equipment. Existing HTML copy, buttons and blue/orange theme tokens remain in place. Images remain decorative with empty alternatives because the adjacent HTML supplies the product meaning. Painted interface details are illustration, not interactive controls or real account data.

## Measured delivery sizes

Exact on-disk bytes after WebP encoding:

| Scene | 1100 × 619 desktop | 1672 × 941 desktop | 700 × 875 mobile |
| --- | ---: | ---: | ---: |
| Finance | 186,478 | 346,586 | 138,908 |
| Investments | 182,006 | 333,532 | 133,072 |
| Todo | 168,736 | 306,428 | 112,082 |
| Events | 195,218 | 360,242 | 119,322 |
| Gym | 168,010 | 307,178 | 124,720 |
| Total by variant | 900,448 | 1,653,966 | 628,104 |

All 15 WebP derivatives total **3,182,518 bytes**. A phone initially loads only the Finance mobile crop (**138,908 bytes**), and the other scenes load on demand. Desktop derivatives stay below 400 KB; mobile derivatives stay below 200 KB. These are measured file sizes, not network or Core Web Vitals claims.

Desktop retains the full 16:9 source. Object positioning and the mobile 4:5 extraction use a 54% horizontal focal point to retain the central equipment/boards/globes. The existing dark overlay keeps the headline readable. Viewport-specific sources and the existing carousel loading/error/reduced-motion behavior are reused. No processing dependency is added to the client bundle.

`public/manforth/asset-manifest.json` records original filenames, dimensions, focal point, provenance and derivative bytes. The existing asset paths are replaced so all carousel views use the new illustrations.

## Reproduction

Use the existing build-time Sharp encoder:

```powershell
node scripts/prepare-manforth-art.mjs C:/Users/romas/Desktop
```

The supplied directory must contain the five filenames listed above. The script regenerates the WebP files and manifest, without modifying the source PNGs. Production needs only the delivery assets; the Desktop source directory is not required at runtime.
