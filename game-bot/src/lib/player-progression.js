function addPlayerXp(stats, xpGain) {
  const currentXp = (stats?.playerXp || 0) + xpGain;
  const currentLevel = stats?.playerLevel || 1;
  const levelGain = Math.floor(currentXp / 100);

  return {
    ...stats,
    playerLevel: currentLevel + levelGain,
    playerXp: currentXp % 100
  };
}

module.exports = {
  addPlayerXp
};
