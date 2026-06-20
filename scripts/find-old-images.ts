/**
 * find-old-images.ts
 *
 * Queries the Supabase meal-images storage bucket, finds all images whose
 * timestamp predates a cutoff, and outputs a ready-to-use ONLY_IDS string
 * for scripts/generate-meal-images.ts.
 *
 * Read-only — no uploads, no file modifications.
 *
 * Usage:
 *   npx tsx scripts/find-old-images.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Config ────────────────────────────────────────────────────────────────────

// Explicit ISO string — no timezone assumed; compared as a string / Date parse.
const CUTOFF_ISO = "2026-06-14T18:43:30";
const CUTOFF_DATE = new Date(CUTOFF_ISO);

const BUCKET = "meal-images";
const PAGE_SIZE = 100;

const OUTPUT_DIR = path.resolve(__dirname, "../meal-image-audit");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "old-image-ids.txt");

// ── SKIP_IDS — copied verbatim from generate-meal-images.ts ──────────────────
// generate-meal-images.ts does not export SKIP_IDS, so we reproduce the
// canonical list here. Keep in sync if generate-meal-images.ts changes.
const SKIP_IDS = new Set([
  "saffron-rice",
  "spicy-carrot-salad",
  "briouat",
  "harira-soup",
  "vegetable-tagine",
  "zucchini-fritters",
  "orange-salad",
  "moroccan-pizza",
  "kefta-meatballs",
  "moroccan-chicken-skewers",
  "pastilla",
  "couscous-vegetable",
]);

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
        `expected "service_role". You may have set the anon or publishable key instead.`
    );
    process.exit(1);
  }
}

// Pick the best available timestamp field, in priority order.
function pickTimestamp(
  file: Record<string, unknown>
): { raw: string; date: Date } | null {
  for (const field of ["updated_at", "last_modified", "created_at"]) {
    const raw = file[field];
    if (typeof raw === "string" && raw.length > 0) {
      const date = new Date(raw);
      if (!isNaN(date.getTime())) {
        return { raw, date };
      }
    }
  }
  return null;
}

// Derive meal ID from storage filename: "burger.jpg" → "burger"
function mealIdFromFilename(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  validateServiceRoleKey(serviceRoleKey);

  const supabase = createClient(requireEnv("SUPABASE_URL"), serviceRoleKey);

  console.log(`\n${"─".repeat(60)}`);
  console.log(` Meal image audit — find images older than cutoff`);
  console.log(`${"─".repeat(60)}`);
  console.log(` Bucket         : ${BUCKET}`);
  console.log(` Cutoff         : ${CUTOFF_ISO}  (parsed: ${CUTOFF_DATE.toISOString()})`);
  console.log(` SKIP_IDS count : ${SKIP_IDS.size}`);
  console.log(`${"─".repeat(60)}\n`);

  // ── Paginate through entire bucket ─────────────────────────────────────────

  type StorageFile = {
    name: string;
    [key: string]: unknown;
  };

  const allFiles: StorageFile[] = [];
  let page = 0;

  while (true) {
    const offset = page * PAGE_SIZE;
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list("", { limit: PAGE_SIZE, offset });

    if (error) {
      console.error(`Error fetching page ${page + 1}: ${error.message}`);
      process.exit(1);
    }

    const files = (data ?? []) as unknown as StorageFile[];
    console.log(`Page ${page + 1}: ${files.length} files returned`);

    if (files.length === 0) break;

    allFiles.push(...files);
    page++;

    if (files.length < PAGE_SIZE) break; // last page
  }

  const totalFiles = allFiles.length;
  const pagesFetched = page;

  console.log(`\nTotal files in bucket: ${totalFiles}\n`);

  // ── Print sample timestamps for the first 3 files ─────────────────────────

  console.log("Sample timestamps seen (first 3 files):");
  for (const f of allFiles.slice(0, 3)) {
    const ts = pickTimestamp(f as Record<string, unknown>);
    const raw = ts?.raw ?? "(no timestamp field found)";
    console.log(`  ${f.name}: ${raw}`);
  }
  console.log();

  // ── Classify files ─────────────────────────────────────────────────────────

  const olderThanCutoff: string[] = [];   // meal IDs
  const unknownTimestamp: string[] = [];  // filenames
  const excludedBySkipIds: string[] = []; // meal IDs

  for (const file of allFiles) {
    const mealId = mealIdFromFilename(file.name);
    const ts = pickTimestamp(file as Record<string, unknown>);

    if (!ts) {
      unknownTimestamp.push(file.name);
      continue;
    }

    if (ts.date >= CUTOFF_DATE) {
      // Newer than cutoff — already up to date
      continue;
    }

    // Older than cutoff
    if (SKIP_IDS.has(mealId)) {
      excludedBySkipIds.push(mealId);
    } else {
      olderThanCutoff.push(mealId);
    }
  }

  const finalIds = olderThanCutoff;
  const estimatedCost = finalIds.length * 0.167;

  // ── Terminal output ────────────────────────────────────────────────────────

  console.log(`Pages fetched                         : ${pagesFetched}`);
  console.log(`Total files in bucket                 : ${totalFiles}`);
  console.log(`Files older than cutoff               : ${olderThanCutoff.length + excludedBySkipIds.length}`);
  console.log(`Excluded (already high-quality or protected): ${excludedBySkipIds.length}`);
  console.log(`Final count needing update            : ${finalIds.length}`);
  console.log(`Estimated cost at $0.167/image        : $${estimatedCost.toFixed(2)}`);
  console.log();

  if (unknownTimestamp.length > 0) {
    console.log("Unknown timestamp files (excluded, review manually):");
    for (const name of unknownTimestamp) {
      console.log(`  ${name}`);
    }
    console.log();
  }

  if (finalIds.length === 0) {
    console.log("No meals older than cutoff found — nothing to regenerate.");
  } else {
    console.log(`ONLY_IDS=${finalIds.join(",")}`);
  }
  console.log();

  // ── Write output file ─────────────────────────────────────────────────────

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const fileContent = [
    `Cutoff: ${CUTOFF_ISO}`,
    `Pages fetched: ${pagesFetched}`,
    `Total bucket files: ${totalFiles}`,
    `Files older than cutoff: ${olderThanCutoff.length + excludedBySkipIds.length}`,
    `Excluded IDs: ${excludedBySkipIds.length}`,
    `Final count: ${finalIds.length}`,
    `Estimated cost: $${estimatedCost.toFixed(2)}`,
    ``,
    `IDs:`,
    finalIds.join(","),
    ``,
  ].join("\n");

  fs.writeFileSync(OUTPUT_FILE, fileContent, "utf8");
  console.log(`Output written → ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
