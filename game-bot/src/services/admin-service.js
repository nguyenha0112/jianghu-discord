const { assertAdmin } = require("../lib/admin-auth");
const playerStore = require("../storage/player-store");
const supabaseStore = require("../storage/supabase-store");
const { getCandidateSummary, listCandidates } = require("../storage/vietnamese-king-candidate-store");
const monthlyRewardService = require("./monthly-reward-service");

async function getAdminPlayerView(requestUserId, targetUserId) {
  assertAdmin(requestUserId);
  const player = await playerStore.getPlayer(targetUserId);

  if (!player) {
    return {
      ok: false,
      message: "Khong tim thay player."
    };
  }

  return {
    ok: true,
    player
  };
}

async function getRecentTransactions(requestUserId, targetUserId, limit) {
  assertAdmin(requestUserId);

  if (supabaseStore.hasSupabaseConfig()) {
    return supabaseStore.getRecentTransactions(targetUserId, limit);
  }

  return [];
}

async function resetPlayerData(requestUserId, targetUserId) {
  assertAdmin(requestUserId);

  if (supabaseStore.hasSupabaseConfig()) {
    await supabaseStore.deletePlayer(targetUserId);
    return {
      ok: true,
      message: `Da reset player ${targetUserId} tren Supabase.`
    };
  }

  return {
    ok: false,
    message: "Che do JSON fallback chua ho tro reset qua lenh admin."
  };
}

function getVietnameseKingPendingCandidates(requestUserId, limit = 10) {
  assertAdmin(requestUserId);
  return {
    summary: getCandidateSummary(),
    items: listCandidates({ status: "pending", limit })
  };
}

module.exports = {
  getAdminPlayerView,
  getRecentTransactions,
  resetPlayerData,
  getVietnameseKingPendingCandidates,
  getMonthlyRewardStatus: monthlyRewardService.getMonthlyRewardStatus,
  awardMonthlyReward: monthlyRewardService.awardMonthlyReward
};
