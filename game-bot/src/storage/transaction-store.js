const fs = require("node:fs");
const path = require("node:path");
const supabaseStore = require("./supabase-store");

const dataDir = process.env.GAME_DATA_DIR || path.join(__dirname, "..", "..", "data");
const dataFile = path.join(dataDir, "transactions.json");

function ensureStore() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify({ transactions: [] }, null, 2));
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

function appendTransactionLocal(entry) {
  const store = readStore();
  store.transactions.push(entry);
  writeStore(store);
}

function buildTransaction(entry) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return {
    id,
    createdAt: new Date().toISOString(),
    ...entry,
    changes: { ...(entry.changes || {}), _syncId: id }
  };
}

function appendTransaction(entry) {
  const transaction = buildTransaction(entry);
  if (supabaseStore.hasSupabaseConfig()) {
    supabaseStore.appendTransaction(transaction).catch((error) => {
      console.error("Supabase appendTransaction loi, fallback ve JSON:", error.message);
      appendTransactionLocal(transaction);
    });
    return;
  }

  appendTransactionLocal(transaction);
}

async function syncPendingTransactions() {
  const store = readStore();
  const pending = [...store.transactions];
  if (!supabaseStore.hasSupabaseConfig()) return { synced: 0, pending: pending.length };
  let synced = 0;
  const completed = new Set();
  for (const transaction of pending) {
    const syncId = transaction.changes?._syncId || transaction.id;
    if (!(await supabaseStore.hasTransactionSyncId(syncId))) {
      await supabaseStore.appendTransaction({
        ...transaction,
        changes: { ...(transaction.changes || {}), _syncId: syncId }
      });
    }
    completed.add(transaction.id);
    synced += 1;
  }
  if (completed.size) {
    const latest = readStore();
    latest.transactions = latest.transactions.filter((entry) => !completed.has(entry.id));
    writeStore(latest);
  }
  return { synced, pending: readStore().transactions.length };
}

module.exports = {
  appendTransaction,
  syncPendingTransactions
};
