"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { type Meal } from "../data/meals";

type Props = {
  meal: Meal;
  recipeQuery: string;
};

export default function SoloMatchClient({ meal, recipeQuery }: Props) {
  const router = useRouter();
  const [showEatOptions, setShowEatOptions] = useState(false);

  return (
    <main className="relative min-h-screen bg-[#1C1A18] text-white overflow-hidden">
      {/* Orange radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% 25%, rgba(232,98,26,0.15) 0%, transparent 60%)" }}
      />

      <div className="relative flex flex-col items-center justify-start min-h-screen px-6 pt-16 pb-10 z-10">

        {/* Hero circle */}
        <div className="relative flex items-center justify-center mt-0">
          {/* Outer pulsing ring */}
          <div className="absolute w-40 h-40 rounded-full bg-[#4A7C59]/20 animate-pulse" />
          {/* Inner circle */}
          <div
            className="w-28 h-28 rounded-full bg-[#4A7C59] flex items-center justify-center relative z-10"
            style={{ boxShadow: "0 0 60px rgba(74,124,89,0.45)" }}
          >
            <span className="font-display font-black text-5xl text-white">✓</span>
          </div>
        </div>

        {/* Eyebrow */}
        <p className="text-[#E8621A] text-[11px] font-semibold tracking-widest uppercase mt-6">
          TONIGHT&apos;S PICK
        </p>

        {/* Headline */}
        <h1 className="font-display font-black text-4xl text-white text-center mt-2 leading-tight">
          Dinner is decided.
        </h1>

        {/* Meal name */}
        <p className="font-display font-bold text-2xl text-[#E8621A] text-center mt-1">
          {meal.name}
        </p>

        {/* Meal image */}
        <div
          className="w-full rounded-[20px] overflow-hidden mt-6 bg-[#2A2420]"
          style={{ aspectRatio: "16/9" }}
        >
          <img
            src={meal.image}
            alt={meal.name}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Description */}
        <p className="font-body text-sm text-white/70 text-center mt-4 leading-relaxed">
          {meal.description}
        </p>

        {/* CTA buttons */}
        <div className="flex gap-3 w-full mt-6">
          <button
            onClick={() => setShowEatOptions(true)}
            className="flex-1 py-4 rounded-[16px] bg-[#E8621A] text-white font-display font-black text-base text-center"
            style={{ boxShadow: "0 0 30px rgba(232,98,26,0.3)" }}
          >
            Let&apos;s eat 🙌
          </button>
          <button
            onClick={() => router.push(`/locked?mealId=${meal.id}`)}
            className="flex-1 py-4 rounded-[16px] bg-[#2A2420] text-white font-display font-black text-base text-center"
          >
            Back home
          </button>
        </div>

      </div>

      {showEatOptions && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowEatOptions(false)} />
          <div className="relative w-full bg-[#2A2420] rounded-t-[28px] px-6 pt-6 pb-10">
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-6" />
            <h2 className="font-display font-black text-2xl text-white text-center">
              How are you eating?
            </h2>
            <div className="grid grid-cols-2 gap-3 mt-6">
              <a
                href={`https://www.google.com/search?q=order+${encodeURIComponent(meal.name)}+delivery`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-[#1C1A18] rounded-[20px] p-5 flex flex-col items-center gap-3 border border-transparent hover:border-[#E8621A]/40"
              >
                <span className="text-4xl">🚗</span>
                <span className="font-display font-black text-lg text-white">Order in</span>
                <span className="font-body text-xs text-[#8A7F78] text-center">Find delivery options</span>
              </a>
              <a
                href={`https://www.google.com/search?q=how+to+cook+${encodeURIComponent(meal.name)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-[#1C1A18] rounded-[20px] p-5 flex flex-col items-center gap-3 border border-transparent hover:border-[#E8621A]/40"
              >
                <span className="text-4xl">🍳</span>
                <span className="font-display font-black text-lg text-white">Cook it</span>
                <span className="font-body text-xs text-[#8A7F78] text-center">See what you need</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
