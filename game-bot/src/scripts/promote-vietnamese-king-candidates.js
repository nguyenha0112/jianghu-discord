const fs = require("node:fs");
const path = require("node:path");
const { listCandidates } = require("../storage/vietnamese-king-candidate-store");

const puzzlesPath = path.join(__dirname, "..", "..", "data", "vietnamese-king-puzzles.json");

function readPuzzleFile() {
  return JSON.parse(fs.readFileSync(puzzlesPath, "utf8"));
}

function writePuzzleFile(payload) {
  fs.writeFileSync(puzzlesPath, JSON.stringify(payload, null, 2));
}

function buildPuzzleId(type, index) {
  return `${type}-${String(index).padStart(3, "0")}`;
}

function main() {
  const limit = Number(process.argv[2] || 20);
  const payload = readPuzzleFile();
  const existingAnswers = new Set((payload.puzzles || []).map((item) => item.answer));
  const pending = listCandidates({ status: "pending", limit });

  let added = 0;
  let nextIndex = (payload.puzzles || []).length + 1;

  for (const item of pending) {
    if (existingAnswers.has(item.answer)) {
      continue;
    }

    payload.puzzles.push({
      id: item.id || buildPuzzleId(item.type || "word", nextIndex),
      answer: item.answer,
      type: item.type || "word",
      difficulty: item.difficulty || "medium",
      hint: item.hint || "Chưa có gợi ý thủ công.",
      meaning: item.meaning || "Chưa có diễn giải thủ công."
    });

    existingAnswers.add(item.answer);
    nextIndex += 1;
    added += 1;
  }

  payload.updatedAt = new Date().toISOString().slice(0, 10);
  writePuzzleFile(payload);

  console.log(JSON.stringify({ ok: true, added, scanned: pending.length }, null, 2));
}

main();
