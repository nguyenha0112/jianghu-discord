const { getSupabaseClient, hasSupabaseConfig } = require("../lib/supabase");

function ensureConfigured() {
  if (!hasSupabaseConfig()) {
    throw new Error("Supabase chua duoc cau hinh.");
  }
}

function mapRecordToRoom(row) {
  return {
    enabled: row.enabled,
    guildId: row.guild_id,
    channelName: row.channel_name,
    mode: row.mode || undefined,
    createdByUserId: row.created_by_user_id,
    createdByUsername: row.created_by_username,
    updatedAt: row.updated_at,
    ...(row.settings || {})
  };
}

async function listRooms(gameKey) {
  ensureConfigured();
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("game_rooms")
    .select(
      [
        "game_key",
        "guild_id",
        "channel_id",
        "channel_name",
        "enabled",
        "mode",
        "created_by_user_id",
        "created_by_username",
        "settings",
        "updated_at"
      ].join(",")
    )
    .eq("game_key", gameKey)
    .eq("enabled", true);

  if (error) {
    throw error;
  }

  const rooms = {};
  for (const row of data || []) {
    rooms[row.channel_id] = mapRecordToRoom(row);
  }
  return rooms;
}

async function upsertRoom(gameKey, channelId, config) {
  ensureConfigured();
  const supabase = getSupabaseClient();
  const {
    guildId = null,
    channelName = null,
    mode = null,
    createdByUserId = null,
    createdByUsername = null,
    updatedAt = new Date().toISOString(),
    ...settings
  } = config;

  const payload = {
    game_key: gameKey,
    guild_id: guildId,
    channel_id: channelId,
    channel_name: channelName,
    enabled: true,
    mode,
    created_by_user_id: createdByUserId,
    created_by_username: createdByUsername,
    settings,
    updated_at: updatedAt
  };

  const { error } = await supabase
    .from("game_rooms")
    .upsert(payload, { onConflict: "game_key,channel_id" });

  if (error) {
    throw error;
  }
}

async function deleteRoom(gameKey, channelId) {
  ensureConfigured();
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("game_rooms")
    .delete()
    .eq("game_key", gameKey)
    .eq("channel_id", channelId);

  if (error) {
    throw error;
  }
}

module.exports = {
  hasSupabaseConfig,
  listRooms,
  upsertRoom,
  deleteRoom
};
