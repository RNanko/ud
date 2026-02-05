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

    // instant preview
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);

    startTransition(async () => {
      const newUrl = await updateAvatar(file);
      setPreview(newUrl); // server-confirmed
    });
  }

  return (
    <div className="relative w-[280px] h-[280px] group">
      <Image
        src={preview ?? "/avatar/avatar.png"}
        alt="User avatar"
        fill
        sizes="280px"
        priority
        className="rounded-full object-cover"
      />

      {/* Hover overlay */}
      <label
        className="
        absolute inset-20
        flex items-center justify-center
        rounded-full
        bg-black/40
        opacity-0 group-hover:opacity-100
        cursor-pointer
        transition-opacity
      "
      >
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
