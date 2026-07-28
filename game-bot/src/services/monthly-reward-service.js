const { assertAdmin } = require("../lib/admin-auth");
const { listPlayers, getPlayer, updatePlayer } = require("../storage/player-store");
const { appendTransaction } = require("../storage/transaction-store");
const { getWordChainRanking } = require("../storage/word-chain-ranking-store");
const { getVietnameseKingRanking } = require("../storage/vietnamese-king-ranking-store");
const { getPeriod, savePeriod, listPeriods } = require("../storage/monthly-reward-store");

const MONTHLY_NGOC_REWARD = 30;

function getCurrentPeriodId() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function buildRankingMap() {
  const wordChainPve = new Map(getWordChainRanking("pve", 200).map((entry) => [entry.userId, entry]));
  const wordChainPvp = new Map(getWordChainRanking("pvp", 200).map((entry) => [entry.userId, entry]));
  const vietnameseKing = new Map(getVietnameseKingRanking(200).map((entry) => [entry.userId, entry]));
  return { wordChainPve, wordChainPvp, vietnameseKing };
}

function computeMonthlyScore(player, rankingMap) {
  const pve = rankingMap.wordChainPve.get(player.userId);
  const pvp = rankingMap.wordChainPvp.get(player.userId);
  const king = rankingMap.vietnameseKing.get(player.userId);

  const breakdown = {
    level: (player.stats.playerLevel || 1) * 10,
    work: (player.stats.totalWorkActions || 0) * 2,
    xuEarned: Math.floor((player.stats.totalXuEarned || 0) / 100),
    ngocEarned: (player.stats.totalNgocEarned || 0) * 5,
    wordChainPve: (pve?.wins || 0) * 10 + Math.floor((pve?.points || 0) / 5),
    wordChainPvp: (pvp?.wins || 0) * 15 + Math.floor((pvp?.points || 0) / 5),
    vietnameseKing: (king?.wins || 0) * 12 + Math.floor((king?.points || 0) / 4)
  };

  return {
    score: Object.values(breakdown).reduce((sum, value) => sum + value, 0),
    breakdown
  };
}

async function buildMonthlySnapshot(limit = 10) {
  const players = await listPlayers();
  const rankingMap = buildRankingMap();

  return players
    .map((player) => {
      const metrics = computeMonthlyScore(player, rankingMap);
      return {
        userId: player.userId,
        username: player.username,
        score: metrics.score,
        breakdown: metrics.breakdown,
        playerLevel: player.stats.playerLevel,
        totalWorkActions: player.stats.totalWorkActions,
        totalXuEarned: player.stats.totalXuEarned,
        totalNgocEarned: player.stats.totalNgocEarned
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      if (right.totalWorkActions !== left.totalWorkActions) {
        return right.totalWorkActions - left.totalWorkActions;
      }
      return right.totalXuEarned - left.totalXuEarned;
    })
    .slice(0, limit);
}

async function getMonthlyRewardStatus(requestUserId, periodId = getCurrentPeriodId()) {
  assertAdmin(requestUserId);
  const period = getPeriod(periodId);
  const snapshot = await buildMonthlySnapshot(10);

  if (snapshot.length > 0 && period.status === "open") {
    period.snapshot = snapshot;
    savePeriod(period);
  }

  return {
    periodId,
    status: period.status,
    snapshot: period.snapshot?.length ? period.snapshot : snapshot,
    rewards: period.rewards || [],
    recentPeriods: listPeriods(6)
  };
}

async function awardMonthlyReward(requestUserId, targetUserId, note = "") {
  assertAdmin(requestUserId);
  const periodId = getCurrentPeriodId();
  const period = getPeriod(periodId);

  if (period.rewards.some((entry) => entry.userId === targetUserId)) {
    return { ok: false, message: "Nguoi choi nay da duoc ghi nhan thuong thang trong ky hien tai." };
  }

  const player = await getPlayer(targetUserId);
  if (!player) {
    return { ok: false, message: "Khong tim thay player de trao thuong." };
  }

  const snapshot = period.snapshot?.length ? period.snapshot : await buildMonthlySnapshot(10);
  const candidate = snapshot.find((entry) => entry.userId === targetUserId) || null;

  const updatedPlayer = await updatePlayer(targetUserId, {
    wallet: {
      ...player.wallet,
      ngoc: player.wallet.ngoc + MONTHLY_NGOC_REWARD
    },
    stats: {
      ...player.stats,
      totalNgocEarned: player.stats.totalNgocEarned + MONTHLY_NGOC_REWARD
    }
  });

  const rewardEntry = {
    userId: targetUserId,
    username: player.username,
    rewardType: "monthly_card_candidate",
    ngocReward: MONTHLY_NGOC_REWARD,
    score: candidate?.score || 0,
    note: note || "Admin xet thuong thang thu cong.",
    awardedAt: new Date().toISOString(),
    awardedBy: requestUserId
  };

  period.snapshot = snapshot;
  period.rewards = [...(period.rewards || []), rewardEntry];
  period.status = "awarded";
  savePeriod(period);

  appendTransaction({
    userId: targetUserId,
    username: player.username,
    type: "monthly_reward_award",
    changes: {
      ngoc: MONTHLY_NGOC_REWARD,
      periodId,
      rewardType: "monthly_card_candidate"
    }
  });

  return {
    ok: true,
    periodId,
    rewardEntry,
    balance: updatedPlayer.wallet.ngoc
  };
}

async function getMonthlyLeaderboardView(requestUserId) {
  const periodId = getCurrentPeriodId();
  const period = getPeriod(periodId);
  const snapshot = period.snapshot?.length ? period.snapshot : await buildMonthlySnapshot(10);
  const currentUser = snapshot.find((entry) => entry.userId === requestUserId) || null;

  return {
    periodId,
    top: snapshot,
    currentUser,
    rewardNote: `Top ung vien duoc admin xet thuong thang. MVP hien tai cong them 💎 ${MONTHLY_NGOC_REWARD} Ngoc va ghi nhan candidate cho The Thang.`
  };
}

module.exports = {
  MONTHLY_NGOC_REWARD,
  getCurrentPeriodId,
  getMonthlyRewardStatus,
  awardMonthlyReward,
  getMonthlyLeaderboardView
};
