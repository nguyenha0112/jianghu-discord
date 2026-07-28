const fs = require("node:fs");
const path = require("node:path");

const dataDir = path.join(__dirname, "..", "..", "data");
const dataFile = path.join(dataDir, "taixiu-rooms.json");

function ensureStore() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify({ rooms: {} }, null, 2));
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

function enableRoom(channelId, config) {
  const store = readStore();
  store.rooms[channelId] = {
    enabled: true,
    ...config,
    updatedAt: new Date().toISOString()
  };
  writeStore(store);
  return store.rooms[channelId];
}

function disableRoom(channelId) {
  const store = readStore();
  delete store.rooms[channelId];
  writeStore(store);
}

function getRoom(channelId) {
  const store = readStore();
  return store.rooms[channelId] || null;
}

function isEnabledRoom(channelId) {
  return Boolean(getRoom(channelId)?.enabled);
}

module.exports = {
  enableRoom,
  disableRoom,
  getRoom,
  isEnabledRoom
};
