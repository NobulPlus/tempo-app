#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const mode = process.argv[2] ?? "status";
const validModes = new Set(["status", "push"]);

if (!validModes.has(mode)) {
  console.error("Usage: node scripts/supabase-migrations.mjs <status|push>");
  process.exit(1);
}

if (!existsSync("supabase/migrations")) {
  console.error("Could not find supabase/migrations. Run this from the project root.");
  process.exit(1);
}

const localMigrations = readdirSync("supabase/migrations")
  .filter((file) => file.endsWith(".sql"))
  .sort();

const projectRef = getProjectRef();
const npx = "npx";
const baseArgs = ["--yes", "supabase@latest"];

console.log(`Local migrations: ${localMigrations.length}`);
if (localMigrations.at(-1)) console.log(`Latest local file: ${localMigrations.at(-1)}`);
if (projectRef) console.log(`Supabase project: ${projectRef}`);
console.log("");

if (mode === "status") {
  console.log("Checking remote migration status...");
  runSupabase(["migration", "list", "--linked"]);
} else {
  console.log("Applying pending migrations to the linked Supabase project...");
  console.log("Supabase CLI will only push migrations that are not already recorded remotely.");
  console.log("");
  runSupabase(["db", "push", "--linked"]);
}

function runSupabase(args) {
  const result = spawnSync(npx, [...baseArgs, ...args], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.error) {
    console.error("");
    console.error(result.error.message);
    console.error("Make sure Node can run npx, then try again.");
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error("");
    console.error("Supabase CLI could not complete the command.");
    console.error("If this project is not linked yet, run:");
    console.error("  npx supabase login");
    console.error("  npx supabase link --project-ref <your-project-ref>");
    console.error("");
    console.error("Then rerun:");
    console.error("  npm run db:migrations");
    process.exit(result.status ?? 1);
  }
}

function getProjectRef() {
  const env = readEnvFile(".env.local");
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const match = url?.match(/^https:\/\/([a-z0-9-]+)\.supabase\.co\/?$/i);
  return match?.[1] ?? null;
}

function readEnvFile(path) {
  if (!existsSync(path)) return {};

  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );
}
