const fs = require("node:fs");
const path = require("node:path");
const spiritRoots = require("../config/spirit-roots");
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

function pickSpiritRoot(userId) {
  const numericSeed = [...String(userId)].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return spiritRoots[numericSeed % spiritRoots.length];
}

function buildCultivation(userId) {
  const spiritRoot = pickSpiritRoot(userId);
  return {
    realm: "pham_nhan",
    realmIndex: 0,
    spiritRootKey: spiritRoot.key,
    dwellingLevel: 1,
    equippedArtifactId: null
  };
}

function normalizeCultivation(userId, cultivation = {}) {
  const spiritRoot = spiritRoots.find((entry) => entry.key === cultivation.spiritRootKey) || pickSpiritRoot(userId);
  return {
    realm: cultivation.realm || "pham_nhan",
    realmIndex: cultivation.realmIndex ?? 0,
    spiritRootKey: spiritRoot.key,
    dwellingLevel: cultivation.dwellingLevel || 1,
    equippedArtifactId: cultivation.equippedArtifactId || null
  };
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
    cultivation: buildCultivation(userId),
    cooldowns: {
      dailyAt: 0,
      workAt: 0,
      secretRealmAt: 0
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
  } else {
    store.players[userId].cultivation = normalizeCultivation(userId, store.players[userId].cultivation);
    store.players[userId].cooldowns = {
      dailyAt: store.players[userId].cooldowns?.dailyAt || 0,
      workAt: store.players[userId].cooldowns?.workAt || 0,
      secretRealmAt: store.players[userId].cooldowns?.secretRealmAt || 0
    };
    writeStore(store);
  }
  return store.players[userId];
}

function getPlayerLocal(userId) {
  const store = readStore();
  const player = store.players[userId] || null;
  if (!player) {
    return null;
  }
  player.cultivation = normalizeCultivation(userId, player.cultivation);
  player.cooldowns = {
    dailyAt: player.cooldowns?.dailyAt || 0,
    workAt: player.cooldowns?.workAt || 0,
    secretRealmAt: player.cooldowns?.secretRealmAt || 0
  };
  return player;
}

function updatePlayerLocal(userId, patch) {
  const store = readStore();
  const current = store.players[userId];
  store.players[userId] = {
    ...current,
    ...patch,
    cultivation: normalizeCultivation(userId, patch.cultivation || current.cultivation),
    cooldowns: patch.cooldowns || current.cooldowns,
    updatedAt: new Date().toISOString()
  };
  writeStore(store);
  return store.players[userId];
}

function listPlayersLocal() {
  const store = readStore();
  return Object.values(store.players || {}).map((player) => ({
    ...player,
    cultivation: normalizeCultivation(player.userId, player.cultivation),
    cooldowns: {
      dailyAt: player.cooldowns?.dailyAt || 0,
      workAt: player.cooldowns?.workAt || 0,
      secretRealmAt: player.cooldowns?.secretRealmAt || 0
    }
  }));
}

async function ensurePlayer(userId, username) {
  if (supabaseStore.hasSupabaseConfig()) {
    try {
      const player = await supabaseStore.ensurePlayer(userId, username);
      if (player) {
        return player;
      }
    } catch (error) {
      console.error("Supabase ensurePlayer loi, fallback ve JSON:", error.message);
    }
  }

  return ensurePlayerLocal(userId, username);
}

async function getPlayer(userId) {
  if (supabaseStore.hasSupabaseConfig()) {
    try {
      const player = await supabaseStore.getPlayer(userId);
      if (player) {
        return player;
      }
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

async function listPlayers() {
  if (supabaseStore.hasSupabaseConfig()) {
    try {
      return await supabaseStore.listPlayers();
    } catch (error) {
      console.error("Supabase listPlayers loi, fallback ve JSON:", error.message);
    }
  }

  return listPlayersLocal();
}

module.exports = {
  ensurePlayer,
  getPlayer,
  updatePlayer,
  listPlayers
};
