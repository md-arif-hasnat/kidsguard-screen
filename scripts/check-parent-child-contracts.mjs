import { readFile } from "node:fs/promises";

const files = {
  parentCommands: "web-dashboard/lib/repositories/CommandRepository.ts",
  childModels: "app/src/main/java/com/example/kidsguard/sync/SyncModels.kt",
  childHandler: "app/src/main/java/com/example/kidsguard/sync/RemoteCommandHandler.kt",
  childProvider: "app/src/main/java/com/example/kidsguard/sync/FirebaseRemoteSyncProvider.kt",
  childService: "app/src/main/java/com/example/kidsguard/tracking/BackgroundTrackingService.kt"
};

const sources = Object.fromEntries(
  await Promise.all(
    Object.entries(files).map(async ([name, path]) => [name, await readFile(path, "utf8")])
  )
);

function extractBlock(source, declaration) {
  const start = source.indexOf(declaration);
  if (start < 0) throw new Error(`Missing declaration: ${declaration}`);

  const open = source.indexOf("{", start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(open + 1, index);
  }

  throw new Error(`Unclosed declaration: ${declaration}`);
}

const parentCommandBlock = extractBlock(sources.parentCommands, "export enum CommandType");
const parentCommands = new Set(
  [...parentCommandBlock.matchAll(/\b[A-Z][A-Z0-9_]*\s*=\s*"([A-Z][A-Z0-9_]*)"/g)]
    .map(match => match[1])
);

const childCommandBlock = extractBlock(sources.childModels, "enum class CommandType");
const childCommands = new Set(
  childCommandBlock
    .replace(/\/\/.*$/gm, "")
    .split(",")
    .map(value => value.trim())
    .filter(value => /^[A-Z][A-Z0-9_]*$/.test(value))
);

const missingOnChild = [...parentCommands].filter(command => !childCommands.has(command));
const missingOnParent = [...childCommands].filter(command => !parentCommands.has(command));

if (missingOnChild.length || missingOnParent.length) {
  throw new Error([
    "Parent/child remote-command contract drift detected.",
    missingOnChild.length ? `Missing on child: ${missingOnChild.join(", ")}` : "",
    missingOnParent.length ? `Missing on parent: ${missingOnParent.join(", ")}` : ""
  ].filter(Boolean).join("\n"));
}

const unhandledCommands = [...childCommands].filter(
  command => !sources.childHandler.includes(`CommandType.${command}`)
);
if (unhandledCommands.length) {
  throw new Error(`Child handler does not cover: ${unhandledCommands.join(", ")}`);
}

const requiredProviderContracts = [
  '.whereEqualTo("status", "PENDING")',
  'CommandStatus.DELIVERED.name',
  'CommandStatus.APPLIED',
  'CommandStatus.FAILED',
  'CommandStatus.EXPIRED'
];
for (const contract of requiredProviderContracts) {
  if (!sources.childProvider.includes(contract)) {
    throw new Error(`Remote-command delivery contract missing: ${contract}`);
  }
}

const requiredHeartbeatContracts = [
  "childStatusManager.startPeriodicSync()",
  "childStatusManager.stopPeriodicSync()",
  "return START_STICKY"
];
for (const contract of requiredHeartbeatContracts) {
  if (!sources.childService.includes(contract)) {
    throw new Error(`Background heartbeat contract missing: ${contract}`);
  }
}

console.log(
  `Parent/child production contracts passed (${parentCommands.size} commands, background heartbeat enabled).`
);
