const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "jianghu-recovery-"));
process.env.GAME_DATA_DIR = tempDir;

let online = false;
const syncedPlayers = [];
const syncedTransactions = [];
const syncedRooms = [];
const deletedRooms = [];
const fakeSupabase = {
  hasSupabaseConfig: () => online,
  ensurePlayer: async () => { throw new Error("offline"); },
  getPlayer: async () => null,
  listPlayers: async () => [],
  updatePlayer: async () => { throw new Error("offline"); },
  upsertPlayerSnapshot: async (player) => syncedPlayers.push(player),
  appendTransaction: async (entry) => {
    if (!online) throw new Error("offline");
    syncedTransactions.push(entry);
  },
  hasTransactionSyncId: async (syncId) => syncedTransactions.some((entry) => entry.changes?._syncId === syncId)
};

const supabasePath = require.resolve("../storage/supabase-store");
require.cache[supabasePath] = { id: supabasePath, filename: supabasePath, loaded: true, exports: fakeSupabase };
const roomSupabasePath = require.resolve("../storage/supabase-room-store");
require.cache[roomSupabasePath] = {
  id: roomSupabasePath,
  filename: roomSupabasePath,
  loaded: true,
  exports: {
    hasSupabaseConfig: () => online,
    listRooms: async () => ({}),
    upsertRoom: async (gameKey, channelId, room) => {
      if (!online) throw new Error("offline");
      syncedRooms.push({ gameKey, channelId, room });
    },
    deleteRoom: async (gameKey, channelId) => {
      if (!online) throw new Error("offline");
      deletedRooms.push({ gameKey, channelId });
    }
  }
};
const playerStore = require("../storage/player-store");
const transactionStore = require("../storage/transaction-store");
const { createRoomStore } = require("../storage/create-room-store");

async function main() {
  const player = await playerStore.ensurePlayer("123456789012345678", "Tester");
  await playerStore.updatePlayer(player.userId, { ...player, wallet: { xu: 999, ngoc: 7 } });
  transactionStore.appendTransaction({
    userId: player.userId,
    username: player.username,
    type: "recovery_test",
    changes: { xu: 999 }
  });
  await new Promise((resolve) => setImmediate(resolve));

  online = true;
  const playerResult = await playerStore.syncDirtyPlayers();
  const transactionResult = await transactionStore.syncPendingTransactions();
  assert.equal(playerResult.synced, 1);
  assert.equal(syncedPlayers[0].wallet.xu, 999);
  assert.equal(transactionResult.synced, 1);
  assert.equal(syncedTransactions.length, 1);
  assert.ok(syncedTransactions[0].changes._syncId);
  assert.equal((await transactionStore.syncPendingTransactions()).synced, 0);

  online = false;
  const roomStore = createRoomStore({ gameKey: "test_game", fileName: "test-rooms.json" });
  roomStore.enableRoom("987654321098765432", { guildId: "123", mode: "test" });
  await new Promise((resolve) => setImmediate(resolve));
  online = true;
  assert.deepEqual(await roomStore.syncPending(), { synced: 1, pending: 0 });
  assert.equal(syncedRooms.length, 1);
  online = false;
  roomStore.disableRoom("987654321098765432");
  await new Promise((resolve) => setImmediate(resolve));
  online = true;
  assert.deepEqual(await roomStore.syncPending(), { synced: 1, pending: 0 });
  assert.equal(deletedRooms.length, 1);
  console.log("PASS: player, transaction and room changes recover once after Supabase reconnects");
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => fs.rmSync(tempDir, { recursive: true, force: true }));
