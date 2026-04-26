"use client";

import { type Meal } from "../data/meals";
import { addToHistory, getHistory } from "../lib/storage";
import { trackEvent } from "../lib/analytics";

function recordIfNew(meal: Meal) {
  const today = new Date().toLocaleDateString();
  const alreadyToday = getHistory().some(
    (e) =>
      e.meal.id === meal.id &&
      new Date(e.chosenAt).toLocaleDateString() === today,
  );
  if (!alreadyToday) addToHistory(meal);
}

type Props = {
  meal: Meal;
  recipeQuery: string;
};

export default function CookOrderButtons({ meal, recipeQuery }: Props) {
  return (
    <>
      <a
        href={`https://www.google.com/search?q=${recipeQuery}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => { recordIfNew(meal); trackEvent("cook_clicked", { mealId: meal.id }); }}
        className="rounded-full bg-white px-5 py-4 text-center text-base font-semibold text-black"
      >
        Cook it
      </a>

      <a
        href={`https://www.google.com/search?q=${encodeURIComponent(meal.name + " near me")}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => { recordIfNew(meal); trackEvent("order_clicked", { mealId: meal.id }); }}
        className="rounded-full border border-white/10 bg-white/[0.05] px-5 py-4 text-center text-base font-medium text-white"
      >
        Order it
      </a>
    </>
  );
}
