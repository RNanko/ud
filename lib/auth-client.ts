// lib/auth-client.ts
"use client";

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: "https://ud-9wucrm9el-rnankos-projects.vercel.app/"
});

