"use server";

import db from "../db/drizzle";
import { eq } from "drizzle-orm";
import { user } from "@/lib/db/schema";
import { cacheTag, revalidatePath } from "next/cache";
import { v2 as cloudinary } from "cloudinary";
import { auth } from "../auth";
import { headers } from "next/headers";

export default async function GetAccountData(userId: string) {
  "use cache";

  cacheTag("account");
  // revalidateTag('account', 'max')
  // await new Promise((res) => setTimeout(res, 2000));
  if (!userId) {
    throw new Error("User not found");
  }

  const result = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      image: user.image,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  return result[0];
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

export async function uploadImage(image: File) {
  const imageData = await image.arrayBuffer();
  const mime = image.type;
  const encoding = "base64";

  const base64Data = Buffer.from(imageData).toString("base64");
  const fileUri = `data:${mime};${encoding},${base64Data}`;

  const result = await cloudinary.uploader.upload(fileUri, {
    folder: "ud-avatars",
  });

  return result.secure_url;
}

export async function updateAvatar(file: File) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const userId = session?.session?.userId;
  if (!userId) throw new Error("Unauthorized");

  // 1. Upload to Cloudinary
  const imageUrl = await uploadImage(file);

  // 2. Update DB
  await db.update(user).set({ image: imageUrl }).where(eq(user.id, userId));

  revalidatePath("/account")
  // 3. Return new URL
  return imageUrl;
}
