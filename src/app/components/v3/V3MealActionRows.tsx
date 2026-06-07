export interface MealAction {
  icon: string;
  title: string;
  sub: string;
  onClick?: () => void;
}

interface V3MealActionRowsProps {
  actions?: MealAction[];
  mealName?: string;
}

export default function V3MealActionRows({
  actions,
  mealName = "Tikka Masala",
}: V3MealActionRowsProps) {
  const defaultActions: MealAction[] = [
    {
      icon: "🔍",
      title: "View meal details",
      sub: "Ingredients, recipe, match context",
    },
    {
      icon: "💾",
      title: "Save this meal",
      sub: `Add ${mealName} to favorites`,
    },
    {
      icon: "🔄",
      title: "Change my mind",
      sub: "Start a new session",
    },
  ];

  const rows = actions ?? defaultActions;

  return (
    <div className="flex flex-col gap-2 px-[14px] mb-3 shrink-0">
      {rows.map((action, i) => (
        <button
          key={i}
          onClick={action.onClick}
          className="flex items-center gap-3 px-[14px] py-3 bg-[#2A2420] rounded-[14px] cursor-pointer border border-white/[0.04] text-left w-full transition-colors hover:bg-white/[0.04]"
        >
          <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-[17px] shrink-0"
            style={{ background: "rgba(255,231,202,0.06)", border: "1px solid rgba(245,237,224,0.07)" }}
          >
            {action.icon}
          </div>
          <div className="flex-1">
            <div
              className="text-[13px] font-black text-white"
              style={{ fontFamily: "var(--font-nunito)" }}
            >
              {action.title}
            </div>
            <div
              className="text-[11px] text-[#8A7F78]"
              style={{ fontFamily: "var(--font-manrope)" }}
            >
              {action.sub}
            </div>
          </div>
          <div className="text-base text-[#5A5350]">›</div>
        </button>
      ))}
    </div>
  );
}
