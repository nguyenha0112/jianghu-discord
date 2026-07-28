const spiritRoots = require("../config/spirit-roots");
const { getSupabaseClient, hasSupabaseConfig } = require("../lib/supabase");

function ensureConfigured() {
  if (!hasSupabaseConfig()) {
    throw new Error("Supabase chua duoc cau hinh.");
  }
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

function mapRowToPlayer(row, inventoryRows) {
  const inventory = {};
  for (const entry of inventoryRows || []) {
    inventory[entry.item_id] = entry.quantity;
  }

  return {
    userId: row.user_id,
    username: row.username,
    wallet: {
      xu: row.wallet_xu,
      ngoc: row.wallet_ngoc
    },
    stats: {
      playerLevel: row.player_level,
      playerXp: row.player_xp,
      totalXuEarned: row.stats_total_xu_earned,
      totalNgocEarned: row.stats_total_ngoc_earned,
      totalWorkActions: row.stats_total_work_actions,
      totalItemsSold: row.stats_total_items_sold
    },
    inventory,
    profession: {
      current: row.profession_current,
      xp: row.profession_xp,
      levels: row.profession_levels || {}
    },
    cultivation: normalizeCultivation(row.user_id, {
      realm: row.cultivation_realm || "pham_nhan",
      realmIndex: row.cultivation_realm_index || 0,
      spiritRootKey: row.cultivation_spirit_root || undefined,
      dwellingLevel: row.cultivation_dwelling_level || 1,
      equippedArtifactId: row.cultivation_equipped_artifact || null
    }),
    cooldowns: {
      dailyAt: row.cooldown_daily_at,
      workAt: row.cooldown_work_at,
      secretRealmAt: row.cooldown_secret_realm_at || 0
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapPlayerToRow(player) {
  const cultivation = normalizeCultivation(player.userId, player.cultivation);
  return {
    user_id: player.userId,
    username: player.username,
    wallet_xu: player.wallet.xu,
    wallet_ngoc: player.wallet.ngoc,
    player_level: player.stats.playerLevel,
    player_xp: player.stats.playerXp,
    profession_current: player.profession.current,
    profession_xp: player.profession.xp,
    profession_levels: player.profession.levels,
    cultivation_realm: cultivation.realm,
    cultivation_realm_index: cultivation.realmIndex,
    cultivation_spirit_root: cultivation.spiritRootKey,
    cultivation_dwelling_level: cultivation.dwellingLevel,
    cultivation_equipped_artifact: cultivation.equippedArtifactId,
    stats_total_xu_earned: player.stats.totalXuEarned,
    stats_total_ngoc_earned: player.stats.totalNgocEarned,
    stats_total_work_actions: player.stats.totalWorkActions,
    stats_total_items_sold: player.stats.totalItemsSold,
    cooldown_daily_at: player.cooldowns.dailyAt,
    cooldown_work_at: player.cooldowns.workAt,
    cooldown_secret_realm_at: player.cooldowns.secretRealmAt || 0,
    updated_at: new Date().toISOString()
  };
}

async function ensurePlayer(userId, username) {
  ensureConfigured();
  const current = await getPlayer(userId);
  if (current) {
    if (current.username !== username) {
      return updatePlayer(userId, { username });
    }
    return current;
  }

  const supabase = getSupabaseClient();
  const player = defaultPlayer(userId, username);
  const { error } = await supabase.from("players").insert(mapPlayerToRow(player));
  if (error) {
    throw error;
  }
  return player;
}

async function getPlayer(userId) {
  ensureConfigured();
  const supabase = getSupabaseClient();

  const { data: row, error } = await supabase
    .from("players")
    .select(
      [
        "user_id",
        "username",
        "wallet_xu",
        "wallet_ngoc",
        "player_level",
        "player_xp",
        "profession_current",
        "profession_xp",
        "profession_levels",
        "cultivation_realm",
        "cultivation_realm_index",
        "cultivation_spirit_root",
        "cultivation_dwelling_level",
        "cultivation_equipped_artifact",
        "stats_total_xu_earned",
        "stats_total_ngoc_earned",
        "stats_total_work_actions",
        "stats_total_items_sold",
        "cooldown_daily_at",
        "cooldown_work_at",
        "cooldown_secret_realm_at",
        "created_at",
        "updated_at"
      ].join(",")
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!row) {
    return null;
  }

  const { data: inventoryRows, error: inventoryError } = await supabase
    .from("inventories")
    .select("item_id, quantity")
    .eq("user_id", userId);

  if (inventoryError) {
    throw inventoryError;
  }

  return mapRowToPlayer(row, inventoryRows);
}

async function listPlayers() {
  ensureConfigured();
  const supabase = getSupabaseClient();
  const { data: rows, error } = await supabase
    .from("players")
    .select(
      [
        "user_id",
        "username",
        "wallet_xu",
        "wallet_ngoc",
        "player_level",
        "player_xp",
        "profession_current",
        "profession_xp",
        "profession_levels",
        "cultivation_realm",
        "cultivation_realm_index",
        "cultivation_spirit_root",
        "cultivation_dwelling_level",
        "cultivation_equipped_artifact",
        "stats_total_xu_earned",
        "stats_total_ngoc_earned",
        "stats_total_work_actions",
        "stats_total_items_sold",
        "cooldown_daily_at",
        "cooldown_work_at",
        "cooldown_secret_realm_at",
        "created_at",
        "updated_at"
      ].join(",")
    )
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  if (!rows?.length) {
    return [];
  }

  const userIds = rows.map((row) => row.user_id);
  const { data: inventoryRows, error: inventoryError } = await supabase
    .from("inventories")
    .select("user_id, item_id, quantity")
    .in("user_id", userIds);

  if (inventoryError) {
    throw inventoryError;
  }

  const inventoryMap = new Map();
  for (const entry of inventoryRows || []) {
    const bucket = inventoryMap.get(entry.user_id) || [];
    bucket.push(entry);
    inventoryMap.set(entry.user_id, bucket);
  }

  return rows.map((row) => mapRowToPlayer(row, inventoryMap.get(row.user_id) || []));
}

async function replaceInventory(userId, inventory) {
  const supabase = getSupabaseClient();
  const { error: deleteError } = await supabase.from("inventories").delete().eq("user_id", userId);
  if (deleteError) {
    throw deleteError;
  }

  const entries = Object.entries(inventory).map(([itemId, quantity]) => ({
    user_id: userId,
    item_id: itemId,
    quantity
  }));

  if (entries.length === 0) {
    return;
  }

  const { error: insertError } = await supabase.from("inventories").insert(entries);
  if (insertError) {
    throw insertError;
  }
}

async function updatePlayer(userId, patch) {
  ensureConfigured();
  const current = await getPlayer(userId);
  if (!current) {
    throw new Error("Khong tim thay player de cap nhat.");
  }

  const next = {
    ...current,
    ...patch,
    wallet: patch.wallet || current.wallet,
    stats: patch.stats || current.stats,
    inventory: patch.inventory || current.inventory,
    profession: patch.profession || current.profession,
    cultivation: normalizeCultivation(userId, patch.cultivation || current.cultivation),
    cooldowns: patch.cooldowns || current.cooldowns,
    updatedAt: new Date().toISOString()
  };

  const supabase = getSupabaseClient();
  const { error } = await supabase.from("players").update(mapPlayerToRow(next)).eq("user_id", userId);
  if (error) {
    throw error;
  }

  if (patch.inventory) {
    await replaceInventory(userId, patch.inventory);
  }

  return next;
}

async function appendTransaction(entry) {
  ensureConfigured();
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("transactions").insert({
    user_id: entry.userId,
    username: entry.username,
    type: entry.type,
    changes: entry.changes
  });

  if (error) {
    throw error;
  }
}

async function getRecentTransactions(userId, limit = 10) {
  ensureConfigured();
  const supabase = getSupabaseClient();
  let query = supabase
    .from("transactions")
    .select("user_id, username, type, changes, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return data || [];
}

async function deletePlayer(userId) {
  ensureConfigured();
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("players").delete().eq("user_id", userId);
  if (error) {
    throw error;
  }
}

module.exports = {
  hasSupabaseConfig,
  ensurePlayer,
  getPlayer,
  listPlayers,
  updatePlayer,
  appendTransaction,
  getRecentTransactions,
  deletePlayer
};
