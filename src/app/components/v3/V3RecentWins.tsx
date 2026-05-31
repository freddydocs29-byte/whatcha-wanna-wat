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
  onMealClick?: (index: number) => void;
}

export default function V3RecentWins({ wins, onSeeAll, onMealClick }: V3RecentWinsProps) {
  if (!wins || wins.length === 0) return null;

  return (
    <div className="px-[18px] mb-[14px] shrink-0">
      {/* Header */}
      <div className="flex justify-between items-center mb-[10px]">
        <span
          className="text-[14px] font-black text-white tracking-[-0.2px]"
          style={{ fontFamily: "var(--font-nunito)" }}
        >
          Recent wins
        </span>
        <button
          onClick={onSeeAll}
          className="text-[11px] font-semibold bg-transparent border-0 cursor-pointer"
          style={{ fontFamily: "var(--font-manrope)", color: "#E8621A" }}
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
          <button
            key={i}
            className="shrink-0 w-[80px] text-left bg-transparent border-0 p-0 cursor-pointer"
            onClick={() => onMealClick?.(i)}
          >
            {/* Card image */}
            <div
              className="w-[80px] h-[76px] rounded-[13px] overflow-hidden mb-[5px] relative"
              style={{
                background: "#201A16",
                boxShadow: "0 2px 10px rgba(0,0,0,0.40)",
              }}
            >
              {win.image ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={win.image}
                    alt={win.name}
                    className="w-full h-full object-cover"
                  />
                  {/* Bottom gradient for readability */}
                  <div
                    className="absolute bottom-0 left-0 right-0 h-[30px] pointer-events-none"
                    style={{
                      background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 100%)",
                    }}
                  />
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[28px]">
                  {win.emoji}
                </div>
              )}
              {win.isFavorite && (
                <span className="absolute top-[4px] right-[4px] text-[11px] leading-none">
                  🧡
                </span>
              )}
            </div>
            <div
              className="text-[10px] font-extrabold text-white leading-[1.25] truncate"
              style={{ fontFamily: "var(--font-nunito)" }}
            >
              {win.name}
            </div>
            <div
              className="text-[9px] mt-[1px]"
              style={{ fontFamily: "var(--font-manrope)", color: "#504844" }}
            >
              {win.day}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
