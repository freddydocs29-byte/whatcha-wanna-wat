interface V3PostMatchHomeProps {
  mealName?: string;
  headline?: string;
  sub?: string;
  avatarCount?: number;
}

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
  avatarCount = 3,
}: V3PostMatchHomeProps) {
  const displaySub = sub ?? `Everyone said yes to ${mealName}.`;

  return (
    <div className="mx-[14px] mb-3 rounded-[20px] overflow-hidden relative shrink-0" style={{ height: 210 }}>
      {/* Background photo simulation */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.72) 100%), radial-gradient(ellipse at 65% 40%, #7A2800 0%, #3D1200 45%, #1A0800 100%)",
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 65% 55%, rgba(200,90,25,0.65) 0%, transparent 40%), radial-gradient(ellipse at 35% 35%, rgba(240,150,50,0.35) 0%, transparent 30%)",
          }}
        />
        {/* Food emoji accent */}
        <div
          className="absolute right-[-8px] bottom-[-18px] text-[115px] leading-none pointer-events-none select-none"
          style={{ filter: "drop-shadow(0 -6px 20px rgba(0,0,0,0.55))" }}
        >
          🍛
        </div>
      </div>

      {/* Content */}
      <div className="absolute inset-0 flex flex-col justify-between p-4 z-[2]">
        <div>
          <div
            className="text-[11px] font-bold text-[#E8621A] tracking-[0.5px] mb-1"
            style={{ fontFamily: "var(--font-manrope)" }}
          >
            WE HAVE A MATCH! 🎉
          </div>
          <div
            className="text-[30px] font-black text-white leading-[1.05] mb-1 whitespace-pre-line"
            style={{ fontFamily: "var(--font-nunito)" }}
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

        {/* Avatar row */}
        <div className="flex gap-[6px] items-center">
          {Array.from({ length: Math.min(avatarCount, 3) }).map((_, i) => (
            <div key={i} className="relative shrink-0">
              <div className="w-[38px] h-[38px] rounded-full bg-[#3D3733] flex items-center justify-center border-2 border-white/25 overflow-hidden">
                <AvatarSilhouette />
              </div>
              <div className="absolute bottom-[-1px] right-[-1px] w-[14px] h-[14px] rounded-full bg-[#4A7C59] border-[1.5px] border-[#1C1A18] flex items-center justify-center text-[7px] text-white font-bold">
                ✓
              </div>
            </div>
          ))}
          <div className="w-[38px] h-[38px] rounded-full border-2 border-dashed border-white/30 flex items-center justify-center text-[18px] text-white/45">
            +
          </div>
        </div>
      </div>
    </div>
  );
}
