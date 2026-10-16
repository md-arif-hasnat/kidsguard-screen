import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const projectRoot = process.cwd();
const sourceRoots = ["app", "components", "lib"];
const sourceExtensions = new Set([".js", ".jsx", ".ts", ".tsx"]);
const forbiddenPatterns = [
  { label: "mock-data module", pattern: /@\/lib\/mockData/ },
  { label: "runtime mock switch", pattern: /\bshowMocks\b/ },
  { label: "placeholder family identifier", pattern: /mock[-_]family/i },
  { label: "placeholder child identifier", pattern: /\bchild_001\b/ },
  { label: "production mock constant", pattern: /\bMOCK_[A-Z0-9_]+\b/ },
];

async function listSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listSourceFiles(path)));
    } else if (sourceExtensions.has(extname(entry.name))) {
      files.push(path);
    }
  }

  return files;
}

const files = (
  await Promise.all(sourceRoots.map((root) => listSourceFiles(join(projectRoot, root))))
).flat();
const violations = [];

for (const file of files) {
  const contents = await readFile(file, "utf8");
  for (const { label, pattern } of forbiddenPatterns) {
    if (pattern.test(contents)) {
      violations.push(`${relative(projectRoot, file)}: ${label}`);
    }
  }
}

if (violations.length > 0) {
  console.error("Production mock-data guard failed:\n");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(`Production mock-data guard passed (${files.length} source files checked).`);
