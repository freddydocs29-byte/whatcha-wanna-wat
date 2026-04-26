/**
 * generate-meal-images.ts
 *
 * Generates DALL-E 3 food images for meals that still use Unsplash/placeholder
 * URLs, uploads them to Supabase Storage, and auto-updates meals.ts after each
 * successful meal so progress is saved even if later meals fail.
 *
 * Run repeatedly, 10 meals at a time, until all remaining images are updated.
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... \
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   AUTO_WRITE=true \
 *   npx tsx scripts/generate-meal-images.ts
 *
 * Env options:
 *   CUISINES=American,Mexican,Italian   filter by cuisine  (default: ALL)
 *   CUISINES=ALL                        process every cuisine
 *   BATCH_SIZE=10                       meals per run      (default: 10)
 *   AUTO_WRITE=true                     update meals.ts    (default: false)
 *   START_AFTER=meal-id                 skip meals up to and including this ID
 *   ONLY_IDS=id1,id2,id3               process only these specific meal IDs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { meals } from "../src/app/data/meals";

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Config ────────────────────────────────────────────────────────────────────

const CUISINES_RAW = process.env.CUISINES ?? "ALL";
const USE_ALL_CUISINES =
  CUISINES_RAW.trim().toUpperCase() === "ALL" || CUISINES_RAW.trim() === "";
const TARGET_CUISINES = USE_ALL_CUISINES
  ? []
  : CUISINES_RAW.split(",")
      .map((c) => c.trim())
      .filter(Boolean);

const BATCH_SIZE = parseInt(process.env.BATCH_SIZE ?? "10", 10);

const AUTO_WRITE = process.env.AUTO_WRITE === "true";

// START_AFTER: skip all meals up to and including this ID (for resuming)
const START_AFTER = process.env.START_AFTER?.trim() ?? "";

// ONLY_IDS: if set, only process these specific meal IDs
const ONLY_IDS_RAW = process.env.ONLY_IDS?.trim() ?? "";
const ONLY_IDS = ONLY_IDS_RAW
  ? ONLY_IDS_RAW.split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  : [];

// DALL-E 3 default rate limit: 5 img/min on Tier 1.
// 13 s between requests keeps us safely under.
const RATE_LIMIT_MS = 13_000;

const MEALS_TS_PATH = path.resolve(__dirname, "../src/app/data/meals.ts");
const MEALS_BACKUP_PATH = path.resolve(
  __dirname,
  "../src/app/data/meals.backup.ts"
);
const SCORING_TS_PATH = path.resolve(__dirname, "../src/app/lib/scoring.ts");

// ── Load cuisine map from scoring.ts source ───────────────────────────────────
//
// Read and parse scoring.ts as text rather than importing it, because
// scoring.ts → storage.ts → supabase.ts creates a client at module load time
// and throws if NEXT_PUBLIC_SUPABASE_* env vars aren't set.

function loadMealCuisines(): Record<string, string[]> {
  const src = fs.readFileSync(SCORING_TS_PATH, "utf8");

  const startIdx = src.indexOf("export const MEAL_CUISINES");
  if (startIdx === -1) {
    throw new Error("Could not find MEAL_CUISINES in scoring.ts");
  }

  // Walk balanced braces to extract the full object literal
  const braceOpen = src.indexOf("{", startIdx);
  let depth = 0;
  let braceClose = braceOpen;
  for (let i = braceOpen; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) {
        braceClose = i;
        break;
      }
    }
  }

  const block = src.substring(braceOpen + 1, braceClose);
  const result: Record<string, string[]> = {};

  // Match both quoted ("chicken-alfredo") and bare (tacos) key formats
  const lineRe = /^\s*(?:"([^"]+)"|(\w[\w-]*))\s*:\s*\[([^\]]*)\]/gm;
  let m: RegExpExecArray | null;
  while ((m = lineRe.exec(block)) !== null) {
    const id = (m[1] ?? m[2]).trim();
    const cuisines = m[3]
      .split(",")
      .map((s) => s.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
    if (id && cuisines.length > 0) result[id] = cuisines;
  }

  return result;
}

// ── Prompt ────────────────────────────────────────────────────────────────────

function buildPrompt(mealName: string): string {
  return (
    `A professional food photograph of ${mealName}. ` +
    `Overhead or slight 45-degree angle, dark matte slate or wood surface, ` +
    `dramatic studio lighting with a soft key light from upper left, ` +
    `shallow depth of field. Plated as in a high-end restaurant. ` +
    `Portrait orientation. Cinematic, moody, dark background. ` +
    `Subtle variation in plating style.`
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return val!;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const json = Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function validateServiceRoleKey(key: string): void {
  const payload = decodeJwtPayload(key);
  if (!payload) {
    console.error(
      "SUPABASE_SERVICE_ROLE_KEY does not look like a valid JWT. " +
        "Copy it from Supabase Dashboard → Project Settings → API → service_role."
    );
    process.exit(1);
  }
  const role = payload["role"];
  if (role !== "service_role") {
    console.error(
      `SUPABASE_SERVICE_ROLE_KEY has role="${role}" in its JWT payload — ` +
        `expected "service_role". You may have set the anon or publishable key instead. ` +
        `Copy the service_role key from Supabase Dashboard → Project Settings → API.`
    );
    process.exit(1);
  }
}

function logEnvPresence(): void {
  const vars = [
    "OPENAI_API_KEY",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  ];
  console.log(" Env vars:");
  for (const name of vars) {
    const val = process.env[name];
    const status = val ? `set (${val.length} chars)` : "NOT SET";
    console.log(`   ${name.padEnd(38)} ${status}`);
  }
  console.log();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Replaces the image URL for a specific meal ID within the meals.ts file
 * content string. Locates the meal by its `id` field, operates only within
 * that object block — safe even when multiple meals share the same Unsplash URL.
 */
function replaceMealImageInContent(
  content: string,
  mealId: string,
  oldUrl: string,
  newUrl: string
): string {
  const idMarker = `id: "${mealId}"`;
  const idIndex = content.indexOf(idMarker);
  if (idIndex === -1) {
    console.warn(`  ⚠  Could not locate meal id "${mealId}" in meals.ts`);
    return content;
  }

  // Bound the block to the next meal's opening brace or the array's closing ];
  const afterId = idIndex + idMarker.length;
  const nextMealStart = content.indexOf("\n  {", afterId);
  const arrayEnd = content.indexOf("\n];", afterId);

  let blockEnd: number;
  if (nextMealStart !== -1 && (arrayEnd === -1 || nextMealStart < arrayEnd)) {
    blockEnd = nextMealStart;
  } else if (arrayEnd !== -1) {
    blockEnd = arrayEnd + 3;
  } else {
    blockEnd = content.length;
  }

  const before = content.substring(0, idIndex);
  const block = content.substring(idIndex, blockEnd);
  const after = content.substring(blockEnd);

  if (!block.includes(oldUrl)) {
    console.warn(`  ⚠  Expected URL not found in meal block "${mealId}"`);
    console.warn(`      Expected: ${oldUrl}`);
    return content;
  }

  return before + block.replace(oldUrl, newUrl) + after;
}

/**
 * Atomically writes updated content to meals.ts.
 * Creates the backup on first call of each run, then updates in-place.
 */
function writeMealsTs(
  mealId: string,
  oldUrl: string,
  newUrl: string,
  backupCreated: { value: boolean }
): boolean {
  const current = fs.readFileSync(MEALS_TS_PATH, "utf8");

  // Create backup once at the start of each run (before first write)
  if (!backupCreated.value) {
    fs.writeFileSync(MEALS_BACKUP_PATH, current, "utf8");
    console.log(`  ✓ Backup saved → src/app/data/meals.backup.ts`);
    backupCreated.value = true;
  }

  const updated = replaceMealImageInContent(current, mealId, oldUrl, newUrl);
  if (updated === current) {
    return false; // nothing changed
  }

  const tmpPath = `${MEALS_TS_PATH}.tmp`;
  fs.writeFileSync(tmpPath, updated, "utf8");
  fs.renameSync(tmpPath, MEALS_TS_PATH);
  return true;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // Parse cuisine map from scoring.ts source to avoid importing its dep chain
  const MEAL_CUISINES = loadMealCuisines();

  logEnvPresence();

  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  validateServiceRoleKey(serviceRoleKey);

  const openai = new OpenAI({ apiKey: requireEnv("OPENAI_API_KEY") });
  const supabase = createClient(requireEnv("SUPABASE_URL"), serviceRoleKey);

  // ── Build candidate list ──────────────────────────────────────────────────

  // 1. All meals (total pool)
  const allMeals = meals;

  // 2. Already on Supabase — always skipped regardless of other filters
  const alreadyDone = allMeals.filter((m) =>
    m.image.includes("supabase.co/storage")
  );

  // 3. Needs an image
  let eligible = allMeals.filter(
    (m) => !m.image.includes("supabase.co/storage")
  );

  // 4. ONLY_IDS filter — overrides cuisine and START_AFTER
  if (ONLY_IDS.length > 0) {
    const idSet = new Set(ONLY_IDS);
    const missing = ONLY_IDS.filter(
      (id) => !allMeals.find((m) => m.id === id)
    );
    if (missing.length > 0) {
      console.warn(`  ⚠  Unknown meal IDs in ONLY_IDS: ${missing.join(", ")}`);
    }
    eligible = eligible.filter((m) => idSet.has(m.id));
  } else {
    // 4a. Cuisine filter
    if (!USE_ALL_CUISINES) {
      eligible = eligible.filter((m) => {
        const mealCuisines = MEAL_CUISINES[m.id] ?? [];
        return mealCuisines.some((c) => TARGET_CUISINES.includes(c));
      });
    }

    // 4b. START_AFTER: drop everything up to and including that ID
    if (START_AFTER) {
      const idx = eligible.findIndex((m) => m.id === START_AFTER);
      if (idx === -1) {
        console.warn(
          `  ⚠  START_AFTER="${START_AFTER}" not found in eligible list — ignoring`
        );
      } else {
        eligible = eligible.slice(idx + 1);
      }
    }
  }

  const targets = eligible.slice(0, BATCH_SIZE);

  // ── Header ───────────────────────────────────────────────────────────────

  console.log(`\n${"─".repeat(60)}`);
  console.log(` Meal image generator — repeatable batch`);
  console.log(`${"─".repeat(60)}`);
  console.log(
    ` Target cuisines    : ${USE_ALL_CUISINES ? "ALL" : TARGET_CUISINES.join(", ")}`
  );
  if (ONLY_IDS.length > 0) {
    console.log(` ONLY_IDS           : ${ONLY_IDS.join(", ")}`);
  }
  if (START_AFTER) {
    console.log(` START_AFTER        : ${START_AFTER}`);
  }
  console.log(` Total meals        : ${allMeals.length}`);
  console.log(` Already on Supabase: ${alreadyDone.length} (skipping)`);
  console.log(` Remaining (eligible): ${eligible.length}`);
  console.log(
    ` Batch this run     : ${targets.length} (size: ${BATCH_SIZE})`
  );
  console.log(` Model              : dall-e-3  1024×1792  standard`);
  console.log(` Estimated cost     : ~$${(targets.length * 0.04).toFixed(2)}`);
  console.log(
    ` Auto-write         : ${
      AUTO_WRITE
        ? "YES — meals.ts updated after each success"
        : "NO  — URLs printed only (set AUTO_WRITE=true to apply)"
    }`
  );
  console.log(`${"─".repeat(60)}\n`);

  if (targets.length === 0) {
    console.log(
      "Nothing to do — all matching meals already have Supabase images."
    );
    return;
  }

  console.log("Meals queued this run:");
  targets.forEach((m, i) => {
    const cuisines = (MEAL_CUISINES[m.id] ?? []).join(", ") || "—";
    console.log(
      `  ${String(i + 1).padStart(2)}. ${m.id.padEnd(32)} [${cuisines}]`
    );
  });
  console.log();

  // ── Generate, download, upload, write ────────────────────────────────────

  let succeeded = 0;
  let failed = 0;
  let written = 0;
  const failures: { id: string; reason: string }[] = [];
  const backupCreated = { value: false };

  for (let i = 0; i < targets.length; i++) {
    const meal = targets[i];
    const tag = `[${i + 1}/${targets.length}]`;

    console.log(`${tag} ${meal.name}  (${meal.id})`);

    try {
      // 1. Generate
      console.log(`     › Generating with DALL-E 3...`);
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: buildPrompt(meal.name),
        size: "1024x1792",
        quality: "standard",
        n: 1,
      });

      const firstImage = response.data?.[0];
      if (!firstImage || !firstImage.url) {
        throw new Error("OpenAI returned no image URL");
      }
      const tempUrl = firstImage.url;

      // 2. Download
      console.log(`     › Downloading...`);
      const imageRes = await fetch(tempUrl);
      if (!imageRes.ok) {
        throw new Error(`Download failed: HTTP ${imageRes.status}`);
      }
      const buffer = Buffer.from(await imageRes.arrayBuffer());

      // 3. Upload to Supabase Storage
      const fileName = `${meal.id}.jpg`;
      console.log(`     › Uploading to meal-images/${fileName}...`);

      const { error: uploadError } = await supabase.storage
        .from("meal-images")
        .upload(fileName, buffer, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Supabase upload: ${uploadError.message}`);
      }

      // 4. Resolve public URL
      const { data: urlData } = supabase.storage
        .from("meal-images")
        .getPublicUrl(fileName);
      const newUrl = urlData.publicUrl;

      succeeded++;
      console.log(`     ✓ ${newUrl}`);

      // 5. Immediately update meals.ts — progress saved even if next meal fails
      if (AUTO_WRITE) {
        const didWrite = writeMealsTs(meal.id, meal.image, newUrl, backupCreated);
        if (didWrite) {
          written++;
          console.log(`     ✓ meals.ts updated (${written} written this run)`);
        } else {
          console.warn(`     ⚠  meals.ts not modified for ${meal.id}`);
        }
      } else {
        console.log(`     → image: "${newUrl}",`);
      }
      console.log();
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      failed++;
      failures.push({ id: meal.id, reason });
      console.error(`     ✗ Failed: ${reason}\n`);
    }

    // Rate limit — skip delay after the last item
    if (i < targets.length - 1) {
      console.log(
        `     ⏱  Waiting ${RATE_LIMIT_MS / 1000}s before next request...\n`
      );
      await sleep(RATE_LIMIT_MS);
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────

  const remainingAfterRun = eligible.length - succeeded;

  console.log(`\n${"─".repeat(60)}`);
  console.log(` Summary`);
  console.log(`${"─".repeat(60)}`);
  console.log(` Total meals        : ${allMeals.length}`);
  console.log(` Total remaining    : ${eligible.length}`);
  console.log(` Processed this run : ${targets.length}`);
  console.log(` Succeeded          : ${succeeded}`);
  console.log(` Failed             : ${failed}`);
  console.log(` Skipped (Supabase) : ${alreadyDone.length}`);
  console.log(` Remaining after run: ${remainingAfterRun}`);
  console.log(` Actual cost        : ~$${(succeeded * 0.04).toFixed(2)}`);
  if (AUTO_WRITE) {
    console.log(` meals.ts writes    : ${written}`);
  }
  console.log(`${"─".repeat(60)}\n`);

  if (failures.length > 0) {
    console.log("Failed meals (re-run to retry):");
    for (const { id, reason } of failures) {
      console.log(`  ✗ ${id}: ${reason}`);
    }
    console.log();
    // Suggest an ONLY_IDS retry command
    const failedIds = failures.map((f) => f.id).join(",");
    console.log(
      `  Retry failed meals:\n` +
        `    ONLY_IDS=${failedIds} AUTO_WRITE=true npx tsx scripts/generate-meal-images.ts\n`
    );
  }

  if (!AUTO_WRITE && succeeded > 0) {
    console.log(
      "AUTO_WRITE=false — re-run with AUTO_WRITE=true to apply changes to meals.ts.\n"
    );
  }

  if (remainingAfterRun > 0 && succeeded > 0) {
    // Suggest next batch command
    const lastId = targets[targets.length - 1].id;
    const cuisineFlag = USE_ALL_CUISINES
      ? "CUISINES=ALL"
      : `CUISINES=${TARGET_CUISINES.join(",")}`;
    console.log(
      `  Next batch:\n` +
        `    ${cuisineFlag} START_AFTER=${lastId} AUTO_WRITE=true npx tsx scripts/generate-meal-images.ts\n`
    );
  }

  if (AUTO_WRITE && backupCreated.value) {
    console.log(
      "  To revert: cp src/app/data/meals.backup.ts src/app/data/meals.ts\n"
    );
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
