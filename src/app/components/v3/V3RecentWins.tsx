export interface WinItem {
  image?: string;
  emoji: string;
  name: string;
  day: string;
  mealId: string;
}

interface V3RecentWinsProps {
  wins?: WinItem[];
  /** Set of meal IDs currently in the user's saved collection. */
  savedMealIds?: Set<string>;
  /** Called when the heart is tapped. Parent handles save/unsave logic. */
  onToggleSave?: (mealId: string) => void;
  onSeeAll?: () => void;
  onMealClick?: (index: number) => void;
}

export default function V3RecentWins({ wins, savedMealIds, onToggleSave, onSeeAll, onMealClick }: V3RecentWinsProps) {
  if (!wins || wins.length === 0) return null;

  return (
    <div className="shrink-0" style={{ marginBottom: 14 }}>
      {/* Section header — Instrument Serif italic title + mono count + orange See all */}
      <div
        className="flex items-baseline justify-between"
        style={{ padding: "30px 30px 14px" }}
      >
        <div className="flex items-baseline" style={{ gap: 11 }}>
          <span
            style={{
              fontFamily: "var(--font-instrument-serif)",
              fontStyle: "italic",
              fontWeight: 400,
              fontSize: 24,
              color: "#F6EEE2",
              lineHeight: 1,
            }}
          >
            Recent wins
          </span>
          <span
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              fontSize: 9.5,
              letterSpacing: "1.5px",
              color: "#897E73",
              textTransform: "uppercase",
              fontWeight: 400,
            }}
          >
            last 7 days
          </span>
        </div>
        <button
          onClick={onSeeAll}
          className="inline-flex items-center"
          style={{
            gap: 5,
            fontFamily: "var(--font-sans, Inter, system-ui)",
            fontWeight: 500,
            fontSize: 12,
            color: "#E8621A",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          See all <span>›</span>
        </button>
      </div>

      {/* Horizontal scroll rail — snap to start */}
      <div
        className="flex overflow-x-auto"
        style={{
          gap: 13,
          padding: "0 30px 6px",
          scrollbarWidth: "none",
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
        } as React.CSSProperties}
      >
        {wins.map((win, i) => (
          <button
            key={i}
            onClick={() => onMealClick?.(i)}
            className="flex-shrink-0 text-left p-0 bg-transparent border-0 cursor-pointer group"
            style={{ scrollSnapAlign: "start", width: 142 }}
          >
            {/* Card frame — 142×142, studio-lit */}
            <div
              className="relative overflow-hidden transition-all duration-[250ms] group-hover:-translate-y-1"
              style={{
                width: 142,
                height: 142,
                borderRadius: 20,
                border: "1px solid rgba(245,237,224,0.085)",
                boxShadow: "0 14px 30px rgba(0,0,0,0.4)",
              }}
            >
              {win.image ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={win.image}
                    alt={win.name}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  {/* Studio top-spotlight — mix-blend-mode screen */}
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background:
                        "radial-gradient(ellipse 58% 46% at 50% 2%, rgba(255,248,235,0.78) 0%, rgba(255,228,190,0.18) 30%, transparent 58%)",
                      mixBlendMode: "screen",
                    }}
                  />
                  {/* Bottom scrim + vignette */}
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background:
                        "radial-gradient(ellipse 90% 70% at 50% 120%, rgba(0,0,0,0.62) 0%, transparent 60%), " +
                        "linear-gradient(180deg, transparent 40%, rgba(6,4,3,0.55) 100%)",
                    }}
                  />
                </>
              ) : (
                <>
                  {/* Emoji fallback with dark bg */}
                  <div
                    className="absolute inset-0 flex items-center justify-center text-[36px]"
                    style={{ background: "#1A1410" }}
                  >
                    {win.emoji}
                  </div>
                  {/* Bottom scrim on emoji too */}
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background:
                        "linear-gradient(180deg, transparent 40%, rgba(6,4,3,0.55) 100%)",
                    }}
                  />
                </>
              )}

              {/* Day badge — top-left */}
              <span
                className="absolute z-[3]"
                style={{
                  top: 10,
                  left: 11,
                  fontFamily: "var(--font-jetbrains-mono)",
                  fontSize: 8.5,
                  letterSpacing: "1.4px",
                  color: "#F6EEE2",
                  textTransform: "uppercase",
                  padding: "3px 8px",
                  borderRadius: 100,
                  background: "rgba(8,5,3,0.5)",
                  border: "1px solid rgba(245,237,224,0.085)",
                  backdropFilter: "blur(6px)",
                  WebkitBackdropFilter: "blur(6px)",
                  fontWeight: 400,
                }}
              >
                {win.day}
              </span>

              {/* Heart — save/unsave button wired to real saved-meals state */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSave?.(win.mealId);
                }}
                aria-label={savedMealIds?.has(win.mealId) ? "Remove from saved" : "Save meal"}
                className="absolute z-[3] flex items-center justify-center"
                style={{
                  top: 9,
                  right: 9,
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: "rgba(8,5,3,0.5)",
                  border: "1px solid rgba(245,237,224,0.16)",
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                  fontSize: 11,
                  color: savedMealIds?.has(win.mealId) ? "#E8621A" : "#C7BDAC",
                  cursor: "pointer",
                  userSelect: "none",
                  padding: 0,
                }}
              >
                {savedMealIds?.has(win.mealId) ? "♥" : "♡"}
              </button>
            </div>

            {/* Dish name — Instrument Serif italic */}
            <div
              style={{
                marginTop: 11,
                fontFamily: "var(--font-instrument-serif)",
                fontStyle: "italic",
                fontWeight: 400,
                fontSize: 16,
                color: "#F6EEE2",
                lineHeight: 1.05,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {win.name}
            </div>

            {/* Sub info */}
            <div
              style={{
                marginTop: 3,
                fontFamily: "var(--font-sans, Inter, system-ui)",
                fontWeight: 300,
                fontSize: 10.5,
                color: "#897E73",
              }}
            >
              {win.day}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
