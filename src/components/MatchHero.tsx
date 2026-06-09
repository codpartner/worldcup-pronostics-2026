"use client";

import Image from "next/image";
import { useState } from "react";
import type { TeamHero } from "@/lib/team-heroes";

interface MatchHeroProps {
  hero: TeamHero;
  side: "left" | "right";
  className?: string;
}

function HeroPanel({ hero, side, className = "" }: MatchHeroProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = hero.image && !imageFailed;

  return (
    <div
      className={`relative min-h-36 overflow-hidden sm:min-h-44 ${className}`}
      style={{
        background: `linear-gradient(145deg, ${hero.accent} 0%, color-mix(in oklab, ${hero.accent} 55%, black) 100%)`,
      }}
    >
      {showImage && (
        <Image
          src={hero.image!}
          alt={hero.player}
          fill
          className={`object-cover object-top ${
            side === "left" ? "object-[center_20%]" : "object-[center_20%] scale-x-[-1]"
          }`}
          sizes="(max-width: 768px) 50vw, 320px"
          onError={() => setImageFailed(true)}
        />
      )}

      <div
        className={`absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent ${
          side === "left"
            ? "bg-gradient-to-r from-black/50 to-transparent"
            : "bg-gradient-to-l from-black/50 to-transparent"
        }`}
      />

      <div
        className={`absolute bottom-0 p-3 sm:p-4 ${
          side === "left" ? "left-0 text-left" : "right-0 text-right"
        }`}
      >
        <p className="text-2xl leading-none sm:text-3xl" aria-hidden>
          {hero.flag}
        </p>
        <p className="font-fifa mt-1 text-xs font-bold tracking-[0.14em] text-white/90 sm:text-sm">
          {hero.fifaCode}
        </p>
        <p className="mt-1 text-sm font-bold text-white sm:text-base">
          {hero.player}
        </p>
      </div>
    </div>
  );
}

interface MatchHeroBannerProps {
  team1: TeamHero;
  team2: TeamHero;
  className?: string;
}

export function MatchHeroBanner({
  team1,
  team2,
  className = "",
}: MatchHeroBannerProps) {
  return (
    <div className={`grid grid-cols-2 overflow-hidden ${className}`}>
      <HeroPanel hero={team1} side="left" />
      <HeroPanel hero={team2} side="right" />
    </div>
  );
}
