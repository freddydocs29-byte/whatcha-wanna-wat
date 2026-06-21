"use client";

import { useEffect, useRef, useState } from "react";
import Avatar from "../Avatar";

export interface PersonV3 {
  id: string;
  /** Display label — first name preferred, "Someone" as fallback */
  name: string;
  /** Avatar image URL; null/undefined triggers initials or silhouette fallback */
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

  // Drop stale selections when people list changes
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
    // Sessions support exactly 1 guest — swap selection rather than accumulate
    const next = selected.includes(id) ? [] : [id];
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


  return (
    <>
      <div
        className="flex items-start overflow-x-auto shrink-0"
        style={{
          gap: 16,
          padding: "30px 30px 4px",
          scrollbarWidth: "none",
        } as React.CSSProperties}
      >
        {/* You — always selected, not toggleable */}
        <div className="flex flex-col items-center flex-shrink-0" style={{ gap: 9 }}>
          {/* Photo: 62×62 circle with presence ring + lighting overlay */}
          <div
            className="relative overflow-hidden"
            style={{
              width: 62,
              height: 62,
              borderRadius: "50%",
              background: "#251E1A",
              // Selected orange ring: inset separator + outer ring
              boxShadow:
                "0 8px 22px rgba(0,0,0,0.45), " +
                "0 0 22px rgba(232,98,26,0.28), " +
                "inset 0 0 0 2px rgba(11,8,5,0.9), " +
                "0 0 0 2px #E8621A",
            }}
          >
            <Avatar avatarUrl={avatarUrl} name={displayName} />

            {/* Portrait lighting overlay */}
            <div
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                background:
                  "radial-gradient(circle at 30% 22%, rgba(255,232,205,0.3) 0%, transparent 34%), " +
                  "radial-gradient(circle at 72% 92%, rgba(0,0,0,0.42) 0%, transparent 48%)",
              }}
            />

            {/* Host badge (✓) — bottom-right */}
            <div
              className="absolute flex items-center justify-center"
              style={{
                bottom: -1,
                right: -1,
                width: 19,
                height: 19,
                borderRadius: "50%",
                background: "#E8621A",
                border: "2px solid #0B0805",
                zIndex: 3,
                fontSize: 10,
                color: "#1a0d04",
                fontWeight: 700,
              }}
            >
              ✓
            </div>
          </div>
          <span
            style={{
              fontFamily: "var(--font-sans, Inter, system-ui)",
              fontWeight: 500,
              fontSize: 12,
              color: "#F6EEE2",
            }}
          >
            You
          </span>
        </div>

        {/* Partner avatars */}
        {people.map((person) => {
          const isSelected = selected.includes(person.id);
          return (
            <div
              key={person.id}
              className="flex flex-col items-center flex-shrink-0 cursor-pointer select-none"
              style={{ gap: 9 }}
              onPointerDown={() => handlePointerDown(person.id)}
              onPointerUp={() => handlePointerUp(person.id)}
              onPointerLeave={handlePointerLeave}
            >
              <div
                className="relative overflow-hidden transition-all"
                style={{
                  width: 62,
                  height: 62,
                  borderRadius: "50%",
                  background: "#251E1A",
                  boxShadow: isSelected
                    ? "0 8px 22px rgba(0,0,0,0.45), " +
                      "0 0 22px rgba(232,98,26,0.28), " +
                      "inset 0 0 0 2px rgba(11,8,5,0.9), " +
                      "0 0 0 2px #E8621A"
                    : "0 8px 20px rgba(0,0,0,0.45)",
                }}
              >
                <Avatar avatarUrl={person.avatarUrl} name={person.name} />

                {/* Portrait lighting overlay */}
                <div
                  className="absolute inset-0 rounded-full pointer-events-none"
                  style={{
                    background:
                      "radial-gradient(circle at 30% 22%, rgba(255,232,205,0.3) 0%, transparent 34%), " +
                      "radial-gradient(circle at 72% 92%, rgba(0,0,0,0.42) 0%, transparent 48%)",
                  }}
                />

                {/* Online badge — green dot, bottom-right */}
                <div
                  className="absolute flex items-center justify-center"
                  style={{
                    bottom: -1,
                    right: -1,
                    width: 19,
                    height: 19,
                    borderRadius: "50%",
                    background: "#0B0805",
                    border: "2px solid #0B0805",
                    zIndex: 3,
                  }}
                >
                  <span
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: "50%",
                      background: isSelected ? "#86A972" : "#574E45",
                      boxShadow: isSelected ? "0 0 8px rgba(134,169,114,0.7)" : "none",
                      display: "block",
                    }}
                  />
                </div>

                {/* Selected check overlay */}
                {isSelected && (
                  <div
                    className="absolute flex items-center justify-center"
                    style={{
                      bottom: -1,
                      right: -1,
                      width: 19,
                      height: 19,
                      borderRadius: "50%",
                      background: "#E8621A",
                      border: "2px solid #0B0805",
                      zIndex: 4,
                      fontSize: 9,
                      color: "white",
                      fontWeight: 700,
                    }}
                  >
                    ✓
                  </div>
                )}
              </div>
              <span
                style={{
                  fontFamily: "var(--font-sans, Inter, system-ui)",
                  fontWeight: 500,
                  fontSize: 12,
                  color: "#F6EEE2",
                  maxWidth: 62,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  textAlign: "center",
                }}
              >
                {person.name}
              </span>
            </div>
          );
        })}

        {/* Invite — dashed circle */}
        <div
          className="flex flex-col items-center flex-shrink-0 cursor-pointer"
          style={{ gap: 9 }}
          onClick={onInvite}
        >
          <div
            className="flex items-center justify-center"
            style={{
              width: 62,
              height: 62,
              borderRadius: "50%",
              background: "transparent",
              border: "1.5px dashed rgba(245,237,224,0.16)",
              fontSize: 26,
              color: "#897E73",
              fontWeight: 300,
            }}
          >
            +
          </div>
          <span
            style={{
              fontFamily: "var(--font-sans, Inter, system-ui)",
              fontWeight: 500,
              fontSize: 12,
              color: "#897E73",
            }}
          >
            Invite
          </span>
        </div>
      </div>

      {/* Long-press hide menu — preserved, rethemed */}
      {menuOpenForId && (
        <div
          className="fixed inset-0 z-50 flex items-end"
          style={{ backgroundColor: "rgba(0,0,0,0.60)" }}
          onPointerDown={() => setMenuOpenForId(null)}
        >
          <div
            className="w-full"
            style={{
              background: "#1A1714",
              borderTop: "1px solid rgba(245,237,224,0.085)",
              borderRadius: "20px 20px 0 0",
              padding: "22px 20px 44px",
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {menuPerson && (
              <p
                className="text-center"
                style={{
                  fontFamily: "var(--font-sans, Inter, system-ui)",
                  fontSize: 13,
                  color: "#897E73",
                  marginBottom: 20,
                }}
              >
                {menuPerson.name}
              </p>
            )}
            <button
              className="w-full rounded-[12px] text-[15px] font-semibold"
              style={{
                background: "#2A2724",
                color: "#FF6B6B",
                padding: "15px 0",
                marginBottom: 10,
                fontFamily: "var(--font-sans, Inter, system-ui)",
                border: "none",
                cursor: "pointer",
              }}
              onClick={() => handleHide(menuOpenForId)}
            >
              Hide from Home
            </button>
            <button
              className="w-full text-[15px] font-semibold"
              style={{
                background: "none",
                border: "none",
                color: "#897E73",
                padding: "15px 0",
                fontFamily: "var(--font-sans, Inter, system-ui)",
                cursor: "pointer",
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
