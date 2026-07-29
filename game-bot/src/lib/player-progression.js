function applyPlayerXp(stats, xpGain) {
  const safeXpGain = Math.max(0, Number(xpGain) || 0);
  const currentXp = (stats?.playerXp || 0) + safeXpGain;
  const currentLevel = stats?.playerLevel || 1;
  const levelGain = Math.floor(currentXp / 100);
  const nextStats = {
    ...stats,
    playerLevel: currentLevel + levelGain,
    playerXp: currentXp % 100
  };

  return {
    stats: nextStats,
    levelInfo: {
      xpGain: safeXpGain,
      levelBefore: currentLevel,
      levelAfter: nextStats.playerLevel,
      xpAfter: nextStats.playerXp,
      levelGained: Math.max(0, nextStats.playerLevel - currentLevel),
      didLevelUp: nextStats.playerLevel > currentLevel
    }
  };
}

function addPlayerXp(stats, xpGain) {
  return applyPlayerXp(stats, xpGain).stats;
}

module.exports = {
  addPlayerXp,
  applyPlayerXp
};
