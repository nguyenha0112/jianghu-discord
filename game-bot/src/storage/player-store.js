const fs = require("node:fs");
const path = require("node:path");

const dataDir = path.join(__dirname, "..", "..", "data");
const dataFile = path.join(dataDir, "players.json");

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

function defaultPlayer(userId, username) {
  return {
    userId,
    username,
    wallet: {
      xu: 0,
      ngoc: 0
    },
    inventory: {},
    profession: {
      current: null,
      xp: 0,
      levels: {}
    },
    cooldowns: {
      dailyAt: 0,
      workAt: 0
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function ensurePlayer(userId, username) {
  const store = readStore();
  if (!store.players[userId]) {
    store.players[userId] = defaultPlayer(userId, username);
    writeStore(store);
  }
}

function getPlayer(userId) {
  const store = readStore();
  return store.players[userId];
}

function updatePlayer(userId, patch) {
  const store = readStore();
  const current = store.players[userId];
  store.players[userId] = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString()
  };
  writeStore(store);
  return store.players[userId];
}

module.exports = {
  ensurePlayer,
  getPlayer,
  updatePlayer
};
