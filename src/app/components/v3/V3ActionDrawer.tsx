"use client";

export interface DrawerOption {
  icon: string;
  title: string;
  sub: string;
  primary?: boolean;
  onClick?: () => void;
}

const DEFAULT_OPTIONS: DrawerOption[] = [
  { icon: "👥", title: "Together", sub: "Everyone gets a say", primary: true },
  { icon: "👤", title: "Just me", sub: "Solo deck, fast for you" },
  { icon: "🏆", title: "Top 5 tonight", sub: "See the best picks now" },
  { icon: "🎲", title: "Surprise me", sub: "Let Watcha choose" },
];

interface V3ActionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  options?: DrawerOption[];
}

export default function V3ActionDrawer({
  isOpen,
  onClose,
  options = DEFAULT_OPTIONS,
}: V3ActionDrawerProps) {
  return (
    <>
      {/* Overlay */}
      <div
        className={`absolute inset-0 z-50 rounded-[inherit] transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(3px)" }}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        className="absolute bottom-0 left-0 right-0 rounded-t-[28px] pb-5 z-[51] transition-transform duration-[320ms]"
        style={{
          transform: isOpen ? "translateY(0)" : "translateY(100%)",
          transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)",
          background:
            "radial-gradient(ellipse 80% 30% at 50% 0%, rgba(232,98,26,0.07) 0%, transparent 60%), #211E1B",
          border: "1px solid rgba(255,255,255,0.05)",
          borderBottom: "none",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.5)",
        }}
      >
        {/* Handle */}
        <div className="w-9 h-1 rounded-full bg-[rgba(245,237,224,0.15)] mx-auto mt-3" />

        {/* Header */}
        <div className="flex justify-between items-start px-[18px] pt-[14px] pb-1">
          <div
            className="text-[18px] font-black text-white leading-tight"
            style={{ fontFamily: "var(--font-nunito)" }}
          >
            How do you want
            <br />
            to decide?
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-[13px] text-[#8A7F78] border border-[rgba(245,237,224,0.08)] cursor-pointer shrink-0"
            style={{ background: "rgba(255,231,202,0.04)" }}
          >
            ✕
          </button>
        </div>

        <div
          className="text-xs text-[#8A7F78] px-[18px] pb-3"
          style={{ fontFamily: "var(--font-manrope)" }}
        >
          Choose the path that fits tonight.
        </div>

        {/* Options */}
        <div className="flex flex-col gap-2 px-[14px]">
          {options.map((opt, i) => (
            <button
              key={i}
              onClick={() => {
                opt.onClick?.();
                onClose();
              }}
              className="flex items-center gap-3 px-[14px] py-[13px] bg-[#1C1A18] rounded-[14px] cursor-pointer border border-white/[0.04] text-left w-full transition-colors hover:bg-[#E8621A]/[0.08]"
            >
              <div
                className={`w-[42px] h-[42px] rounded-[12px] flex items-center justify-center text-xl shrink-0 ${
                  opt.primary ? "bg-[#E8621A]" : ""
                }`}
                style={opt.primary ? { boxShadow: "0 0 14px rgba(232,98,26,0.35)" } : {
                  background: "rgba(255,231,202,0.06)",
                  border: "1px solid rgba(245,237,224,0.07)",
                }}
              >
                {opt.icon}
              </div>
              <div className="flex-1">
                <div
                  className="text-[15px] font-black text-white mb-[2px]"
                  style={{ fontFamily: "var(--font-nunito)" }}
                >
                  {opt.title}
                </div>
                <div
                  className="text-[11px] text-[#8A7F78]"
                  style={{ fontFamily: "var(--font-manrope)" }}
                >
                  {opt.sub}
                </div>
              </div>
              <div className="text-base text-[#5A5350]">›</div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
