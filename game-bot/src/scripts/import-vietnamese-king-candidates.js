const fs = require("node:fs");
const path = require("node:path");
const { normalizeAnswer, upsertCandidate } = require("../storage/vietnamese-king-candidate-store");

const sourceFile = process.argv[2];

function inferType(answer) {
  const tokenCount = normalizeAnswer(answer).split(" ").filter(Boolean).length;
  if (tokenCount >= 6) {
    return "ca_dao";
  }
  if (tokenCount >= 4) {
    return "proverb";
  }
  return "word";
}

function inferDifficulty(answer) {
  const tokenCount = normalizeAnswer(answer).split(" ").filter(Boolean).length;
  if (tokenCount >= 6) {
    return "hard";
  }
  if (tokenCount >= 4) {
    return "medium";
  }
  return "easy";
}

function parseLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const segments = trimmed.split("|").map((item) => item.trim());
  const answer = segments[0];
  if (!answer) {
    return null;
  }

  return {
    answer,
    type: segments[1] || inferType(answer),
    difficulty: segments[2] || inferDifficulty(answer),
    hint: segments[3] || "",
    meaning: segments[4] || "",
    source: segments[5] || "bulk-import",
    status: "pending"
  };
}

function main() {
  if (!sourceFile) {
    console.error("Thiếu đường dẫn file import. Ví dụ: node src/scripts/import-vietnamese-king-candidates.js data/vietnamese-king-bulk.txt");
    process.exit(1);
  }

  const resolvedPath = path.resolve(process.cwd(), sourceFile);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`Không tìm thấy file: ${resolvedPath}`);
    process.exit(1);
  }

  const lines = fs.readFileSync(resolvedPath, "utf8").split(/\r?\n/u);
  let imported = 0;

  for (const line of lines) {
    const candidate = parseLine(line);
    if (!candidate) {
      continue;
    }
    upsertCandidate(candidate);
    imported += 1;
  }

  console.log(JSON.stringify({ ok: true, imported, file: resolvedPath }, null, 2));
}

main();
