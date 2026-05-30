export interface WinItem {
  image?: string;
  emoji: string;
  name: string;
  day: string;
  isFavorite?: boolean;
}

interface V3RecentWinsProps {
  wins?: WinItem[];
  onSeeAll?: () => void;
}

export default function V3RecentWins({ wins, onSeeAll }: V3RecentWinsProps) {
  if (!wins || wins.length === 0) return null;

  return (
    <div className="px-[18px] mb-3 shrink-0">
      {/* Header */}
      <div className="flex justify-between items-center mb-[10px]">
        <span
          className="text-[15px] font-black text-white"
          style={{ fontFamily: "var(--font-nunito)" }}
        >
          Recent wins
        </span>
        <button
          onClick={onSeeAll}
          className="text-xs text-[#E8621A] font-semibold bg-transparent border-0 cursor-pointer"
          style={{ fontFamily: "var(--font-manrope)" }}
        >
          See all ›
        </button>
      </div>

      {/* Scroll row */}
      <div
        className="flex gap-[10px] overflow-x-auto pb-1"
        style={{ scrollbarWidth: "none" } as React.CSSProperties}
      >
        {wins.map((win, i) => (
          <div key={i} className="shrink-0 w-[76px]">
            <div className="w-[76px] h-[72px] rounded-[12px] bg-[#2A2420] overflow-hidden mb-[5px] relative">
              {win.image ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={win.image}
                  alt={win.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[28px]">
                  {win.emoji}
                </div>
              )}
              <span className="absolute top-[4px] right-[4px] text-[11px] leading-none drop-shadow">
                {win.isFavorite ? "🧡" : "🤍"}
              </span>
            </div>
            <div
              className="text-[10px] font-extrabold text-white leading-[1.2] truncate"
              style={{ fontFamily: "var(--font-nunito)" }}
            >
              {win.name}
            </div>
            <div
              className="text-[9px] text-[#5A5350]"
              style={{ fontFamily: "var(--font-manrope)" }}
            >
              {win.day}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
