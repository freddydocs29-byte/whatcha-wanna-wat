export interface WinItem {
  emoji: string;
  name: string;
  day: string;
  isFavorite?: boolean;
}

interface V3RecentWinsProps {
  wins?: WinItem[];
  onSeeAll?: () => void;
}

const MOCK_WINS: WinItem[] = [
  { emoji: "🍝", name: "Truffle Pasta", day: "Tue", isFavorite: false },
  { emoji: "🍤", name: "Bang Bang Shrimp", day: "Sun", isFavorite: true },
  { emoji: "🍚", name: "Chicken Fried Rice", day: "Sat", isFavorite: false },
  { emoji: "🌮", name: "Birria Tacos", day: "Fri", isFavorite: false },
];

export default function V3RecentWins({
  wins = MOCK_WINS,
  onSeeAll,
}: V3RecentWinsProps) {
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
      <div className="flex gap-[10px] overflow-x-auto pb-1">
        {wins.map((win, i) => (
          <div key={i} className="shrink-0 w-[76px]">
            <div className="w-[76px] h-[72px] rounded-[12px] bg-[#2A2420] flex items-center justify-center text-[28px] mb-[5px] relative">
              {win.emoji}
              <span className="absolute top-[5px] right-[5px] text-[12px]">
                {win.isFavorite ? "🧡" : "🤍"}
              </span>
            </div>
            <div
              className="text-[10px] font-extrabold text-white leading-[1.2]"
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
