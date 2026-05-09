import { meals } from "../data/meals";
import SoloMatchClient from "./SoloMatchClient";

type Props = {
  searchParams: Promise<{ mealId?: string; pantry?: string }>;
};

export default async function SoloMatchPage({ searchParams }: Props) {
  const { mealId } = await searchParams;
  const meal = meals.find((m) => m.id === mealId) ?? meals[0];

  const isQuickOrEasy = meal.tags.some((t) =>
    ["easy", "15 min", "20 min", "25 min"].some((k) => t.toLowerCase().includes(k))
  );
  const recipeQuery = encodeURIComponent(
    `${meal.name} ${isQuickOrEasy ? "easy" : "quick"} recipe`
  );

  return <SoloMatchClient meal={meal} recipeQuery={recipeQuery} />;
}
