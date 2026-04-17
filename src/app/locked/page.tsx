import Link from "next/link";
import { meals } from "../data/meals";
import ShareButton from "./ShareButton";
import SaveLaterButton from "./SaveLaterButton";
import LockedReveal from "./LockedReveal";
import BackButton from "./BackButton";

type Props = {
  searchParams: Promise<{ mealId?: string; pantry?: string }>;
};

export default async function LockedPage({ searchParams }: Props) {
  const { mealId, pantry } = await searchParams;
  const meal = meals.find((m) => m.id === mealId) ?? meals[0];
  const pantryMode = pantry === "1";

  const isQuickOrEasy = meal.tags.some((t) =>
    ["easy", "15 min", "20 min", "25 min"].some((k) => t.toLowerCase().includes(k))
  );
  const recipeQuery = encodeURIComponent(
    `${meal.name} ${isQuickOrEasy ? "easy" : "quick"} recipe`
  );

  return (
    <main className="min-h-screen bg-[#080808] px-5 pb-6 safe-top text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">
        <header className="flex items-center justify-between">
          <p className="text-sm text-white/50">Decision Deck</p>
          <BackButton />
        </header>

        <LockedReveal meal={meal} pantryMode={pantryMode} />

        <section className="mt-8 rounded-[34px] border border-white/10 bg-gradient-to-b from-white/[0.12] via-white/[0.07] to-white/[0.04] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
          <div className="flex items-start justify-between">
            <p className="text-sm text-white/50">Good choice</p>
            <SaveLaterButton meal={meal} />
          </div>
          <h2 className="mt-2 text-[28px] font-semibold tracking-[-0.04em]">
            What&apos;s next?
          </h2>

          <div className="mt-4 flex flex-wrap gap-2">
            {meal.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-white/60"
              >
                {tag}
              </span>
            ))}
          </div>

          <div className="mt-6 grid gap-3">
            <a
              href={`https://www.google.com/search?q=${recipeQuery}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-white px-5 py-4 text-center text-base font-semibold text-black"
            >
              Cook it
            </a>

            <a
              href={`https://www.google.com/search?q=${encodeURIComponent(meal.name + " near me")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-white/10 bg-white/[0.05] px-5 py-4 text-center text-base font-medium text-white"
            >
              Order it
            </a>

            <ShareButton mealName={meal.name} />

            <Link
              href="/"
              className="rounded-full border border-white/10 bg-transparent px-5 py-4 text-center text-base font-medium text-white/70"
            >
              Done
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
