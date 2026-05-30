"use client";

interface V3PrimaryDecisionCTAProps {
  isSolo?: boolean;
  hasGuests?: boolean;
  onClick?: () => void;
}

export default function V3PrimaryDecisionCTA({
  isSolo = false,
  hasGuests = false,
  onClick,
}: V3PrimaryDecisionCTAProps) {
  const title =
    isSolo
      ? "Start my deck"
      : hasGuests
      ? "Start our decision"
      : "Start my deck";

  const sub =
    isSolo
      ? "Solo, just for you"
      : hasGuests
      ? "Everyone's in. Let's go!"
      : "Add someone or go solo";

  return (
    <div className="mx-[14px] mb-[10px] mt-auto shrink-0">
      <div
        className="relative h-[62px] rounded-full border border-[#E8621A]/[0.22] overflow-hidden cursor-pointer"
        style={{ background: "rgba(232,98,26,0.08)" }}
        onClick={onClick}
      >
        {/* Gradient fill behind thumb */}
        <div
          className="absolute left-0 top-0 bottom-0 w-[60px] rounded-full pointer-events-none"
          style={{
            background:
              "linear-gradient(90deg, #E8621A 0%, rgba(232,98,26,0.18) 100%)",
          }}
        />

        {/* Thumb */}
        <div
          className="absolute left-[5px] top-[5px] bottom-[5px] w-[52px] bg-[#E8621A] rounded-full flex items-center justify-center text-[22px] z-[3]"
          style={{ boxShadow: "0 4px 14px rgba(232,98,26,0.45)" }}
        >
          🍽️
        </div>

        {/* Label */}
        <div className="absolute left-[68px] right-[38px] top-0 bottom-0 flex flex-col justify-center pointer-events-none z-[2]">
          <div
            className="text-[15px] font-black leading-[1.2]"
            style={{
              fontFamily: "var(--font-nunito)",
              color: "rgba(232,98,26,0.9)",
            }}
          >
            {title}
          </div>
          <div
            className="text-[11px]"
            style={{
              fontFamily: "var(--font-manrope)",
              color: "rgba(232,98,26,0.5)",
            }}
          >
            {sub}
          </div>
        </div>

        {/* Hint arrows */}
        <div
          className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none z-[2] text-[13px] tracking-[-3px]"
          style={{ color: "rgba(232,98,26,0.3)" }}
        >
          &gt;&gt;&gt;
        </div>
      </div>
    </div>
  );
}
