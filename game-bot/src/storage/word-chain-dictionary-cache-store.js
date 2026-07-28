const fs = require("node:fs");
const path = require("node:path");

const dataDir = path.join(__dirname, "..", "..", "data");
const dataFile = path.join(dataDir, "word-chain-dictionary-cache.json");

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

function getCachedDictionaryPhrase(phrase) {
  const store = readStore();
  return store.phrases[phrase] || null;
}

function setCachedDictionaryPhrase(phrase, payload) {
  const store = readStore();
  store.phrases[phrase] = {
    phrase,
    ...payload,
    updatedAt: new Date().toISOString()
  };
  writeStore(store);
  return store.phrases[phrase];
}

module.exports = {
  getCachedDictionaryPhrase,
  setCachedDictionaryPhrase
};
