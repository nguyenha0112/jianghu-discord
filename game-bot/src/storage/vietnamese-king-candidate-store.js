const fs = require("node:fs");
const path = require("node:path");

const dataDir = path.join(__dirname, "..", "..", "data");
const dataFile = path.join(dataDir, "vietnamese-king-candidates.json");

function ensureStore() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(
      dataFile,
      JSON.stringify(
        {
          items: {}
        },
        null,
        2
      )
    );
  }
}

function readStore() {
  ensureStore();
  return JSON.parse(fs.readFileSync(dataFile, "utf8"));
}

function writeStore(store) {
  ensureStore();
  fs.writeFileSync(dataFile, JSON.stringify(store, null, 2));
}

function normalizeAnswer(input) {
  return (input || "")
    .toLowerCase()
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function buildCandidateId(normalizedAnswer) {
  return normalizedAnswer
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\u00C0-\u024F-]/gu, "")
    .slice(0, 80);
}

function upsertCandidate(candidate) {
  const store = readStore();
  const normalizedAnswer = normalizeAnswer(candidate.answer);
  if (!normalizedAnswer) {
    return null;
  }

  const id = candidate.id || buildCandidateId(normalizedAnswer);
  const current = store.items[id] || {
    id,
    answer: normalizedAnswer,
    type: candidate.type || "word",
    difficulty: candidate.difficulty || "medium",
    hint: candidate.hint || "",
    meaning: candidate.meaning || "",
    status: candidate.status || "pending",
    source: candidate.source || "manual",
    tags: candidate.tags || [],
    notes: candidate.notes || "",
    firstSeenAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  store.items[id] = {
    ...current,
    answer: normalizedAnswer,
    type: candidate.type || current.type,
    difficulty: candidate.difficulty || current.difficulty,
    hint: candidate.hint ?? current.hint,
    meaning: candidate.meaning ?? current.meaning,
    status: candidate.status || current.status,
    source: candidate.source || current.source,
    tags: candidate.tags || current.tags || [],
    notes: candidate.notes ?? current.notes,
    updatedAt: new Date().toISOString()
  };

  writeStore(store);
  return store.items[id];
}

function listCandidates({ status = null, limit = 20 } = {}) {
  const store = readStore();
  return Object.values(store.items)
    .filter((item) => (status ? item.status === status : true))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, limit);
}

function getCandidateSummary() {
  const store = readStore();
  const items = Object.values(store.items);
  return {
    total: items.length,
    pending: items.filter((item) => item.status === "pending").length,
    approved: items.filter((item) => item.status === "approved").length,
    rejected: items.filter((item) => item.status === "rejected").length
  };
}

module.exports = {
  normalizeAnswer,
  upsertCandidate,
  listCandidates,
  getCandidateSummary
};
