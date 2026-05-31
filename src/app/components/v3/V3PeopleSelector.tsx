"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export interface PersonV3 {
  id: string;
  /** Display label — first name preferred, "Someone" as fallback */
  name: string;
  /** Avatar image URL; null/undefined triggers initials or "?" fallback */
  avatarUrl?: string | null;
}

interface V3PeopleSelectorProps {
  people?: PersonV3[];
  onChange?: (selectedIds: string[]) => void;
  onInvite?: () => void;
  onHidePartner?: (id: string) => void;
  avatarUrl?: string | null;
  displayName?: string | null;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const AvatarSilhouette = () => (
  <svg width="28" height="28" viewBox="0 0 30 30" fill="none">
    <circle cx="15" cy="10" r="5.5" fill="#4A3F3A" />
    <path d="M2 28c0-7.18 5.82-13 13-13s13 5.82 13 13" fill="#4A3F3A" />
  </svg>
);

function PartnerAvatar({ person }: { person: PersonV3 }) {
  if (person.avatarUrl) {
    return (
      <Image
        src={person.avatarUrl}
        alt={person.name}
        fill
        className="object-cover"
        unoptimized
      />
    );
  }
  if (person.name && person.name !== "Someone" && person.name !== "Recent") {
    return (
      <span
        className="text-[17px] font-black text-white"
        style={{ fontFamily: "var(--font-nunito)" }}
      >
        {getInitials(person.name)}
      </span>
    );
  }
  // Anonymous / unknown partner — tasteful silhouette
  return <AvatarSilhouette />;
}

export default function V3PeopleSelector({
  people = [],
  onChange,
  onInvite,
  onHidePartner,
  avatarUrl,
  displayName,
}: V3PeopleSelectorProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [menuOpenForId, setMenuOpenForId] = useState<string | null>(null);
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);

  // When the people list changes (e.g. a partner is hidden), drop any stale
  // selections that no longer exist in the list.
  useEffect(() => {
    const validIds = new Set(people.map((p) => p.id));
    const next = selected.filter((id) => validIds.has(id));
    if (next.length !== selected.length) {
      setSelected(next);
      onChange?.(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people]);

  const toggle = (id: string) => {
    const next = selected.includes(id)
      ? selected.filter((s) => s !== id)
      : [...selected, id];
    setSelected(next);
    onChange?.(next);
  };

  const handlePointerDown = (id: string) => {
    longPressTriggeredRef.current = false;
    pressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      setMenuOpenForId(id);
    }, 500);
  };

  const handlePointerUp = (id: string) => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    if (!longPressTriggeredRef.current) {
      toggle(id);
    }
  };

  const handlePointerLeave = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const handleHide = (id: string) => {
    setMenuOpenForId(null);
    onHidePartner?.(id);
  };

  const menuPerson = menuOpenForId
    ? people.find((p) => p.id === menuOpenForId)
    : null;

  const initials = displayName ? getInitials(displayName) : null;

  return (
    <>
      <div
        className="flex gap-[12px] px-[18px] mb-[16px] overflow-x-auto items-start shrink-0"
        style={{ scrollbarWidth: "none" } as React.CSSProperties}
      >
        {/* You — always selected, not togglable, not hideable */}
        <div className="flex flex-col items-center gap-[6px] shrink-0">
          <div
            className="w-[60px] h-[60px] rounded-full bg-[#251E1A] flex items-center justify-center relative overflow-hidden border-[2.5px] border-[#E8621A]"
            style={{ boxShadow: "0 0 12px rgba(232,98,26,0.30)" }}
          >
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={displayName ?? "You"}
                fill
                className="object-cover"
                unoptimized
              />
            ) : initials ? (
              <span
                className="text-[17px] font-black text-white"
                style={{ fontFamily: "var(--font-nunito)" }}
              >
                {initials}
              </span>
            ) : (
              <AvatarSilhouette />
            )}
            {/* "P" primary badge bottom-left */}
            <div
              className="absolute bottom-[1px] left-[1px] w-[15px] h-[15px] rounded-full bg-[#E8621A] border-2 border-[#1C1A18] flex items-center justify-center text-[7px] text-white font-extrabold"
              style={{ fontFamily: "var(--font-manrope)" }}
            >
              P
            </div>
            {/* Check badge bottom-right */}
            <div className="absolute bottom-[1px] right-[1px] w-[17px] h-[17px] rounded-full bg-[#E8621A] border-2 border-[#1C1A18] flex items-center justify-center text-[9px] text-white font-bold">
              ✓
            </div>
          </div>
          <span
            className="text-[11px] text-[#6A6260] font-semibold"
            style={{ fontFamily: "var(--font-manrope)" }}
          >
            You
          </span>
        </div>

        {/* Recent partners from partner_relationships */}
        {people.map((person) => {
          const isSelected = selected.includes(person.id);
          return (
            <div
              key={person.id}
              className="flex flex-col items-center gap-[6px] shrink-0 cursor-pointer select-none"
              onPointerDown={() => handlePointerDown(person.id)}
              onPointerUp={() => handlePointerUp(person.id)}
              onPointerLeave={handlePointerLeave}
            >
              <div
                className={`w-[60px] h-[60px] rounded-full bg-[#251E1A] flex items-center justify-center relative overflow-hidden border-[2.5px] transition-all ${
                  isSelected ? "border-[#E8621A]" : "border-[#302A26]"
                }`}
                style={
                  isSelected
                    ? { boxShadow: "0 0 10px rgba(232,98,26,0.25)" }
                    : {}
                }
              >
                <PartnerAvatar person={person} />
                {isSelected && (
                  <div className="absolute bottom-[1px] right-[1px] w-[17px] h-[17px] rounded-full bg-[#E8621A] border-2 border-[#1C1A18] flex items-center justify-center text-[9px] text-white font-bold">
                    ✓
                  </div>
                )}
              </div>
              <span
                className="text-[11px] text-[#6A6260] font-semibold max-w-[60px] truncate text-center"
                style={{ fontFamily: "var(--font-manrope)" }}
              >
                {person.name}
              </span>
            </div>
          );
        })}

        {/* Invite — not hideable */}
        <div
          className="flex flex-col items-center gap-[6px] shrink-0 cursor-pointer"
          onClick={onInvite}
        >
          <div className="w-[60px] h-[60px] rounded-full bg-transparent border-[2px] border-dashed border-[#3A3330] flex items-center justify-center text-[20px] text-[#5A5250]">
            +
          </div>
          <span
            className="text-[11px] text-[#6A6260] font-semibold"
            style={{ fontFamily: "var(--font-manrope)" }}
          >
            Invite
          </span>
        </div>
      </div>

      {/* Long-press hide menu */}
      {menuOpenForId && (
        <div
          className="fixed inset-0 z-50 flex items-end"
          style={{ backgroundColor: "rgba(0,0,0,0.60)" }}
          onPointerDown={() => setMenuOpenForId(null)}
        >
          <div
            className="w-full rounded-t-[20px] px-[20px] pt-[22px] pb-[44px]"
            style={{ backgroundColor: "#242220", borderTop: "1px solid rgba(255,255,255,0.06)" }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {menuPerson && (
              <p
                className="text-center text-[13px] mb-[20px]"
                style={{
                  fontFamily: "var(--font-manrope)",
                  color: "#6A6260",
                }}
              >
                {menuPerson.name}
              </p>
            )}
            <button
              className="w-full py-[15px] rounded-[12px] text-[15px] font-semibold mb-[10px]"
              style={{
                fontFamily: "var(--font-manrope)",
                backgroundColor: "#2E2B29",
                color: "#FF6B6B",
              }}
              onClick={() => handleHide(menuOpenForId)}
            >
              Hide from Home
            </button>
            <button
              className="w-full py-[15px] text-[15px] font-semibold"
              style={{
                fontFamily: "var(--font-manrope)",
                color: "#6A6260",
                background: "none",
              }}
              onClick={() => setMenuOpenForId(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
