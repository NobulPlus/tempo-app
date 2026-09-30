#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const mode = process.argv[2] ?? "status";
const validModes = new Set(["status", "push"]);
const environment = process.argv.find((arg) => arg.startsWith("--environment="))?.split("=")[1] ?? null;
const includeAll = process.argv.includes("--include-all");

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

const duplicateVersions = Object.entries(
  localMigrations.reduce((versions, file) => {
    const version = file.match(/^(\d+)_/)?.[1];
    if (version) (versions[version] ??= []).push(file);
    return versions;
  }, {}),
).filter(([, files]) => files.length > 1);

if (duplicateVersions.length) {
  console.error("Duplicate local migration versions found:");
  for (const [version, files] of duplicateVersions) {
    console.error(`  ${version}: ${files.join(", ")}`);
  }
  console.error("Rename the newer migration to the next unused version before pushing.");
  process.exit(1);
}

if (environment && !["staging", "production"].includes(environment)) {
  console.error("Environment must be staging or production.");
  process.exit(1);
}

const projectRef = getProjectRef(environment);
const linkedProjectRef = readLinkedProjectRef();
if (environment && !projectRef) {
  console.error(`Could not find a Supabase URL in .env.${environment}.local.`);
  process.exit(1);
}
if (environment && linkedProjectRef && projectRef !== linkedProjectRef) {
  console.error(`Refusing to run ${environment} migrations against the linked project.`);
  console.error(`Expected: ${projectRef}`);
  console.error(`Linked:   ${linkedProjectRef}`);
  console.error(`Run: npx supabase link --project-ref ${projectRef}`);
  process.exit(1);
}
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
  runSupabase(["db", "push", "--linked", ...(includeAll ? ["--include-all"] : [])]);
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

function getProjectRef(environment) {
  const env = readEnvFile(environment ? `.env.${environment}.local` : ".env.local");
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? env[`${environment?.toUpperCase()}_SUPABASE_URL`];
  const match = url?.match(/^https:\/\/([a-z0-9-]+)\.supabase\.co\/?$/i);
  return match?.[1] ?? null;
}

function readLinkedProjectRef() {
  const path = "supabase/.temp/project-ref";
  return existsSync(path) ? readFileSync(path, "utf8").trim() || null : null;
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
