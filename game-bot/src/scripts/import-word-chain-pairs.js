const fs = require("node:fs");
const path = require("node:path");

const repoRoot = process.cwd();
const dataDir = path.join(repoRoot, "game-bot", "data");
const outputPath = path.join(dataDir, "reference-wordPairs.json");
const inputPaths = process.argv.slice(2);
const textSources = [
  path.join(dataDir, "vietnamese-compound-phrases.txt"),
  path.join(dataDir, "custom-vietnamese-phrases.txt"),
  path.join(dataDir, "word-chain-preferred-phrases.txt")
];
const bannedPath = path.join(dataDir, "word-chain-banned-phrases.txt");

function maybeRepairMojibake(value) {
  if (!/[ÃÂÄ]/u.test(value)) {
    return value;
  }
  const repaired = Buffer.from(value, "latin1").toString("utf8");
  return /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/iu.test(repaired)
    ? repaired
    : value;
}

function normalizePhrase(input) {
  return maybeRepairMojibake(String(input || ""))
    .toLowerCase()
    .normalize("NFC")
    .replace(/[!"#$%&'()*+,./:;<=>?@[\\\]^_`{|}~]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function splitTokens(phrase) {
  return normalizePhrase(phrase).split(" ").filter(Boolean);
}

function addPair(map, first, second) {
  const normalizedFirst = normalizePhrase(first);
  const normalizedSecond = normalizePhrase(second);
  if (!normalizedFirst || !normalizedSecond) {
    return;
  }
  if (splitTokens(normalizedFirst).length !== 1 || splitTokens(normalizedSecond).length !== 1) {
    return;
  }
  if (!map.has(normalizedFirst)) {
    map.set(normalizedFirst, new Set());
  }
  map.get(normalizedFirst).add(normalizedSecond);
}

function addPhrase(map, phrase) {
  const tokens = splitTokens(phrase);
  if (tokens.length === 2) {
    addPair(map, tokens[0], tokens[1]);
  }
}

function addWordPairsObject(map, obj) {
  const pairs = obj.wordPairs || obj;
  for (const [first, seconds] of Object.entries(pairs)) {
    if (!Array.isArray(seconds)) {
      continue;
    }
    for (const second of seconds) {
      addPair(map, first, second);
    }
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function loadBannedPhrases() {
  if (!fs.existsSync(bannedPath)) {
    return new Set();
  }
  return new Set(
    fs
      .readFileSync(bannedPath, "utf8")
      .split(/\r?\n/u)
      .map((line) => splitTokens(line))
      .filter((tokens) => tokens.length === 2)
      .map((tokens) => tokens.join(" "))
  );
}

function main() {
  if (inputPaths.length === 0) {
    throw new Error("Usage: node game-bot/src/scripts/import-word-chain-pairs.js <wordPairs.json...>");
  }

  const map = new Map();
  if (fs.existsSync(outputPath)) {
    addWordPairsObject(map, readJson(outputPath));
  }
  for (const inputPath of inputPaths) {
    addWordPairsObject(map, readJson(inputPath));
  }
  for (const source of textSources) {
    if (!fs.existsSync(source)) {
      continue;
    }
    for (const line of fs.readFileSync(source, "utf8").split(/\r?\n/u)) {
      addPhrase(map, line);
    }
  }

  const banned = loadBannedPhrases();
  for (const [first, seconds] of map.entries()) {
    for (const second of [...seconds]) {
      if (banned.has(`${first} ${second}`)) {
        seconds.delete(second);
      }
    }
    if (seconds.size === 0) {
      map.delete(first);
    }
  }

  const sorted = Object.fromEntries(
    [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b, "vi"))
      .map(([first, seconds]) => [first, [...seconds].sort((a, b) => a.localeCompare(b, "vi"))])
  );
  fs.writeFileSync(outputPath, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");

  const pairCount = Object.values(sorted).reduce((sum, seconds) => sum + seconds.length, 0);
  console.log(`Imported ${pairCount} word-chain pairs across ${Object.keys(sorted).length} first tokens.`);
  console.log(outputPath);
}

main();
