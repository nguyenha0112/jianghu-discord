const fs = require("node:fs");
const path = require("node:path");

const dataDir = path.join(__dirname, "..", "..", "data");
const dataFile = path.join(dataDir, "transactions.json");

function ensureStore() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify({ transactions: [] }, null, 2));
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

function appendTransaction(entry) {
  const store = readStore();
  store.transactions.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    ...entry
  });
  writeStore(store);
}

module.exports = {
  appendTransaction
};
