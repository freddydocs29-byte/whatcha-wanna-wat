"use client";

import { useState } from "react";
import type { Meal } from "../../data/meals";

type GeneratedMeal = Omit<Meal, "image"> & { image: "" };
type Decision = "approved" | "rejected";

const CUISINES = [
  "American", "Breakfast", "Caribbean", "Chinese", "French",
  "Greek", "Indian", "Indonesian", "Italian", "Japanese",
  "Korean", "Mediterranean", "Mexican", "Middle Eastern",
  "Moroccan", "Spanish", "Thai", "Vietnamese",
];

export default function AdminGenerateMeals() {
  const [cuisine, setCuisine] = useState("Italian");
  const [count, setCount] = useState(10);
  const [meals, setMeals] = useState<GeneratedMeal[]>([]);
  const [decisions, setDecisions] = useState<Record<number, Decision>>({});
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const generated = meals.length;
  const approved = Object.values(decisions).filter((d) => d === "approved").length;
  const rejected = Object.values(decisions).filter((d) => d === "rejected").length;
  const pending = generated - approved - rejected;

  async function handleGenerate() {
    setLoading(true);
    setStatus("Generating...");
    try {
      const res = await fetch("/api/admin/generate-meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cuisine, count }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setStatus(`Error: ${data.error ?? res.statusText}`);
        return;
      }
      const newMeals: GeneratedMeal[] = data.meals;
      setMeals((prev) => {
        const startIdx = prev.length;
        // decisions are indexed by position in the meals array — no offset needed
        // new meals are appended, existing indices unchanged
        void startIdx;
        return [...prev, ...newMeals];
      });
      setStatus(`Generated ${newMeals.length} meals.`);
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : "Unknown"}`);
    } finally {
      setLoading(false);
    }
  }

  function decide(idx: number, decision: Decision) {
    setDecisions((prev) => ({ ...prev, [idx]: decision }));
  }

  function approveAllPending() {
    setDecisions((prev) => {
      const next = { ...prev };
      meals.forEach((_, i) => {
        if (!next[i]) next[i] = "approved";
      });
      return next;
    });
  }

  async function handleWrite() {
    const approvedMeals = meals.filter((_, i) => decisions[i] === "approved");
    if (approvedMeals.length === 0) return;

    setStatus("Writing to meals.ts...");
    try {
      const res = await fetch("/api/admin/write-meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meals: approvedMeals }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setStatus(`Error: ${data.error ?? res.statusText}`);
        return;
      }

      // Remove written meals from the list, keep rejected ones
      const approvedIndices = new Set(
        meals.map((_, i) => i).filter((i) => decisions[i] === "approved")
      );
      setMeals((prev) => prev.filter((_, i) => !approvedIndices.has(i)));
      setDecisions((prev) => {
        const next: Record<number, Decision> = {};
        let newIdx = 0;
        meals.forEach((_, oldIdx) => {
          if (!approvedIndices.has(oldIdx)) {
            if (prev[oldIdx]) next[newIdx] = prev[oldIdx];
            newIdx++;
          }
        });
        return next;
      });

      setStatus(`✓ Wrote ${data.count} meals to meals.ts.`);
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : "Unknown"}`);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 font-mono text-sm">
      <h1 className="text-lg font-semibold text-gray-500 mb-6">Meal generator</h1>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-end mb-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Cuisine</label>
          <select
            value={cuisine}
            onChange={(e) => setCuisine(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          >
            {CUISINES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Count</label>
          <input
            type="number"
            min={5}
            max={20}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="border border-gray-300 rounded px-2 py-1 w-20 text-sm"
          />
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="bg-gray-800 text-white px-4 py-1.5 rounded text-sm disabled:opacity-50"
        >
          {loading ? "Generating..." : "Generate"}
        </button>
      </div>

      {/* Stats */}
      {generated > 0 && (
        <div className="flex gap-6 text-xs text-gray-500 mb-2 border-b border-gray-200 pb-2">
          <span>Generated: <strong className="text-gray-800">{generated}</strong></span>
          <span>Approved: <strong className="text-green-700">{approved}</strong></span>
          <span>Rejected: <strong className="text-red-600">{rejected}</strong></span>
          <span>Pending: <strong className="text-gray-800">{pending}</strong></span>
        </div>
      )}

      {/* Status */}
      {status && (
        <p className="text-xs text-gray-600 mb-4">{status}</p>
      )}

      {/* Meal cards */}
      <div className="flex flex-col gap-3 mb-6">
        {meals.map((meal, i) => {
          const decision = decisions[i];
          return (
            <div
              key={`${meal.id}-${i}`}
              className={[
                "border rounded p-3",
                decision === "approved" ? "border-l-4 border-l-green-500 border-gray-200" : "",
                decision === "rejected" ? "border-l-4 border-l-red-500 border-gray-200 opacity-50" : "",
                !decision ? "border-gray-200" : "",
              ].join(" ")}
            >
              <div className="flex justify-between items-start mb-1">
                <span className="font-semibold text-white">{meal.name}</span>
                <div className="flex gap-2 ml-4 shrink-0">
                  <button
                    onClick={() => decide(i, "approved")}
                    className={`text-xs px-2 py-0.5 rounded border ${
                      decision === "approved"
                        ? "bg-green-100 border-green-500 text-green-800"
                        : "border-green-500 text-green-700 hover:bg-green-50"
                    }`}
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => decide(i, "rejected")}
                    className={`text-xs px-2 py-0.5 rounded border ${
                      decision === "rejected"
                        ? "bg-red-100 border-red-500 text-red-800"
                        : "border-red-500 text-red-700 hover:bg-red-50"
                    }`}
                  >
                    Reject
                  </button>
                </div>
              </div>

              <p className="text-xs text-gray-500 mb-1">
                {meal.cuisine} · {meal.category}
              </p>

              <div className="flex flex-wrap gap-1 mb-2">
                {meal.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <p className="text-sm text-gray-700 mb-1">{meal.description}</p>
              <p className="text-xs text-gray-400 italic mb-1">{meal.whyItFits}</p>

              {meal.ingredients && meal.ingredients.length > 0 && (
                <p className="text-xs text-gray-400">
                  {meal.ingredients.join(", ")}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Action row */}
      {generated > 0 && (
        <div className="flex gap-3 flex-wrap border-t border-gray-200 pt-4">
          <button
            onClick={handleWrite}
            disabled={approved === 0}
            className="bg-green-700 text-white px-4 py-1.5 rounded text-sm disabled:opacity-40"
          >
            Write approved to meals.ts ({approved})
          </button>
          <button
            onClick={approveAllPending}
            disabled={pending === 0}
            className="border border-gray-400 text-gray-700 px-4 py-1.5 rounded text-sm disabled:opacity-40"
          >
            Approve all pending ({pending})
          </button>
        </div>
      )}
    </div>
  );
}
