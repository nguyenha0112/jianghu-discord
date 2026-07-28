const fs = require("node:fs");
const path = require("node:path");

const dataDir = path.join(__dirname, "..", "..", "data");
const dataFile = path.join(dataDir, "monthly-rewards.json");

function ensureStore() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify({ periods: {} }, null, 2));
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

function buildDefaultPeriod(periodId) {
  return {
    periodId,
    status: "open",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    snapshot: [],
    rewards: [],
    notes: []
  };
}

function getPeriod(periodId) {
  const store = readStore();
  return store.periods[periodId] || buildDefaultPeriod(periodId);
}

function savePeriod(period) {
  const store = readStore();
  store.periods[period.periodId] = {
    ...buildDefaultPeriod(period.periodId),
    ...period,
    updatedAt: new Date().toISOString()
  };
  writeStore(store);
  return store.periods[period.periodId];
}

function listPeriods(limit = 6) {
  const store = readStore();
  return Object.values(store.periods || {})
    .sort((left, right) => right.periodId.localeCompare(left.periodId))
    .slice(0, limit);
}

module.exports = {
  getPeriod,
  savePeriod,
  listPeriods
};
