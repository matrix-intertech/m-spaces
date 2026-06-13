"use client";

import Image from "next/image";
import { useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Images } from "lucide-react";
import { assetPath } from "@/lib/format";

function normalizePhotos(photos: Array<string | null | undefined>): string[] {
  const resolved = photos
    .map((photo) => assetPath(photo, ""))
    .filter((photo): photo is string => Boolean(photo));

  return resolved.length ? Array.from(new Set(resolved)) : [assetPath(null)];
}

export function PropertyShowcaseGallery({
  photos,
  alt,
  priority = false,
  sidebar,
}: {
  photos: Array<string | null | undefined>;
  alt: string;
  priority?: boolean;
  sidebar?: ReactNode;
}) {
  const images = useMemo(() => normalizePhotos(photos), [photos]);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeImage = images[activeIndex] ?? images[0];
  const hasMultiplePhotos = images.length > 1;
  const previewImages = hasMultiplePhotos ? images.slice(0, 4) : [];
  const hasSidebar = Boolean(sidebar);

  function previousPhoto() {
    setActiveIndex((current) => (current - 1 + images.length) % images.length);
  }

  function nextPhoto() {
    setActiveIndex((current) => (current + 1) % images.length);
  }

  return (
    <div
      className={
        hasSidebar
          ? "grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px_360px] xl:items-start"
          : previewImages.length
            ? "grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]"
            : "grid gap-3"
      }
    >
      <div className="relative min-h-[360px] overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm md:min-h-[430px] xl:min-h-[450px]">
        <Image
          src={activeImage}
          alt={alt}
          fill
          priority={priority}
          sizes="(max-width: 1024px) 100vw, 980px"
          className="object-cover"
        />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-slate-950/40 via-slate-950/5 to-transparent" />

        <div className="absolute bottom-4 left-4 z-[2] inline-flex items-center gap-2 rounded-full bg-white/92 px-3 py-2 text-xs font-black text-slate-900 shadow-sm backdrop-blur">
          <Images className="h-4 w-4 text-red-600" aria-hidden />
          {activeIndex + 1} / {images.length} photos
        </div>

        {hasMultiplePhotos ? (
          <>
            <button
              type="button"
              onClick={previousPhoto}
              aria-label="Previous property photo"
              className="absolute left-4 top-1/2 z-[2] inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/92 text-slate-900 shadow-sm transition hover:bg-white"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={nextPhoto}
              aria-label="Next property photo"
              className="absolute right-4 top-1/2 z-[2] inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/92 text-slate-900 shadow-sm transition hover:bg-white"
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
          </>
        ) : null}
      </div>

      {previewImages.length ? (
        <div
          className={`grid grid-cols-4 gap-3 lg:grid-cols-1 ${
            hasSidebar
              ? "xl:min-h-[450px] xl:grid-cols-1 xl:auto-rows-fr"
              : "lg:grid-rows-4"
          }`}
        >
          {previewImages.map((image, index) => {
            const isLastVisibleTile = index === previewImages.length - 1;
            const hiddenCount = images.length - previewImages.length;
            const isActive = index === activeIndex;

            return (
              <button
                key={`${image}-${index}`}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={`group relative overflow-hidden rounded-xl border text-left shadow-sm transition ${
                  isActive ? "border-red-500 ring-2 ring-red-200" : "border-slate-200 hover:border-slate-300"
                } ${hasSidebar ? "xl:h-full" : ""}`}
              >
                <div className={`relative min-h-[84px] bg-slate-100 lg:min-h-[102px] ${hasSidebar ? "xl:h-full xl:min-h-0" : ""}`}>
                  <Image
                    src={image}
                    alt={`${alt} preview ${index + 1}`}
                    fill
                    sizes="220px"
                    className="object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                  {isLastVisibleTile && hiddenCount > 0 ? (
                    <div className="absolute inset-0 grid place-items-center bg-slate-950/55 text-center text-sm font-black text-white backdrop-blur-[2px]">
                      +{hiddenCount} more
                    </div>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      ) : null}

      {hasSidebar ? <div className="grid gap-4 xl:sticky xl:top-24">{sidebar}</div> : null}
    </div>
  );
}
