import { meals } from "../data/meals";
import LockedPageClient from "./LockedPageClient";

type Props = {
  searchParams: Promise<{ mealId?: string; pantry?: string; decided?: string }>;
};

export default async function LockedPage({ searchParams }: Props) {
  const { mealId, pantry, decided } = await searchParams;
  const meal = meals.find((m) => m.id === mealId) ?? meals[0];
  const pickedForYou = decided === "1";

  const isQuickOrEasy = meal.tags.some((t) =>
    ["easy", "15 min", "20 min", "25 min"].some((k) => t.toLowerCase().includes(k))
  );
  const recipeQuery = encodeURIComponent(
    `${meal.name} ${isQuickOrEasy ? "easy" : "quick"} recipe`
  );

  return (
    <LockedPageClient
      meal={meal}
      recipeQuery={recipeQuery}
      pickedForYou={pickedForYou}
    />
  );
}
