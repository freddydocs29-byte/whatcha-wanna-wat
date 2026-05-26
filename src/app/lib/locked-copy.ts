import { Meal } from "../data/meals";
import { HistoryEntry } from "./storage";

const SEEN_KEY = "wwe_locked_headlines_seen";
const SEEN_LIMIT = 15;

export interface LockedMealHeadlineResult {
  headline: string;
  subheadline: string;
  variantId: string;
}

interface HeadlineInput {
  meal: Meal;
  userName?: string | null;
  mode: "shared" | "solo";
  history: HistoryEntry[];
}

// ─── Seen-variant persistence ────────────────────────────────────────────────

function getSeenVariants(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function recordVariant(variantId: string): void {
  if (typeof window === "undefined") return;
  const seen = getSeenVariants();
  const updated = [variantId, ...seen.filter((v) => v !== variantId)].slice(
    0,
    SEEN_LIMIT
  );
  localStorage.setItem(SEEN_KEY, JSON.stringify(updated));
}

// ─── Pick helper — excludes recently seen, resets if pool exhausted ──────────

function pick<T extends { variantId: string }>(
  pool: T[],
  seen: string[]
): T {
  const eligible = pool.filter((v) => !seen.includes(v.variantId));
  const source = eligible.length > 0 ? eligible : pool;
  return source[Math.floor(Math.random() * source.length)];
}

// ─── Subheadlines ─────────────────────────────────────────────────────────────

const SUBHEADLINES = [
  "Stop thinking about it.",
  "Tonight's sorted.",
  "Done. Go eat.",
  "The debate is over.",
  "Dinner: handled.",
  "Lock it in.",
  "Your stomach already knows.",
  "No second-guessing.",
];

function randomSubheadline(): string {
  return SUBHEADLINES[Math.floor(Math.random() * SUBHEADLINES.length)];
}

// ─── Cuisine detection via keyword matching ───────────────────────────────────

function detectCuisineCategory(meal: Meal): string | null {
  const text = `${meal.name} ${(meal.tags ?? []).join(' ')}`.toLowerCase()

  if (/taco|enchilada|burrito|quesadilla|carnitas|salsa|guac/.test(text)) return 'mexican'
  if (/pasta|pizza|risotto|lasagna|carbonara|marinara|gnocchi/.test(text)) return 'italian'
  if (/ramen|sushi|pho|pad thai|curry|stir.?fry|noodle|dumpling|wonton/.test(text)) return 'asian'
  if (/burger|sandwich|hot dog|bbq|wings|fried chicken|mac.*cheese/.test(text)) return 'american'
  if (/salad|bowl|grain|quinoa|kale|arugula/.test(text)) return 'healthy'
  if (/soup|stew|chili|casserole|pot roast|comfort/.test(text)) return 'comfort'

  return null
}

// ─── Category 1 — Ritual / repeat ────────────────────────────────────────────

type RitualMatch =
  | { type: "meal"; mealName: string }
  | { type: "cuisine"; cuisine: string };

function matchesRitual(meal: Meal, history: HistoryEntry[]): RitualMatch | null {
  if (history.length < 2) return null;
  const recent = history.slice(0, 7);
  const mealName = meal.name.toLowerCase();
  const cuisineCategory = detectCuisineCategory(meal);
  let nameCount = 0;
  let cuisineCount = 0;
  for (const entry of recent) {
    if (entry.meal.name.toLowerCase() === mealName) nameCount++;
    if (cuisineCategory && detectCuisineCategory(entry.meal) === cuisineCategory) cuisineCount++;
  }
  // Exact meal match takes priority over cuisine match
  if (nameCount >= 2) return { type: "meal", mealName: meal.name };
  if (cuisineCategory && cuisineCount >= 2) return { type: "cuisine", cuisine: cuisineCategory };
  return null;
}

function getRitualLines(
  match: RitualMatch,
  firstName: string
): Array<{ text: string; variantId: string; usesName: boolean }> {
  const lines: Array<{ text: string; variantId: string; usesName: boolean }> = [];

  if (match.type === "meal") {
    lines.push(
      { text: `You've had ${match.mealName} before. Still the right call.`, variantId: "ritual-meal-repeat", usesName: false },
      { text: `${match.mealName} again. No complaints.`, variantId: "ritual-meal-again", usesName: false },
      { text: `${firstName}, ${match.mealName} again? Consistent.`, variantId: "ritual-meal-name", usesName: true },
    );
  } else {
    lines.push(
      { text: `You keep coming back to ${match.cuisine}. Makes sense.`, variantId: "ritual-cuisine-repeat", usesName: false },
      { text: `${match.cuisine} again this week. The pull is real.`, variantId: "ritual-cuisine-again", usesName: false },
      { text: `${firstName}, ${match.cuisine} again? No notes.`, variantId: "ritual-cuisine-name", usesName: true },
    );
  }

  // Generic fallbacks always in the pool
  lines.push(
    { text: "Back to your usual. Respect.", variantId: "ritual-usual", usesName: false },
    { text: "Some things just keep working.", variantId: "ritual-keep-working", usesName: false },
    { text: "The streak continues.", variantId: "ritual-streak", usesName: false },
  );

  return lines;
}

// ─── Category 2 — Shared mode ─────────────────────────────────────────────────

const SHARED_LINES: Array<{ text: string; variantId: string }> = [
  { text: "Y'all finally agreed. That's the win.", variantId: "shared-agreed" },
  { text: "A rare moment of food alignment.", variantId: "shared-alignment" },
  { text: "No debate. No committee. Just dinner.", variantId: "shared-no-debate" },
  { text: "The group chat can rest now.", variantId: "shared-group-chat" },
  { text: "Both said yes. That's all that matters.", variantId: "shared-both-yes" },
];

// ─── Category 3 — Time / day context ─────────────────────────────────────────

interface TimeLine { text: string; variantId: string }

function getTimeLines(): TimeLine[] | null {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay(); // 0=Sun, 5=Fri, 6=Sat

  if (hour >= 21) {
    return [
      { text: "Late night. Low effort. Good call.", variantId: "time-late-low-effort" },
      { text: "Night mode: activated.", variantId: "time-night-mode" },
      { text: "The late night pick always hits different.", variantId: "time-late-hits" },
    ];
  }
  if (day === 5) {
    return [
      { text: "Feels like a Friday comfort move.", variantId: "time-friday-comfort" },
      { text: "Friday said treat yourself. You listened.", variantId: "time-friday-treat" },
    ];
  }
  if (day === 0) {
    return [
      { text: "Sunday food should feel like this.", variantId: "time-sunday-feel" },
      { text: "The right Sunday move.", variantId: "time-sunday-move" },
    ];
  }
  if (day >= 1 && day <= 4) {
    return [
      { text: "Weeknight problem, solved.", variantId: "time-weeknight-solved" },
      { text: "Quick decision. Good decision.", variantId: "time-weeknight-quick" },
    ];
  }
  return null;
}

// ─── Category 4 — Meal / cuisine specific ────────────────────────────────────

function getCuisineLines(meal: Meal): Array<{ text: string; variantId: string }> | null {
  const name = meal.name.toLowerCase();
  const cuisine = meal.cuisine.toLowerCase();
  const tags = meal.tags.map((t) => t.toLowerCase());

  const has = (...terms: string[]) =>
    terms.some((t) => name.includes(t) || cuisine.includes(t) || tags.includes(t));

  if (has("taco", "mexican", "burrito")) {
    return [
      { text: "Tacos never miss.", variantId: "cuisine-tacos-never-miss" },
      { text: "The answer was always tacos.", variantId: "cuisine-tacos-answer" },
      { text: "Tacos picked. Good.", variantId: "cuisine-tacos-picked" },
      { text: "Some decisions make themselves.", variantId: "cuisine-tacos-decisions" },
      { text: "Taco night. No notes.", variantId: "cuisine-tacos-no-notes" },
      { text: "The craving was right.", variantId: "cuisine-tacos-craving" },
    ];
  }
  if (has("pasta", "italian", "lasagna", "spaghetti", "fettuccine", "penne", "alfredo")) {
    return [
      { text: "Pasta picked. Respect.", variantId: "cuisine-pasta-picked" },
      { text: "The carbs chose wisely.", variantId: "cuisine-carbs-wisely" },
      { text: "Comfort in carb form. Correct.", variantId: "cuisine-carbs-comfort" },
      { text: "Pasta always makes sense.", variantId: "cuisine-pasta-sense" },
      { text: "No notes on this one.", variantId: "cuisine-pasta-no-notes" },
    ];
  }
  if (has("ramen", "pho", "noodle", "udon", "soba", "japanese", "korean", "chinese", "thai", "vietnamese")) {
    return [
      { text: "Bold pick. Good pick.", variantId: "cuisine-noodle-bold" },
      { text: "Noodles win every time.", variantId: "cuisine-noodle-win" },
      { text: "Broth season. Always.", variantId: "cuisine-broth-season" },
      { text: "That bowl is going to hit.", variantId: "cuisine-bowl-hit" },
      { text: "Exactly what tonight needed.", variantId: "cuisine-noodle-needed" },
    ];
  }
  if (has("burger", "smash", "cheeseburger", "sandwich")) {
    return [
      { text: "Classic. No notes.", variantId: "cuisine-burger-classic" },
      { text: "Solid. Dependable. Correct.", variantId: "cuisine-burger-solid" },
      { text: "Sometimes the obvious answer is right.", variantId: "cuisine-burger-obvious" },
      { text: "Can't go wrong with this one.", variantId: "cuisine-burger-no-wrong" },
    ];
  }
  if (has("salad", "healthy", "grain bowl", "acai", "green")) {
    return [
      { text: "Look at you.", variantId: "cuisine-look-at-you" },
      { text: "Body said yes. Brain agreed.", variantId: "cuisine-body-brain-yes" },
      { text: "Eating well tonight.", variantId: "cuisine-eating-well" },
      { text: "Light but right.", variantId: "cuisine-light-right" },
    ];
  }
  if (has("comfort", "mac and cheese", "mac & cheese", "soup", "stew", "casserole", "meatloaf")) {
    return [
      { text: "Exactly right for tonight.", variantId: "cuisine-comfort-exact" },
      { text: "Some nights need this. Tonight is one of them.", variantId: "cuisine-comfort-nights" },
      { text: "No explanation needed.", variantId: "cuisine-comfort-no-explain" },
      { text: "This is what comfort food is for.", variantId: "cuisine-comfort-for" },
    ];
  }
  return null;
}

// ─── Category 5 — Default confidence pool ────────────────────────────────────

const DEFAULT_LINES: Array<{ text: string; variantId: string }> = [
  { text: "Decision made. Don't overthink it.", variantId: "default-decision-made" },
  { text: "Solid pick. Let's eat.", variantId: "default-solid-pick" },
  { text: "This one makes sense tonight.", variantId: "default-makes-sense" },
  { text: "The 'I don't know' era is over. For tonight.", variantId: "default-idontknow-era" },
  { text: "Nobody text 'but what about…'", variantId: "default-nobody-text" },
  { text: "Your stomach already knows.", variantId: "default-stomach-knows" },
  { text: "Done. Go eat.", variantId: "default-done-go-eat" },
  { text: "No second-guessing.", variantId: "default-no-second-guess" },
  { text: "Dinner: handled.", variantId: "default-dinner-handled" },
  { text: "The debate is over.", variantId: "default-debate-over" },
  { text: "That's the one.", variantId: "default-thats-the-one" },
  { text: "Trust the process.", variantId: "default-trust-process" },
  { text: "Locked. Don't look back.", variantId: "default-locked-no-lookback" },
  { text: "This is why we built the app.", variantId: "default-why-we-built" },
  { text: "Good taste confirmed.", variantId: "default-good-taste" },
  { text: "The algorithm and your gut agree.", variantId: "default-algo-gut" },
  { text: "Some decisions make themselves.", variantId: "default-decisions-make" },
  { text: "You already knew. We just confirmed it.", variantId: "default-already-knew" },
  { text: "Right meal. Right night.", variantId: "default-right-meal-night" },
  { text: "Called it.", variantId: "default-called-it" },
  { text: "Easy.", variantId: "default-easy" },
  { text: "That's dinner.", variantId: "default-thats-dinner" },
  { text: "And just like that, it's handled.", variantId: "default-just-like-that" },
  { text: "You made the right call.", variantId: "default-right-call" },
  { text: "Committed. Respect.", variantId: "default-committed" },
  { text: "Overthinking? Not tonight.", variantId: "default-no-overthink" },
  { text: "One less thing to figure out.", variantId: "default-one-less" },
  { text: "The vibe is locked.", variantId: "default-vibe-locked" },
  { text: "Dinner doesn't get to win. You do.", variantId: "default-you-win" },
  { text: "Decision made. Move on.", variantId: "default-move-on" },
  { text: "The debate is over. Finally.", variantId: "default-debate-finally" },
  { text: "That's the one. Trust it.", variantId: "default-trust-it" },
  { text: "No committee needed.", variantId: "default-no-committee" },
  { text: "Quick and correct.", variantId: "default-quick-correct" },
  { text: "The obvious answer was right.", variantId: "default-obvious-right" },
  { text: "Hunger problem: solved.", variantId: "default-hunger-solved" },
  { text: "Tonight's question has been answered.", variantId: "default-question-answered" },
  { text: "Done deliberating. Start eating.", variantId: "default-done-deliberating" },
  { text: "Your future self approves.", variantId: "default-future-self" },
  { text: "The pick is in.", variantId: "default-pick-is-in" },
  { text: "Dinner locked. Life continues.", variantId: "default-life-continues" },
  { text: "Less thinking. More eating.", variantId: "default-less-thinking" },
  { text: "The indecision ends here.", variantId: "default-indecision-ends" },
  { text: "Took a second. Worth it.", variantId: "default-took-a-second" },
  { text: "Instinct confirmed.", variantId: "default-instinct-confirmed" },
  { text: "The craving was correct.", variantId: "default-craving-correct" },
  { text: "You came. You swiped. You decided.", variantId: "default-came-swiped-decided" },
  { text: "That settles it.", variantId: "default-that-settles-it" },
  { text: "This meal has been approved.", variantId: "default-meal-approved" },
  { text: "Confidence level: high.", variantId: "default-confidence-high" },
  { text: "No regrets on this one.", variantId: "default-no-regrets" },
  { text: "Stomach approved. Brain agreed.", variantId: "default-stomach-brain" },
  { text: "The pick stands.", variantId: "default-pick-stands" },
  { text: "Another decision, handled.", variantId: "default-another-handled" },
  { text: "That's dinner. Moving on.", variantId: "default-moving-on" },
  { text: "The wait is over.", variantId: "default-wait-over" },
  { text: "Good call. Great meal.", variantId: "default-good-call-great-meal" },
  { text: "The right answer at the right time.", variantId: "default-right-answer" },
  { text: "Dinner sorted. You're welcome.", variantId: "default-youre-welcome" },
  { text: "One question down. Zero left.", variantId: "default-zero-left" },
  { text: "That's what we're here for.", variantId: "default-thats-what-were-here" },
  { text: "Made the call. Own it.", variantId: "default-own-it" },
];

// ─── Name injection helpers ───────────────────────────────────────────────────

/**
 * We personalize ~25% of picks when a compatible line exists.
 * "Compatible" means the line has a name placeholder or is in the ritual/cuisine
 * categories where name insertion is natural.
 *
 * For simplicity the ritual lines already embed the name at construction time.
 * Cuisine / time / default lines are left name-free per the spec.
 */
function shouldUseName(): boolean {
  return Math.random() < 0.40;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function getLockedMealHeadline({
  meal,
  userName,
  mode,
  history,
}: HeadlineInput): LockedMealHeadlineResult {
  const seen = getSeenVariants();
  const firstName = userName?.split(" ")[0] ?? null;
  const useNameThisTime = !!firstName && shouldUseName();

  // 1. Ritual / repeat
  const ritualMatch = matchesRitual(meal, history);
  if (ritualMatch) {
    const ritualLines = getRitualLines(ritualMatch, firstName ?? "");
    // If we want to use name, prefer the name-compatible lines; otherwise use the rest
    const eligible = useNameThisTime
      ? ritualLines
      : ritualLines.filter((l) => !l.usesName);
    const source = eligible.length > 0 ? eligible : ritualLines;
    const chosen = pick(source, seen);
    recordVariant(chosen.variantId);
    return {
      headline: chosen.text,
      subheadline: randomSubheadline(),
      variantId: chosen.variantId,
    };
  }

  // 2. Shared mode
  if (mode === "shared") {
    const chosen = pick(SHARED_LINES, seen);
    recordVariant(chosen.variantId);
    return {
      headline: chosen.text,
      subheadline: randomSubheadline(),
      variantId: chosen.variantId,
    };
  }

  // 3. Time / day
  const timeLines = getTimeLines();
  if (timeLines) {
    const chosen = pick(timeLines, seen);
    recordVariant(chosen.variantId);
    return {
      headline: chosen.text,
      subheadline: randomSubheadline(),
      variantId: chosen.variantId,
    };
  }

  // 4. Cuisine specific
  const cuisineLines = getCuisineLines(meal);
  if (cuisineLines) {
    const chosen = pick(cuisineLines, seen);
    recordVariant(chosen.variantId);
    return {
      headline: chosen.text,
      subheadline: randomSubheadline(),
      variantId: chosen.variantId,
    };
  }

  // 5. Default pool
  const chosen = pick(DEFAULT_LINES, seen);
  recordVariant(chosen.variantId);
  return {
    headline: chosen.text,
    subheadline: randomSubheadline(),
    variantId: chosen.variantId,
  };
}
