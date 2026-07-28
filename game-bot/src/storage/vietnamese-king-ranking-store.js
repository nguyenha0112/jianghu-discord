const fs = require("node:fs");
const path = require("node:path");

const dataDir = path.join(__dirname, "..", "..", "data");
const dataFile = path.join(dataDir, "vietnamese-king-ranking.json");

function ensureStore() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify({ players: {} }, null, 2));
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

function defaultRanking(userId, username) {
  return {
    userId,
    username,
    wins: 0,
    points: 0,
    games: 0,
    updatedAt: new Date().toISOString()
  };
}

function updateVietnameseKingRanking(userId, username, patch) {
  const store = readStore();
  const current = store.players[userId] || defaultRanking(userId, username);
  store.players[userId] = {
    ...current,
    username,
    wins: current.wins + (patch.wins || 0),
    points: current.points + (patch.points || 0),
    games: current.games + (patch.games || 0),
    updatedAt: new Date().toISOString()
  };
  writeStore(store);
  return store.players[userId];
}

function getVietnameseKingRanking(limit = 10) {
  const store = readStore();
  return Object.values(store.players)
    .filter((entry) => entry.wins > 0 || entry.points > 0 || entry.games > 0)
    .sort((a, b) => {
      if (b.wins !== a.wins) {
        return b.wins - a.wins;
      }
      if (b.points !== a.points) {
        return b.points - a.points;
      }
      return b.games - a.games;
    })
    .slice(0, limit);
}

module.exports = {
  updateVietnameseKingRanking,
  getVietnameseKingRanking
};
