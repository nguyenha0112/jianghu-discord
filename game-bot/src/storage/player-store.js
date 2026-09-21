const fs = require("node:fs");
const path = require("node:path");
const spiritRoots = require("../config/spirit-roots");
const supabaseStore = require("./supabase-store");

const dataDir = process.env.GAME_DATA_DIR || path.join(__dirname, "..", "..", "data");
const dataFile = path.join(dataDir, "players.json");
const syncStateFile = path.join(dataDir, "player-sync-state.json");

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

function readSyncState() {
  ensureStore();
  if (!fs.existsSync(syncStateFile)) return { dirtyPlayers: [] };
  return JSON.parse(fs.readFileSync(syncStateFile, "utf8"));
}

function writeSyncState(state) {
  ensureStore();
  fs.writeFileSync(syncStateFile, JSON.stringify(state, null, 2));
}

function isPlayerDirty(userId) {
  return readSyncState().dirtyPlayers.includes(userId);
}

function markPlayerDirty(userId) {
  const state = readSyncState();
  if (!state.dirtyPlayers.includes(userId)) state.dirtyPlayers.push(userId);
  writeSyncState(state);
}

function clearPlayerDirty(userId) {
  const state = readSyncState();
  state.dirtyPlayers = state.dirtyPlayers.filter((id) => id !== userId);
  writeSyncState(state);
}

function savePlayerLocal(player) {
  const store = readStore();
  store.players[player.userId] = {
    ...player,
    cultivation: normalizeCultivation(player.userId, player.cultivation),
    updatedAt: player.updatedAt || new Date().toISOString()
  };
  writeStore(store);
  return store.players[player.userId];
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
  const current = store.players[userId] || defaultPlayer(userId, patch.username || `Discord-${userId}`);
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
  if (isPlayerDirty(userId)) return ensurePlayerLocal(userId, username);
  if (supabaseStore.hasSupabaseConfig()) {
    try {
      const player = await supabaseStore.ensurePlayer(userId, username);
      if (player) {
        return savePlayerLocal(player);
      }
    } catch (error) {
      console.error("Supabase ensurePlayer loi, fallback ve JSON:", error.message);
    }
  }

  const player = ensurePlayerLocal(userId, username);
  markPlayerDirty(userId);
  return player;
}

async function getPlayer(userId) {
  if (isPlayerDirty(userId)) return getPlayerLocal(userId);
  if (supabaseStore.hasSupabaseConfig()) {
    try {
      const player = await supabaseStore.getPlayer(userId);
      if (player) {
        return savePlayerLocal(player);
      }
    } catch (error) {
      console.error("Supabase getPlayer loi, fallback ve JSON:", error.message);
    }
  }

  return getPlayerLocal(userId);
}

async function updatePlayer(userId, patch) {
  if (isPlayerDirty(userId)) return updatePlayerLocal(userId, patch);
  if (supabaseStore.hasSupabaseConfig()) {
    try {
      const player = await supabaseStore.updatePlayer(userId, patch);
      clearPlayerDirty(userId);
      return savePlayerLocal(player);
    } catch (error) {
      console.error("Supabase updatePlayer loi, fallback ve JSON:", error.message);
    }
  }

  const player = updatePlayerLocal(userId, patch);
  markPlayerDirty(userId);
  return player;
}

async function listPlayers() {
  if (supabaseStore.hasSupabaseConfig()) {
    try {
      const remotePlayers = await supabaseStore.listPlayers();
      const dirtyIds = new Set(readSyncState().dirtyPlayers);
      const cleanRemote = remotePlayers.filter((player) => !dirtyIds.has(player.userId));
      return [...listPlayersLocal().filter((player) => dirtyIds.has(player.userId)), ...cleanRemote];
    } catch (error) {
      console.error("Supabase listPlayers loi, fallback ve JSON:", error.message);
    }
  }

  return listPlayersLocal();
}

async function syncDirtyPlayers() {
  if (!supabaseStore.hasSupabaseConfig()) return { synced: 0, pending: readSyncState().dirtyPlayers.length };
  const dirtyIds = [...readSyncState().dirtyPlayers];
  let synced = 0;
  for (const userId of dirtyIds) {
    const player = getPlayerLocal(userId);
    if (!player) {
      clearPlayerDirty(userId);
      continue;
    }
    await supabaseStore.upsertPlayerSnapshot(player);
    clearPlayerDirty(userId);
    synced += 1;
  }
  return { synced, pending: readSyncState().dirtyPlayers.length };
}

module.exports = {
  ensurePlayer,
  getPlayer,
  updatePlayer,
  listPlayers,
  syncDirtyPlayers
};
