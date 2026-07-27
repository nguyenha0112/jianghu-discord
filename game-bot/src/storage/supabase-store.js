const { getSupabaseClient, hasSupabaseConfig } = require("../lib/supabase");

function ensureConfigured() {
  if (!hasSupabaseConfig()) {
    throw new Error("Supabase chưa được cấu hình.");
  }
}

async function getPlayerProfile(userId) {
  ensureConfigured();
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
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
        "stats_total_xu_earned",
        "stats_total_ngoc_earned",
        "stats_total_work_actions",
        "stats_total_items_sold",
        "cooldown_daily_at",
        "cooldown_work_at"
      ].join(",")
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

module.exports = {
  getPlayerProfile
};
