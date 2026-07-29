const fs = require("node:fs");
const path = require("node:path");

const dataDir = path.join(__dirname, "..", "..", "data");
const rankingFile = path.join(dataDir, "xidach-ranking.json");
const historyFile = path.join(dataDir, "xidach-history.json");
const MAX_HISTORY = 20;

function ensureStore() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(rankingFile)) {
    fs.writeFileSync(rankingFile, JSON.stringify({ players: {} }, null, 2));
  }

  if (!fs.existsSync(historyFile)) {
    fs.writeFileSync(historyFile, JSON.stringify({ entries: [] }, null, 2));
  }
}

function readJson(filePath) {
  ensureStore();
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, payload) {
  ensureStore();
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}

function defaultRanking(userId, username) {
  return {
    userId,
    username,
    wins: 0,
    pushes: 0,
    games: 0,
    profitXu: 0,
    bestWinXu: 0,
    updatedAt: new Date().toISOString()
  };
}

function updateXiDachRanking(userId, username, patch) {
  const store = readJson(rankingFile);
  const current = store.players[userId] || defaultRanking(userId, username);

  store.players[userId] = {
    ...current,
    username,
    wins: current.wins + (patch.wins || 0),
    pushes: current.pushes + (patch.pushes || 0),
    games: current.games + (patch.games || 0),
    profitXu: current.profitXu + (patch.profitXu || 0),
    bestWinXu: Math.max(current.bestWinXu, patch.bestWinXu || 0),
    updatedAt: new Date().toISOString()
  };

  writeJson(rankingFile, store);
  return store.players[userId];
}

function getXiDachRanking(limit = 10) {
  const store = readJson(rankingFile);
  return Object.values(store.players)
    .filter((entry) => entry.wins > 0 || entry.pushes > 0 || entry.games > 0 || entry.profitXu !== 0 || entry.bestWinXu > 0)
    .sort((a, b) => {
      if (b.wins !== a.wins) {
        return b.wins - a.wins;
      }
      if (b.profitXu !== a.profitXu) {
        return b.profitXu - a.profitXu;
      }
      if (b.bestWinXu !== a.bestWinXu) {
        return b.bestWinXu - a.bestWinXu;
      }
      return b.games - a.games;
    })
    .slice(0, limit);
}

function addXiDachHistoryEntry(entry) {
  const store = readJson(historyFile);
  store.entries.unshift({
    ...entry,
    createdAt: new Date().toISOString()
  });
  if (store.entries.length > MAX_HISTORY) {
    store.entries.length = MAX_HISTORY;
  }
  writeJson(historyFile, store);
  return store.entries[0];
}

function getXiDachHistory(limit = 10) {
  const store = readJson(historyFile);
  return store.entries.slice(0, limit);
}

module.exports = {
  updateXiDachRanking,
  getXiDachRanking,
  addXiDachHistoryEntry,
  getXiDachHistory
};
