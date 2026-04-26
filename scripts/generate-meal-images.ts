/**
 * generate-meal-images.ts
 *
 * Generates DALL-E 3 food images for meals filtered by cuisine that still
 * use Unsplash/placeholder URLs, uploads them to Supabase Storage, and
 * optionally auto-updates src/app/data/meals.ts.
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... \
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   AUTO_WRITE=true \
 *   npx tsx scripts/generate-meal-images.ts
 *
 * Env options (all optional):
 *   CUISINES=American,Mexican,Italian  (default: "American,Mexican,Italian")
 *   BATCH_SIZE=10                       (default: 10, hard cap: 15)
 *   AUTO_WRITE=true                     (default: false — prints URLs only)
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

const CUISINES_RAW = process.env.CUISINES ?? "American,Mexican,Italian";
const TARGET_CUISINES = CUISINES_RAW.split(",")
  .map((c) => c.trim())
  .filter(Boolean);

const BATCH_SIZE = Math.min(
  parseInt(process.env.BATCH_SIZE ?? "10", 10),
  15 // hard cap — DALL-E 3 is $0.04/image at 1024×1792 standard quality
);

const AUTO_WRITE = process.env.AUTO_WRITE === "true";

// DALL-E 3 default rate limit: 5 img/min on Tier 1.
// 13 s between requests keeps us safely under.
const RATE_LIMIT_MS = 13_000;

const MEALS_TS_PATH = path.resolve(__dirname, "../src/app/data/meals.ts");
const MEALS_BACKUP_PATH = path.resolve(
  __dirname,
  "../src/app/data/meals.backup.ts"
);
const SCORING_TS_PATH = path.resolve(
  __dirname,
  "../src/app/lib/scoring.ts"
);

// ── Load cuisine map from scoring.ts source ───────────────────────────────────
//
// We read and parse scoring.ts as text rather than importing it, because
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

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // Parse cuisine map from scoring.ts source to avoid importing its dep chain
  const MEAL_CUISINES = loadMealCuisines();

  logEnvPresence();

  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  validateServiceRoleKey(serviceRoleKey);

  const openai = new OpenAI({ apiKey: requireEnv("OPENAI_API_KEY") });
  const supabase = createClient(requireEnv("SUPABASE_URL"), serviceRoleKey);

  // ── Filter meals ─────────────────────────────────────────────────────────

  const allTargetMeals = meals.filter((m) => {
    const mealCuisines = MEAL_CUISINES[m.id] ?? [];
    return mealCuisines.some((c) => TARGET_CUISINES.includes(c));
  });

  const alreadyDone = allTargetMeals.filter((m) =>
    m.image.includes("supabase.co/storage")
  );
  const eligible = allTargetMeals.filter(
    (m) => !m.image.includes("supabase.co/storage")
  );
  const targets = eligible.slice(0, BATCH_SIZE);

  // ── Header ───────────────────────────────────────────────────────────────

  console.log(`\n${"─".repeat(60)}`);
  console.log(` Meal image generator — cuisine batch`);
  console.log(`${"─".repeat(60)}`);
  console.log(` Target cuisines    : ${TARGET_CUISINES.join(", ")}`);
  console.log(` Matching meals     : ${allTargetMeals.length}`);
  console.log(` Already on Supabase: ${alreadyDone.length} (skipping)`);
  console.log(` Need images        : ${eligible.length}`);
  console.log(` Batch this run     : ${targets.length} (cap: ${BATCH_SIZE})`);
  console.log(` Model              : dall-e-3  1024×1792  standard`);
  console.log(` Estimated cost     : ~$${(targets.length * 0.04).toFixed(2)}`);
  console.log(
    ` Auto-write         : ${
      AUTO_WRITE
        ? "YES — meals.ts will be updated"
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

  targets.forEach((m, i) => {
    const cuisines = (MEAL_CUISINES[m.id] ?? []).join(", ");
    console.log(
      `  ${String(i + 1).padStart(2)}. ${m.id.padEnd(32)} [${cuisines}]`
    );
  });
  console.log();

  // ── Generate, download, upload ───────────────────────────────────────────

  const results: { id: string; oldUrl: string; newUrl: string }[] = [];
  const failures: { id: string; reason: string }[] = [];

  for (let i = 0; i < targets.length; i++) {
    const meal = targets[i];
    const tag = `[${i + 1}/${targets.length}]`;

    console.log(`${tag} ${meal.name}`);

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
      results.push({ id: meal.id, oldUrl: meal.image, newUrl });
      console.log(`     ✓ ${newUrl}\n`);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
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

  console.log(`\n${"─".repeat(60)}`);
  console.log(` Summary`);
  console.log(`${"─".repeat(60)}`);
  console.log(` Total eligible     : ${eligible.length}`);
  console.log(` Processed          : ${targets.length}`);
  console.log(` Updated            : ${results.length}`);
  console.log(` Skipped (Supabase) : ${alreadyDone.length}`);
  console.log(` Failed             : ${failures.length}`);
  console.log(` Remaining after run: ${eligible.length - results.length}`);
  console.log(` Actual cost        : ~$${(results.length * 0.04).toFixed(2)}`);
  console.log(`${"─".repeat(60)}\n`);

  // Log all changes
  if (results.length > 0) {
    console.log("Changes:");
    for (const { id, oldUrl, newUrl } of results) {
      console.log(`  ${id}`);
      console.log(`    old: ${oldUrl}`);
      console.log(`    new: ${newUrl}`);
      console.log();
    }
  }

  if (failures.length > 0) {
    console.log("Failed meals (re-run to retry):");
    for (const { id, reason } of failures) {
      console.log(`  ✗ ${id}: ${reason}`);
    }
    console.log();
  }

  // ── Auto-write meals.ts ──────────────────────────────────────────────────

  if (!AUTO_WRITE) {
    if (results.length > 0) {
      console.log(
        "AUTO_WRITE=false — paste these into src/app/data/meals.ts manually:\n"
      );
      for (const { id, newUrl } of results) {
        console.log(`  ${id}`);
        console.log(`    image: "${newUrl}",`);
        console.log();
      }
      console.log(
        "Or re-run with AUTO_WRITE=true to apply changes automatically."
      );
    }
    return;
  }

  if (results.length === 0) {
    console.log("No successful results — nothing to write.");
    return;
  }

  // 1. Backup original file before any writes
  console.log("Writing meals.ts...");
  const originalContent = fs.readFileSync(MEALS_TS_PATH, "utf8");
  fs.writeFileSync(MEALS_BACKUP_PATH, originalContent, "utf8");
  console.log(`  ✓ Backup → src/app/data/meals.backup.ts`);

  // 2. Apply URL replacements one by one
  let content = originalContent;
  let writeCount = 0;

  for (const { id, oldUrl, newUrl } of results) {
    const before = content;
    content = replaceMealImageInContent(content, id, oldUrl, newUrl);
    if (content !== before) {
      writeCount++;
      console.log(`  ✓ Replaced: ${id}`);
    }
  }

  if (writeCount === 0) {
    console.log("\nNo URL replacements were made — meals.ts unchanged.");
    return;
  }

  // 3. Write atomically (write to tmp then rename)
  const tmpPath = `${MEALS_TS_PATH}.tmp`;
  fs.writeFileSync(tmpPath, content, "utf8");
  fs.renameSync(tmpPath, MEALS_TS_PATH);

  console.log(`\n✓ meals.ts updated — ${writeCount} meal(s) replaced.\n`);
  console.log(
    "  To revert: cp src/app/data/meals.backup.ts src/app/data/meals.ts\n"
  );
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
