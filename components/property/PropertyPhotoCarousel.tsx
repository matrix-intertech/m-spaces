"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { assetPath } from "@/lib/format";

interface PropertyPhotoCarouselProps {
  photos: Array<string | null | undefined>;
  alt: string;
  href?: string;
  priority?: boolean;
  sizes?: string;
  aspectRatio?: string;
  minHeight?: number;
  borderRadius?: number | string;
  className?: string;
  showCounter?: boolean;
  children?: ReactNode;
}

function normalizePhotos(photos: Array<string | null | undefined>): string[] {
  const resolved = photos
    .map((photo) => assetPath(photo, ""))
    .filter((photo): photo is string => Boolean(photo));

  return resolved.length ? Array.from(new Set(resolved)) : [assetPath(null)];
}

export function PropertyPhotoCarousel({
  photos,
  alt,
  href,
  priority = false,
  sizes = "(max-width: 768px) 100vw, 320px",
  aspectRatio = "4 / 3",
  minHeight,
  borderRadius,
  className,
  showCounter = false,
  children
}: PropertyPhotoCarouselProps) {
  const images = useMemo(() => normalizePhotos(photos), [photos]);
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const hasMultiplePhotos = images.length > 1;
  const image = images[activeIndex] ?? images[0];

  useEffect(() => {
    setActiveIndex(0);
  }, [images.join("|")]);

  function previousPhoto() {
    setActiveIndex((current) => (current - 1 + images.length) % images.length);
  }

  function nextPhoto() {
    setActiveIndex((current) => (current + 1) % images.length);
  }

  function handleTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    if (!hasMultiplePhotos) return;
    touchStartX.current = event.touches[0]?.clientX ?? null;
    touchStartY.current = event.touches[0]?.clientY ?? null;
  }

  function handleTouchEnd(event: React.TouchEvent<HTMLDivElement>) {
    if (!hasMultiplePhotos || touchStartX.current === null || touchStartY.current === null) return;
    const endX = event.changedTouches[0]?.clientX ?? touchStartX.current;
    const endY = event.changedTouches[0]?.clientY ?? touchStartY.current;
    const deltaX = endX - touchStartX.current;
    const deltaY = endY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;

    if (Math.abs(deltaX) < 40 || Math.abs(deltaX) < Math.abs(deltaY)) return;
    if (deltaX < 0) nextPhoto();
    else previousPhoto();
  }

  return (
    <div
      className={className}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{
        position: "relative",
        aspectRatio,
        minHeight,
        borderRadius,
        overflow: "hidden",
        background: "rgba(15,23,42,.06)",
        touchAction: "pan-y"
      }}
    >
      {href ? (
        <Link href={href} aria-label={alt} style={{ position: "absolute", inset: 0, zIndex: 1 }}>
          <Image src={image} alt={alt} fill priority={priority} sizes={sizes} style={{ objectFit: "cover" }} />
        </Link>
      ) : (
        <Image src={image} alt={alt} fill priority={priority} sizes={sizes} style={{ objectFit: "cover" }} />
      )}

      {children}

      {hasMultiplePhotos ? (
        <>
          <button
            type="button"
            onClick={previousPhoto}
            aria-label="Previous property photo"
            className="property-carousel-hotzone property-carousel-hotzone-left"
          >
            <span className="property-carousel-control">
              <ChevronLeft size={18} aria-hidden />
            </span>
          </button>
          <button
            type="button"
            onClick={nextPhoto}
            aria-label="Next property photo"
            className="property-carousel-hotzone property-carousel-hotzone-right"
          >
            <span className="property-carousel-control">
              <ChevronRight size={18} aria-hidden />
            </span>
          </button>
          <div className="property-carousel-dots" aria-hidden>
            {images.map((photo, index) => (
              <span key={`${photo}-${index}`} className={index === activeIndex ? "is-active" : ""} />
            ))}
          </div>
        </>
      ) : null}
      {showCounter ? (
        <span
          style={{
            position: "absolute",
            right: 14,
            bottom: 14,
            zIndex: 3,
            borderRadius: 999,
            background: "rgba(255,255,255,.95)",
            color: "#0f172a",
            padding: ".28rem .56rem",
            fontSize: ".8rem",
            fontWeight: 800
          }}
        >
          {activeIndex + 1} / {Math.max(images.length, 1)}
        </span>
      ) : null}
    </div>
  );
}
