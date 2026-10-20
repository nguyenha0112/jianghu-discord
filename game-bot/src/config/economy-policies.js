const policies = Object.freeze({
  "word-game-v1": Object.freeze({
    wordChain: Object.freeze({
      minPvpRewardedPlayers: 2,
      pvpPointXu: 12,
      pvpWinBonusXu: 30,
      pvpCheckpointInterval: 25,
      pvpCheckpointLeaderBonusXu: 60,
      pvePointXu: 10,
      pveWinBonusXu: 20,
      pointXp: 4,
      winBonusXp: 12
    }),
    vietnameseKing: Object.freeze({
      pointXu: 8,
      winBonusXu: 20,
      pointXp: 5,
      winBonusXp: 15
    })
  }),
  "betting-v1": Object.freeze({
    minBetXu: 20,
    maxBetXu: 250000,
    betXp: 1,
    winXp: 4
  }),
  "pvp-light-v1": Object.freeze({
    winXu: 20,
    winXp: 3,
    rewardedWinsPerDay: 10
  }),
  "quiz-v1": Object.freeze({
    winXu: 15,
    winXp: 4,
    rewardedWinsPerDay: 15
  })
});

function getEconomyPolicy(key) {
  const policy = policies[key];
  if (!policy) throw new Error(`Economy policy không tồn tại: ${key}`);
  return policy;
}

module.exports = { policies, getEconomyPolicy };
