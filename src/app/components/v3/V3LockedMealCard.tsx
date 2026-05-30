interface V3LockedMealCardProps {
  mealName?: string;
  tags?: string;
  cookTime?: string;
  spice?: string;
  matchScore?: string;
  onClear?: () => void;
}

export default function V3LockedMealCard({
  mealName = "Tikka Masala",
  tags = "Indian • Creamy • Spicy",
  cookTime = "30-40 min",
  spice = "🌶️🌶️🌶️",
  matchScore = "98% Match",
  onClear,
}: V3LockedMealCardProps) {
  return (
    <div className="mx-[14px] mb-3 bg-[#2A2420] rounded-[18px] px-4 py-[14px] border border-[#4A7C59]/20 relative overflow-hidden shrink-0">
      {/* Green accent bar at top */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#4A7C59]" />

      {/* Label */}
      <div
        className="text-[9px] font-bold tracking-[2px] uppercase text-[#6BAF7A] mb-[5px]"
        style={{ fontFamily: "var(--font-manrope)" }}
      >
        DINNER IS LOCKED IN
      </div>

      {/* Meal name row */}
      <div className="flex justify-between items-start mb-[3px]">
        <div>
          <div
            className="text-xl font-black text-white"
            style={{ fontFamily: "var(--font-nunito)" }}
          >
            {mealName}
          </div>
          <div
            className="text-xs text-[#8A7F78] mb-[10px]"
            style={{ fontFamily: "var(--font-manrope)" }}
          >
            {tags}
          </div>
        </div>
        <button
          onClick={onClear}
          className="w-[30px] h-[30px] rounded-full bg-[#3D3733] border border-white/10 flex items-center justify-center text-xs text-[#8A7F78] cursor-pointer shrink-0 mt-[2px] transition-all hover:bg-red-800/30 hover:text-[#E07070] hover:border-red-500/30"
        >
          ✕
        </button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-[6px] mb-[10px]">
        {[
          { icon: "⏱️", main: cookTime, sub: "Total time", green: false },
          { icon: "🌶️", main: spice, sub: "Spice Level", green: false },
          { icon: "✓", main: matchScore, sub: "Great pick!", green: true },
        ].map((stat, i) => (
          <div
            key={i}
            className="bg-[#1C1A18] rounded-[10px] px-2 py-[7px] flex items-center gap-[5px]"
          >
            <span
              className={`text-[11px] shrink-0 ${stat.green ? "text-[#6BAF7A]" : ""}`}
            >
              {stat.icon}
            </span>
            <div>
              <div
                className={`text-[10px] font-bold leading-[1.2] ${
                  stat.green ? "text-[#6BAF7A]" : "text-white"
                }`}
                style={{ fontFamily: "var(--font-manrope)" }}
              >
                {stat.main}
              </div>
              <div
                className="text-[9px] text-[#5A5350]"
                style={{ fontFamily: "var(--font-manrope)" }}
              >
                {stat.sub}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Let's Eat bidirectional swipe (static visual) */}
      <div>
        <div className="flex justify-between px-1 mb-[6px]">
          <span
            className="text-[11px] text-[#5A5350]"
            style={{ fontFamily: "var(--font-manrope)" }}
          >
            ← 🍳 Cook
          </span>
          <span
            className="text-[11px] text-[#5A5350]"
            style={{ fontFamily: "var(--font-manrope)" }}
          >
            📱 Order →
          </span>
        </div>
        <div className="relative h-[54px] rounded-[14px] overflow-hidden cursor-grab">
          {/* Cook layer (left) */}
          <div
            className="absolute inset-0 bg-[#4A7C59] rounded-[14px] flex items-center pl-[22px] text-[15px] font-black text-white"
            style={{ fontFamily: "var(--font-nunito)" }}
          >
            🍳 We&apos;re cooking
          </div>
          {/* Order layer (right) */}
          <div
            className="absolute inset-0 bg-[#E8621A] rounded-[14px] flex items-center justify-end pr-[22px] text-[15px] font-black text-white"
            style={{ fontFamily: "var(--font-nunito)" }}
          >
            Let&apos;s order 📱
          </div>
          {/* Resting pill (top) */}
          <div
            className="absolute inset-0 bg-[#3D3733] rounded-[14px] border border-white/[0.06] flex items-center justify-between px-[18px]"
          >
            <span
              className="text-[11px] text-[#5A5350]"
              style={{ fontFamily: "var(--font-manrope)" }}
            >
              ←
            </span>
            <span
              className="text-[15px] font-black text-white"
              style={{ fontFamily: "var(--font-nunito)" }}
            >
              Let&apos;s Eat 🙌
            </span>
            <span
              className="text-[11px] text-[#5A5350]"
              style={{ fontFamily: "var(--font-manrope)" }}
            >
              →
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
