const fs = require("node:fs");
const path = require("node:path");
const supabaseRoomStore = require("./supabase-room-store");

const dataDir = path.join(__dirname, "..", "..", "data");

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
    return JSON.parse(fs.readFileSync(dataFile, "utf8"));
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
      const rooms = await supabaseRoomStore.listRooms(gameKey);
      cache = { rooms };
      persistCache();
      return rooms;
    } catch (error) {
      cache = store;
      console.error(`[room-store:${gameKey}] Supabase hydrate loi, fallback ve JSON:`, error.message);
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

  function enableRoom(channelId, config) {
    const store = ensureCache();
    store.rooms[channelId] = buildRoomPayload(config);
    persistCache();

    if (supabaseRoomStore.hasSupabaseConfig()) {
      supabaseRoomStore.upsertRoom(gameKey, channelId, store.rooms[channelId]).catch((error) => {
        console.error(`[room-store:${gameKey}] Khong the luu phong len Supabase:`, error.message);
      });
    }

    return store.rooms[channelId];
  }

  function disableRoom(channelId) {
    const store = ensureCache();
    delete store.rooms[channelId];
    persistCache();

    if (supabaseRoomStore.hasSupabaseConfig()) {
      supabaseRoomStore.deleteRoom(gameKey, channelId).catch((error) => {
        console.error(`[room-store:${gameKey}] Khong the xoa phong tren Supabase:`, error.message);
      });
    }
  }

  function getRoom(channelId) {
    const store = ensureCache();
    return store.rooms[channelId] || null;
  }

  function isEnabledRoom(channelId) {
    return Boolean(getRoom(channelId)?.enabled);
  }

  return {
    hydrateRooms,
    enableRoom,
    disableRoom,
    getRoom,
    isEnabledRoom
  };
}

module.exports = {
  createRoomStore
};
