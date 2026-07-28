const fs = require("node:fs");
const path = require("node:path");

const dataDir = path.join(__dirname, "..", "..", "data");
const dataFile = path.join(dataDir, "word-chain-ranking.json");

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
    pve: {
      wins: 0,
      points: 0,
      games: 0
    },
    pvp: {
      wins: 0,
      points: 0,
      games: 0
    },
    updatedAt: new Date().toISOString()
  };
}

function updateWordChainRanking(userId, username, mode, patch) {
  const store = readStore();
  const current = store.players[userId] || defaultRanking(userId, username);
  const nextMode = {
    ...current[mode],
    wins: current[mode].wins + (patch.wins || 0),
    points: current[mode].points + (patch.points || 0),
    games: current[mode].games + (patch.games || 0)
  };

  store.players[userId] = {
    ...current,
    username,
    [mode]: nextMode,
    updatedAt: new Date().toISOString()
  };

  writeStore(store);
  return store.players[userId];
}

function getWordChainRanking(mode = "pve", limit = 10) {
  const store = readStore();
  return Object.values(store.players)
    .filter((entry) => entry?.[mode] && (entry[mode].wins > 0 || entry[mode].points > 0 || entry[mode].games > 0))
    .sort((a, b) => {
      if (b[mode].wins !== a[mode].wins) {
        return b[mode].wins - a[mode].wins;
      }
      if (b[mode].points !== a[mode].points) {
        return b[mode].points - a[mode].points;
      }
      return b[mode].games - a[mode].games;
    })
    .slice(0, limit);
}

module.exports = {
  updateWordChainRanking,
  getWordChainRanking
};
