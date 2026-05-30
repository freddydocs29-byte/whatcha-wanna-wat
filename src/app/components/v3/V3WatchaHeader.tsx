"use client";

interface V3WatchaHeaderProps {
  hasNotification?: boolean;
  showShare?: boolean;
}

export default function V3WatchaHeader({
  hasNotification = true,
  showShare = false,
}: V3WatchaHeaderProps) {
  return (
    <div className="flex justify-between items-center px-[18px] py-2 shrink-0">
      {/* Hamburger */}
      <button className="w-9 h-9 rounded-[10px] bg-[#2A2420] flex items-center justify-center border-0 cursor-pointer">
        <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
          <rect width="16" height="2" rx="1" fill="white" />
          <rect y="5" width="16" height="2" rx="1" fill="white" />
          <rect y="10" width="16" height="2" rx="1" fill="white" />
        </svg>
      </button>

      {/* Logo — "Watcha" Nunito bold + "wanna eat?" Dancing Script */}
      <div className="text-center leading-none">
        <span
          className="block text-xl font-black text-white leading-none"
          style={{ fontFamily: "var(--font-nunito)" }}
        >
          Watcha
        </span>
        <span
          className="block text-[17px] font-bold text-[#E8621A] leading-[1.1]"
          style={{ fontFamily: "'Dancing Script', cursive" }}
        >
          wanna eat?
        </span>
      </div>

      {/* Right side: bell + optional share */}
      <div className="flex gap-[7px]">
        <div className="relative">
          <button className="w-9 h-9 rounded-[10px] bg-[#2A2420] flex items-center justify-center border-0 cursor-pointer">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <path
                d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          {hasNotification && (
            <div className="absolute top-[3px] right-[3px] w-2 h-2 rounded-full bg-[#E8621A] border-2 border-[#1C1A18]" />
          )}
        </div>

        {showShare && (
          <button className="w-9 h-9 rounded-[10px] bg-[#2A2420] flex items-center justify-center border-0 cursor-pointer">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <path
                d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
