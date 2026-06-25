"use client";

import { updateAvatar } from "@/lib/actions/account.actions";
import Image from "next/image";
import { useState, useTransition } from "react";

export default function AvatarSection({ image }: { image?: string }) {
  const [preview, setPreview] = useState(image);
  const [isPending, startTransition] = useTransition();

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);

    startTransition(async () => {
      const newUrl = await updateAvatar(file);
      setPreview(newUrl);
    });
  }

  return (
    <div className="relative min-w-[200px] h-[200px] sm:min-w-[280px] sm:h-[280px] group">
      <Image
        src={preview ?? "/avatar/avatar.png"}
        alt="User avatar"
        fill
        priority
        className="rounded-full object-cover"
      />

      {/* Spinner */}
      {isPending && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-full">
          <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Hover overlay */}
      <label className="absolute inset-20 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
        <span className="text-white font-bold text-md text-center">
          {image ? "Update Image" : "Load Image"}
        </span>

        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageChange}
          disabled={isPending}
        />
      </label>
    </div>
  );
}
