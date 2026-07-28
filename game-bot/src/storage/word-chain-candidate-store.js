const fs = require("node:fs");
const path = require("node:path");

const dataDir = path.join(__dirname, "..", "..", "data");
const dataFile = path.join(dataDir, "word-chain-candidates.json");

function ensureStore() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify({ phrases: {} }, null, 2));
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

function recordCandidatePhrase(phrase, meta = {}) {
  const store = readStore();
  const current = store.phrases[phrase] || {
    phrase,
    count: 0,
    firstSeenAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    guildId: meta.guildId || null,
    channelId: meta.channelId || null,
    examples: []
  };

  current.count += 1;
  current.lastSeenAt = new Date().toISOString();
  current.guildId = meta.guildId || current.guildId;
  current.channelId = meta.channelId || current.channelId;
  current.status = meta.status || current.status || "pending";
  current.source = meta.source || current.source || null;
  current.meaning = meta.meaning || current.meaning || null;

  if (meta.username && !current.examples.includes(meta.username)) {
    current.examples = [...current.examples, meta.username].slice(-5);
  }

  store.phrases[phrase] = current;
  writeStore(store);
  return current;
}

module.exports = {
  recordCandidatePhrase
};
