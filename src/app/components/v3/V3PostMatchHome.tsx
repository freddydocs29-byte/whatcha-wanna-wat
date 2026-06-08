interface AvatarItem {
  avatarUrl?: string | null;
  initials?: string | null;
}

interface V3PostMatchHomeProps {
  mealName?: string;
  headline?: string;
  sub?: string;
  /** Real avatar data for each participant. Replaces the old avatarCount placeholder. */
  avatars?: AvatarItem[];
  mealImage?: string;
}

/** Fallback silhouette — only rendered when no avatarUrl and no initials */
const AvatarSilhouette = () => (
  <svg width="22" height="22" viewBox="0 0 30 30" fill="none">
    <circle cx="15" cy="10" r="5.5" fill="#5A5350" />
    <path d="M2 28c0-7.18 5.82-13 13-13s13 5.82 13 13" fill="#5A5350" />
  </svg>
);

export default function V3PostMatchHome({
  mealName = "Tikka Masala",
  headline = "Great minds\neat alike.",
  sub,
  avatars = [],
  mealImage,
}: V3PostMatchHomeProps) {
  const displaySub = sub ?? `Everyone said yes to ${mealName}.`;
  const hasImage = !!(mealImage && mealImage.trim().length > 0);

  return (
    <div className="mx-[14px] mb-3 rounded-[20px] overflow-hidden relative shrink-0" style={{ height: 210 }}>

      {hasImage ? (
        <>
          {/* Full-bleed meal image — the whole card is the photo */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mealImage}
            alt={mealName}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity: 0.88 }}
          />
          {/* Dark cinematic base — deepens shadows so text never fights the image */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.55) 100%)",
            }}
          />
          {/* Left-side ember gradient — text readability without a visible panel edge */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(to right, rgba(12,4,1,0.93) 0%, rgba(12,4,1,0.82) 28%, rgba(12,4,1,0.52) 52%, rgba(12,4,1,0.12) 72%, transparent 88%)",
            }}
          />
          {/* Bottom vignette — keeps avatar row readable */}
          <div
            className="absolute bottom-0 left-0 right-0 pointer-events-none"
            style={{
              height: "45%",
              background:
                "linear-gradient(to top, rgba(0,0,0,0.72) 0%, transparent 100%)",
            }}
          />
          {/* Subtle warm ember tint on the right side of the image */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse at 85% 45%, rgba(220,90,20,0.14) 0%, transparent 50%)",
            }}
          />
        </>
      ) : (
        <>
          {/* Fallback: rich warm Candlelight background when no image */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.72) 100%), radial-gradient(ellipse at 65% 40%, #7A2800 0%, #3D1200 45%, #1A0800 100%)",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 65% 55%, rgba(200,90,25,0.65) 0%, transparent 40%), radial-gradient(ellipse at 35% 35%, rgba(240,150,50,0.35) 0%, transparent 30%)",
            }}
          />
          <div
            className="absolute right-[-8px] bottom-[-18px] text-[115px] leading-none pointer-events-none select-none"
            style={{ filter: "drop-shadow(0 -6px 20px rgba(0,0,0,0.55))" }}
          >
            🍛
          </div>
        </>
      )}

      {/* Content — always rendered above image layers */}
      <div className="absolute inset-0 flex flex-col justify-between p-4 z-[2]">
        <div>
          <div
            className="text-[10px] font-medium text-[#E8621A] tracking-[2.5px] uppercase mb-[6px]"
            style={{ fontFamily: "var(--font-jetbrains-mono)" }}
          >
            WE HAVE A MATCH! 🎉
          </div>
          <div
            className="text-[32px] text-white leading-[1.08] mb-1 whitespace-pre-line"
            style={{ fontFamily: "var(--font-instrument-serif)", fontWeight: 400 }}
          >
            {headline}
          </div>
          <div
            className="text-[13px] mb-3"
            style={{ fontFamily: "var(--font-manrope)", color: "rgba(255,255,255,0.8)" }}
          >
            {displaySub}
          </div>
        </div>

        {/* Avatar row — only real participants, no fake silhouettes */}
        {avatars.length > 0 && (
          <div className="flex gap-[6px] items-center">
            {avatars.map((av, i) => (
              <div key={i} className="relative shrink-0">
                <div className="w-[38px] h-[38px] rounded-full bg-[#3D3733] flex items-center justify-center border-2 border-white/25 overflow-hidden">
                  {av.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={av.avatarUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : av.initials ? (
                    <span
                      className="text-[13px] font-bold text-white"
                      style={{ fontFamily: "var(--font-nunito)" }}
                    >
                      {av.initials}
                    </span>
                  ) : (
                    <AvatarSilhouette />
                  )}
                </div>
                <div className="absolute bottom-[-1px] right-[-1px] w-[14px] h-[14px] rounded-full bg-[#4A7C59] border-[1.5px] border-[#1C1A18] flex items-center justify-center text-[7px] text-white font-bold">
                  ✓
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
