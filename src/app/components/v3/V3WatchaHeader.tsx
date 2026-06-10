"use client";

interface V3WatchaHeaderProps {
  hasNotification?: boolean;
  showShare?: boolean;
  onMenuClick?: () => void;
  onNotificationsClick?: () => void;
  onLogoClick?: () => void;
  onProfileClick?: () => void;
}

export default function V3WatchaHeader({
  hasNotification = false,
  showShare = false,
  onMenuClick,
  onNotificationsClick,
  onLogoClick,
  onProfileClick,
}: V3WatchaHeaderProps) {
  return (
    <div
      className="flex justify-between items-center shrink-0"
      style={{ padding: "max(env(safe-area-inset-top, 0px), 10px) 22px 6px" }}
    >
      {/* Hamburger — glass circle button */}
      <button
        onClick={onMenuClick}
        className="flex items-center justify-center cursor-pointer transition-transform active:scale-[0.93]"
        style={{
          width: 38,
          height: 38,
          borderRadius: "50%",
          background: "rgba(255,231,202,0.045)",
          border: "1px solid rgba(245,237,224,0.085)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          color: "#F6EEE2",
        }}
        aria-label="Open menu"
      >
        {/* Three-line hamburger with shorter middle */}
        <span className="flex flex-col gap-[3.5px]">
          <span style={{ display: "block", width: 15, height: 1.6, background: "currentColor", borderRadius: 2 }} />
          <span style={{ display: "block", width: 11, height: 1.6, background: "currentColor", borderRadius: 2 }} />
          <span style={{ display: "block", width: 15, height: 1.6, background: "currentColor", borderRadius: 2 }} />
        </span>
      </button>

      {/* Wordmark — tappable, routes Home */}
      <button
        onClick={onLogoClick}
        className="flex flex-col items-center cursor-pointer transition-transform active:scale-[0.95]"
        style={{ lineHeight: 0.82, background: "none", border: "none", padding: 0 }}
        aria-label="Go home"
      >
        <span
          style={{
            fontFamily: "var(--font-quicksand)",
            fontWeight: 700,
            fontSize: 23,
            color: "#F6EEE2",
            letterSpacing: "-0.01em",
            lineHeight: 1,
          }}
        >
          Watcha
        </span>
        <span
          style={{
            fontFamily: "var(--font-instrument-serif)",
            fontStyle: "italic",
            fontWeight: 400,
            fontSize: 15,
            color: "#E8621A",
            marginTop: 1,
            lineHeight: 1.1,
          }}
        >
          wanna eat?
        </span>
      </button>

      {/* Right side: profile + bell + optional share */}
      <div className="flex gap-[7px]">
        {onProfileClick && (
          <button
            onClick={onProfileClick}
            className="flex items-center justify-center cursor-pointer transition-transform active:scale-[0.93]"
            style={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              background: "rgba(255,231,202,0.045)",
              border: "1px solid rgba(245,237,224,0.085)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              color: "#F6EEE2",
            }}
            aria-label="Go to profile"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
          </button>
        )}

        <div className="relative">
          <button
            onClick={onNotificationsClick}
            className="flex items-center justify-center cursor-pointer transition-transform active:scale-[0.93]"
            style={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              background: "rgba(255,231,202,0.045)",
              border: "1px solid rgba(245,237,224,0.085)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              color: "#F6EEE2",
            }}
            aria-label="Open notifications"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <path
                d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          {hasNotification && (
            <div
              className="absolute"
              style={{
                top: 7,
                right: 7,
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#E8621A",
                boxShadow: "0 0 7px rgba(232,98,26,0.5)",
                border: "1.5px solid #0B0805",
              }}
            />
          )}
        </div>

        {showShare && (
          <button
            className="flex items-center justify-center cursor-pointer transition-transform active:scale-[0.93]"
            style={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              background: "rgba(255,231,202,0.045)",
              border: "1px solid rgba(245,237,224,0.085)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              color: "#F6EEE2",
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <path
                d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                stroke="currentColor"
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
