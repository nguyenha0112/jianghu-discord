require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");
const { getSupabaseClient, hasSupabaseConfig } = require("../lib/supabase");
const supabaseStore = require("../storage/supabase-store");
const supabaseRoomStore = require("../storage/supabase-room-store");

const dataDir = path.join(__dirname, "..", "..", "data");
const numericIdPattern = /^\d{16,20}$/;

const roomFiles = [
  { gameKey: "word_chain", fileName: "word-chain-rooms.json" },
  { gameKey: "taixiu", fileName: "taixiu-rooms.json" },
  { gameKey: "baucua", fileName: "baucua-rooms.json" },
  { gameKey: "vietnamese_king", fileName: "vietnamese-king-rooms.json" },
  { gameKey: "xidach", fileName: "xidach-rooms.json" },
  { gameKey: "levelup_notifications", fileName: "levelup-rooms.json" },
  { gameKey: "serverlog_notifications", fileName: "serverlog-rooms.json" }
];

function isDiscordSnowflake(value) {
  return numericIdPattern.test(String(value || "").trim());
}

function readJsonFile(fileName, fallback) {
  const target = path.join(dataDir, fileName);
  if (!fs.existsSync(target)) {
    return fallback;
  }

  return JSON.parse(fs.readFileSync(target, "utf8"));
}

function listLocalPlayers() {
  const store = readJsonFile("players.json", { players: {} });
  return Object.values(store.players || {});
}

function listLocalTransactions() {
  const store = readJsonFile("transactions.json", { transactions: [] });
  return store.transactions || [];
}

function listLocalRooms() {
  const allRooms = [];

  for (const definition of roomFiles) {
    const store = readJsonFile(definition.fileName, { rooms: {} });
    for (const [channelId, room] of Object.entries(store.rooms || {})) {
      allRooms.push({
        gameKey: definition.gameKey,
        channelId,
        room
      });
    }
  }

  return allRooms;
}

async function syncPlayers() {
  const players = listLocalPlayers();
  const synced = [];
  const skipped = [];

  for (const player of players) {
    if (!isDiscordSnowflake(player.userId)) {
      skipped.push({ userId: player.userId, reason: "not_discord_snowflake" });
      continue;
    }

    await supabaseStore.ensurePlayer(player.userId, player.username);
    await supabaseStore.updatePlayer(player.userId, {
      username: player.username,
      wallet: player.wallet,
      stats: player.stats,
      inventory: player.inventory || {},
      profession: player.profession || { current: null, xp: 0, levels: {} },
      cultivation: player.cultivation || undefined,
      cooldowns: {
        dailyAt: player.cooldowns?.dailyAt || 0,
        workAt: player.cooldowns?.workAt || 0,
        secretRealmAt: player.cooldowns?.secretRealmAt || 0
      }
    });

    synced.push(player.userId);
  }

  return { synced, skipped };
}

async function syncTransactions() {
  const supabase = getSupabaseClient();
  const transactions = listLocalTransactions();
  const synced = [];
  const skipped = [];

  for (const transaction of transactions) {
    if (!isDiscordSnowflake(transaction.userId)) {
      skipped.push({ id: transaction.id, reason: "not_discord_snowflake" });
      continue;
    }

    const payload = {
      user_id: transaction.userId,
      username: transaction.username,
      type: transaction.type,
      changes: transaction.changes || {},
      created_at: transaction.createdAt || new Date().toISOString()
    };

    const { error } = await supabase.from("transactions").insert(payload);
    if (error) {
      throw error;
    }

    synced.push(transaction.id || `${transaction.userId}:${transaction.type}`);
  }

  return { synced, skipped };
}

async function syncRooms() {
  const rooms = listLocalRooms();
  const synced = [];
  const skipped = [];

  for (const entry of rooms) {
    if (!isDiscordSnowflake(entry.channelId)) {
      skipped.push({
        gameKey: entry.gameKey,
        channelId: entry.channelId,
        reason: "not_discord_snowflake"
      });
      continue;
    }

    await supabaseRoomStore.upsertRoom(entry.gameKey, entry.channelId, entry.room);
    synced.push({ gameKey: entry.gameKey, channelId: entry.channelId });
  }

  return { synced, skipped };
}

async function printSummary() {
  const supabase = getSupabaseClient();
  const [{ count: playerCount, error: playerError }, { count: roomCount, error: roomError }] = await Promise.all([
    supabase.from("players").select("user_id", { count: "exact", head: true }),
    supabase.from("game_rooms").select("id", { count: "exact", head: true })
  ]);

  if (playerError) {
    throw playerError;
  }

  if (roomError) {
    throw roomError;
  }

  console.log(JSON.stringify({ playerCount, roomCount }, null, 2));
}

async function main() {
  if (!hasSupabaseConfig()) {
    console.error("Thiếu cấu hình Supabase.");
    process.exit(1);
  }

  console.log("Bat dau dong bo local -> Supabase...");

  const playerResult = await syncPlayers();
  let roomResult = { synced: [], skipped: [], warning: null };
  let transactionResult = { synced: [], skipped: [], warning: null };

  try {
    roomResult = await syncRooms();
  } catch (error) {
    roomResult.warning = error.message || String(error);
  }

  try {
    transactionResult = await syncTransactions();
  } catch (error) {
    transactionResult.warning = error.message || String(error);
  }

  console.log(
    JSON.stringify(
      {
        players: {
          synced: playerResult.synced.length,
          skipped: playerResult.skipped
        },
        rooms: {
          synced: roomResult.synced.length,
          skipped: roomResult.skipped,
          warning: roomResult.warning
        },
        transactions: {
          synced: transactionResult.synced.length,
          skipped: transactionResult.skipped,
          warning: transactionResult.warning
        }
      },
      null,
      2
    )
  );

  await printSummary();
}

main().catch((error) => {
  console.error("Dong bo Supabase that bai:", error);
  process.exit(1);
});
