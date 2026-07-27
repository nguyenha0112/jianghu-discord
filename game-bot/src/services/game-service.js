const professions = require("../config/professions");
const items = require("../config/items");
const {
  ensurePlayer,
  getPlayer,
  updatePlayer
} = require("../storage/player-store");

const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const WORK_COOLDOWN_MS = 60 * 60 * 1000;

function getNow() {
  return Date.now();
}

function getRemainingMs(lastTimestamp, cooldownMs) {
  const remaining = lastTimestamp + cooldownMs - getNow();
  return Math.max(0, remaining);
}

function formatDuration(ms) {
  const totalMinutes = Math.ceil(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickWeightedDrop(dropTable) {
  const totalWeight = dropTable.reduce((sum, drop) => sum + drop.weight, 0);
  let cursor = randomBetween(1, totalWeight);

  for (const drop of dropTable) {
    cursor -= drop.weight;
    if (cursor <= 0) {
      return drop;
    }
  }

  return dropTable[0];
}

function addItem(inventory, itemId, quantity) {
  const next = { ...inventory };
  next[itemId] = (next[itemId] || 0) + quantity;
  return next;
}

function createPlayer(userId, username) {
  ensurePlayer(userId, username);
  return getPlayer(userId);
}

function chooseProfession(userId, username, professionId) {
  if (!professions[professionId]) {
    throw new Error("Unknown profession.");
  }

  const player = createPlayer(userId, username);
  const professionState = {
    current: professionId,
    levels: {
      ...player.profession.levels,
      [professionId]: player.profession.levels[professionId] || 1
    }
  };

  return updatePlayer(userId, {
    username,
    profession: professionState
  });
}

function claimDaily(userId, username) {
  const player = createPlayer(userId, username);
  const remainingMs = getRemainingMs(player.cooldowns.dailyAt, DAILY_COOLDOWN_MS);

  if (remainingMs > 0) {
    return {
      ok: false,
      message: `Daily chua san sang. Quay lai sau ${formatDuration(remainingMs)}.`
    };
  }

  const xuGain = 100;
  const ngocGain = 3;

  const updated = updatePlayer(userId, {
    username,
    wallet: {
      xu: player.wallet.xu + xuGain,
      ngoc: player.wallet.ngoc + ngocGain
    },
    cooldowns: {
      ...player.cooldowns,
      dailyAt: getNow()
    }
  });

  return {
    ok: true,
    player: updated,
    message: `Ban nhan duoc ${xuGain} Xu va ${ngocGain} Ngoc tu daily.`
  };
}

function doWork(userId, username) {
  const player = createPlayer(userId, username);
  if (!player.profession.current) {
    return {
      ok: false,
      message: "Ban chua chon nghe. Dung /choose-profession truoc."
    };
  }

  const remainingMs = getRemainingMs(player.cooldowns.workAt, WORK_COOLDOWN_MS);
  if (remainingMs > 0) {
    return {
      ok: false,
      message: `Ban dang hoi suc. Quay lai sau ${formatDuration(remainingMs)}.`
    };
  }

  const professionId = player.profession.current;
  const professionConfig = professions[professionId];
  const xuGain = randomBetween(professionConfig.xuRange[0], professionConfig.xuRange[1]);
  const drop = pickWeightedDrop(professionConfig.drops);
  const currentLevel = player.profession.levels[professionId] || 1;
  const xpGain = professionConfig.xpGain;
  const nextXp = player.profession.xp + xpGain;
  const nextLevel = currentLevel + Math.floor(nextXp / 100);
  const carriedXp = nextXp % 100;

  const updated = updatePlayer(userId, {
    username,
    wallet: {
      ...player.wallet,
      xu: player.wallet.xu + xuGain
    },
    inventory: addItem(player.inventory, drop.itemId, drop.quantity),
    profession: {
      current: professionId,
      xp: carriedXp,
      levels: {
        ...player.profession.levels,
        [professionId]: nextLevel
      }
    },
    cooldowns: {
      ...player.cooldowns,
      workAt: getNow()
    }
  });

  return {
    ok: true,
    player: updated,
    profession: professionConfig,
    reward: {
      xuGain,
      itemId: drop.itemId,
      itemName: items[drop.itemId]?.name || drop.itemId,
      quantity: drop.quantity,
      xpGain
    }
  };
}

function getProfile(userId, username) {
  return createPlayer(userId, username);
}

function getInventoryLines(userId, username) {
  const player = createPlayer(userId, username);
  const entries = Object.entries(player.inventory);

  if (entries.length === 0) {
    return ["Kho do dang trong."];
  }

  return entries
    .sort((left, right) => right[1] - left[1])
    .slice(0, 10)
    .map(([itemId, quantity]) => {
      const item = items[itemId];
      const itemName = item ? item.name : itemId;
      const rarity = item ? item.rarity : "Unknown";
      return `${itemName} x${quantity} [${rarity}]`;
    });
}

module.exports = {
  chooseProfession,
  claimDaily,
  doWork,
  getProfile,
  getInventoryLines,
  formatDuration
};
