const { syncDirtyPlayers } = require("../storage/player-store");
const { syncPendingTransactions } = require("../storage/transaction-store");
const { flushPendingRoomChanges } = require("../storage/create-room-store");

let running = null;

async function recoverPendingData() {
  if (running) return running;
  running = (async () => {
    const players = await syncDirtyPlayers();
    const transactions = await syncPendingTransactions();
    const rooms = await flushPendingRoomChanges();
    if (players.synced || transactions.synced || rooms.synced) {
      console.log("[recovery] Supabase data synchronized", { players, transactions, rooms });
    }
    return { players, transactions, rooms };
  })();
  try {
    return await running;
  } finally {
    running = null;
  }
}

module.exports = { recoverPendingData };
