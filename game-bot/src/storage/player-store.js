const fs = require("node:fs");
const path = require("node:path");
const supabaseStore = require("./supabase-store");

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
    stats: {
      playerLevel: 1,
      playerXp: 0,
      totalXuEarned: 0,
      totalNgocEarned: 0,
      totalWorkActions: 0,
      totalItemsSold: 0
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

function ensurePlayerLocal(userId, username) {
  const store = readStore();
  if (!store.players[userId]) {
    store.players[userId] = defaultPlayer(userId, username);
    writeStore(store);
  }
  return store.players[userId];
}

function getPlayerLocal(userId) {
  const store = readStore();
  return store.players[userId] || null;
}

function updatePlayerLocal(userId, patch) {
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

async function ensurePlayer(userId, username) {
  if (supabaseStore.hasSupabaseConfig()) {
    try {
      return await supabaseStore.ensurePlayer(userId, username);
    } catch (error) {
      console.error("Supabase ensurePlayer loi, fallback ve JSON:", error.message);
    }
  }

  return ensurePlayerLocal(userId, username);
}

async function getPlayer(userId) {
  if (supabaseStore.hasSupabaseConfig()) {
    try {
      return await supabaseStore.getPlayer(userId);
    } catch (error) {
      console.error("Supabase getPlayer loi, fallback ve JSON:", error.message);
    }
  }

  return getPlayerLocal(userId);
}

async function updatePlayer(userId, patch) {
  if (supabaseStore.hasSupabaseConfig()) {
    try {
      return await supabaseStore.updatePlayer(userId, patch);
    } catch (error) {
      console.error("Supabase updatePlayer loi, fallback ve JSON:", error.message);
    }
  }

  return updatePlayerLocal(userId, patch);
}

module.exports = {
  ensurePlayer,
  getPlayer,
  updatePlayer
};
