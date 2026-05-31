"use client";

import Image from "next/image";
import { useState } from "react";

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
  avatarUrl?: string | null;
  displayName?: string | null;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const AvatarSilhouette = () => (
  <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
    <circle cx="15" cy="10" r="5.5" fill="#5A5350" />
    <path d="M2 28c0-7.18 5.82-13 13-13s13 5.82 13 13" fill="#5A5350" />
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
  // Use initials if the name is a real name (not the "Someone" fallback)
  if (person.name && person.name !== "Someone") {
    return (
      <span
        className="text-[18px] font-black text-white"
        style={{ fontFamily: "var(--font-nunito)" }}
      >
        {getInitials(person.name)}
      </span>
    );
  }
  // Anonymous / unknown partner
  return (
    <span
      className="text-[22px] font-black text-[#8A7F78]"
      style={{ fontFamily: "var(--font-nunito)" }}
    >
      ?
    </span>
  );
}

export default function V3PeopleSelector({
  people = [],
  onChange,
  onInvite,
  avatarUrl,
  displayName,
}: V3PeopleSelectorProps) {
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) => {
    const next = selected.includes(id)
      ? selected.filter((s) => s !== id)
      : [...selected, id];
    setSelected(next);
    onChange?.(next);
  };

  const initials = displayName ? getInitials(displayName) : null;

  return (
    <div className="flex gap-[10px] px-[18px] mb-[14px] overflow-x-auto items-start shrink-0">
      {/* You — always selected, not togglable */}
      <div className="flex flex-col items-center gap-[5px] shrink-0">
        <div className="w-[58px] h-[58px] rounded-full bg-[#2A2420] flex items-center justify-center relative overflow-hidden border-[2.5px] border-[#E8621A]">
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
              className="text-[18px] font-black text-white"
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
          className="text-[11px] text-[#8A7F78] font-medium"
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
            className="flex flex-col items-center gap-[5px] shrink-0 cursor-pointer"
            onClick={() => toggle(person.id)}
          >
            <div
              className={`w-[58px] h-[58px] rounded-full bg-[#2A2420] flex items-center justify-center relative overflow-hidden border-[2.5px] transition-colors ${
                isSelected ? "border-[#E8621A]" : "border-transparent"
              }`}
            >
              <PartnerAvatar person={person} />
              {isSelected && (
                <div className="absolute bottom-[1px] right-[1px] w-[17px] h-[17px] rounded-full bg-[#E8621A] border-2 border-[#1C1A18] flex items-center justify-center text-[9px] text-white font-bold">
                  ✓
                </div>
              )}
            </div>
            <span
              className="text-[11px] text-[#8A7F78] font-medium max-w-[58px] truncate text-center"
              style={{ fontFamily: "var(--font-manrope)" }}
            >
              {person.name}
            </span>
          </div>
        );
      })}

      {/* Invite */}
      <div
        className="flex flex-col items-center gap-[5px] shrink-0 cursor-pointer"
        onClick={onInvite}
      >
        <div className="w-[58px] h-[58px] rounded-full bg-transparent border-2 border-dashed border-[#3D3733] flex items-center justify-center text-[22px] text-[#8A7F78]">
          +
        </div>
        <span
          className="text-[11px] text-[#8A7F78] font-medium"
          style={{ fontFamily: "var(--font-manrope)" }}
        >
          Invite
        </span>
      </div>
    </div>
  );
}
