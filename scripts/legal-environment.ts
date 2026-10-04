import { loadEnvConfig } from "@next/env";

// Load before draft/config modules evaluate their module-level offer snapshot.
export const { loadedEnvFiles } = loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
