const fs = require("node:fs");
const path = require("node:path");
const supabaseRoomStore = require("./supabase-room-store");

const dataDir = process.env.GAME_DATA_DIR || path.join(__dirname, "..", "..", "data");
const roomStores = new Set();

function describeError(error) {
  return {
    name: error?.name,
    message: error?.message,
    cause: error?.cause?.message || error?.cause?.code || null
  };
}

function createRoomStore({ gameKey, fileName, defaults = {} }) {
  const dataFile = path.join(dataDir, fileName);
  let cache = null;

  function ensureStore() {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    if (!fs.existsSync(dataFile)) {
      fs.writeFileSync(dataFile, JSON.stringify({ rooms: {} }, null, 2));
    }
  }

  function readStoreFromDisk() {
    ensureStore();
    const store = JSON.parse(fs.readFileSync(dataFile, "utf8"));
    return {
      rooms: store.rooms || {},
      pendingUpserts: store.pendingUpserts || {},
      pendingDeletes: store.pendingDeletes || []
    };
  }

  function writeStore(store) {
    ensureStore();
    fs.writeFileSync(dataFile, JSON.stringify(store, null, 2));
  }

  function ensureCache() {
    if (!cache) {
      cache = readStoreFromDisk();
    }
    return cache;
  }

  function persistCache() {
    writeStore(ensureCache());
  }

  async function hydrateRooms() {
    const store = readStoreFromDisk();

    if (!supabaseRoomStore.hasSupabaseConfig()) {
      cache = store;
      return store.rooms;
    }

    try {
      cache = store;
      await syncPending();
      const rooms = await supabaseRoomStore.listRooms(gameKey);
      cache = { rooms, pendingUpserts: {}, pendingDeletes: [] };
      persistCache();
      return rooms;
    } catch (error) {
      cache = store;
      console.error(`[room-store:${gameKey}] Supabase hydrate loi, fallback ve JSON:`, describeError(error));
      return store.rooms;
    }
  }

  function buildRoomPayload(config) {
    return {
      enabled: true,
      ...defaults,
      ...config,
      updatedAt: new Date().toISOString()
    };
  }

  function saveRoomLocally(channelId, config) {
    const store = ensureCache();
    store.rooms[channelId] = buildRoomPayload(config);
    store.pendingUpserts[channelId] = store.rooms[channelId];
    store.pendingDeletes = store.pendingDeletes.filter((id) => id !== channelId);
    persistCache();
    return store.rooms[channelId];
  }

  function enableRoom(channelId, config) {
    const room = saveRoomLocally(channelId, config);

    if (supabaseRoomStore.hasSupabaseConfig()) {
      supabaseRoomStore.upsertRoom(gameKey, channelId, room)
        .then(() => clearPendingUpsert(channelId, room.updatedAt))
        .catch((error) => console.error(`[room-store:${gameKey}] Khong the luu phong len Supabase:`, describeError(error)));
    }

    return room;
  }

  async function enableRoomPersistent(channelId, config) {
    const room = saveRoomLocally(channelId, config);

    if (!supabaseRoomStore.hasSupabaseConfig()) {
      return { room, persisted: false, reason: "Supabase chưa được cấu hình." };
    }

    try {
      await supabaseRoomStore.upsertRoom(gameKey, channelId, room);
      clearPendingUpsert(channelId, room.updatedAt);
      return { room, persisted: true, reason: null };
    } catch (error) {
      console.error(`[room-store:${gameKey}] Khong the luu phong len Supabase:`, describeError(error));
      return { room, persisted: false, reason: error?.cause?.message || error?.message || "Không rõ lỗi Supabase." };
    }
  }

  function disableRoom(channelId) {
    const store = ensureCache();
    delete store.rooms[channelId];
    delete store.pendingUpserts[channelId];
    if (!store.pendingDeletes.includes(channelId)) store.pendingDeletes.push(channelId);
    persistCache();

    if (supabaseRoomStore.hasSupabaseConfig()) {
      supabaseRoomStore.deleteRoom(gameKey, channelId)
        .then(() => clearPendingDelete(channelId))
        .catch((error) => console.error(`[room-store:${gameKey}] Khong the xoa phong tren Supabase:`, describeError(error)));
    }
  }

  function getRoom(channelId) {
    const store = ensureCache();
    return store.rooms[channelId] || null;
  }

  function isEnabledRoom(channelId) {
    return Boolean(getRoom(channelId)?.enabled);
  }

  function listRooms() {
    return { ...ensureCache().rooms };
  }

  function clearPendingUpsert(channelId, updatedAt) {
    const store = ensureCache();
    if (store.pendingUpserts[channelId]?.updatedAt === updatedAt) {
      delete store.pendingUpserts[channelId];
      persistCache();
    }
  }

  function clearPendingDelete(channelId) {
    const store = ensureCache();
    store.pendingDeletes = store.pendingDeletes.filter((id) => id !== channelId);
    persistCache();
  }

  async function syncPending() {
    const store = ensureCache();
    if (!supabaseRoomStore.hasSupabaseConfig()) {
      return { synced: 0, pending: Object.keys(store.pendingUpserts).length + store.pendingDeletes.length };
    }
    let synced = 0;
    for (const [channelId, room] of Object.entries(store.pendingUpserts)) {
      await supabaseRoomStore.upsertRoom(gameKey, channelId, room);
      clearPendingUpsert(channelId, room.updatedAt);
      synced += 1;
    }
    for (const channelId of [...store.pendingDeletes]) {
      await supabaseRoomStore.deleteRoom(gameKey, channelId);
      clearPendingDelete(channelId);
      synced += 1;
    }
    const latest = ensureCache();
    return { synced, pending: Object.keys(latest.pendingUpserts).length + latest.pendingDeletes.length };
  }

  const api = {
    hydrateRooms,
    enableRoom,
    enableRoomPersistent,
    disableRoom,
    getRoom,
    listRooms,
    isEnabledRoom,
    syncPending
  };
  roomStores.add(api);
  return api;
}

async function flushPendingRoomChanges() {
  let synced = 0;
  let pending = 0;
  for (const store of roomStores) {
    const result = await store.syncPending();
    synced += result.synced;
    pending += result.pending;
  }
  return { synced, pending };
}

module.exports = {
  createRoomStore,
  flushPendingRoomChanges
};
