const professions = require("../config/professions");
const items = require("../config/items");
const currencies = require("../config/currencies");
const sellRates = require("../config/sell-rates");
const shopItems = require("../config/shop-items");
const recipes = require("../config/recipes");
const { appendTransaction } = require("../storage/transaction-store");
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

function removeItem(inventory, itemId, quantity) {
  const next = { ...inventory };
  const current = next[itemId] || 0;
  const remaining = current - quantity;

  if (remaining <= 0) {
    delete next[itemId];
  } else {
    next[itemId] = remaining;
  }

  return next;
}

function addPlayerXp(stats, xpGain) {
  const nextXp = stats.playerXp + xpGain;
  const levelGain = Math.floor(nextXp / 100);

  return {
    ...stats,
    playerLevel: stats.playerLevel + levelGain,
    playerXp: nextXp % 100
  };
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
      message: `Daily chưa sẵn sàng. Quay lại sau ${formatDuration(remainingMs)}.`
    };
  }

  const xuGain = 100;
  const ngocGain = 3;
  const nextStats = addPlayerXp(
    {
      ...player.stats,
      totalXuEarned: player.stats.totalXuEarned + xuGain,
      totalNgocEarned: player.stats.totalNgocEarned + ngocGain
    },
    20
  );

  const updated = updatePlayer(userId, {
    username,
    wallet: {
      xu: player.wallet.xu + xuGain,
      ngoc: player.wallet.ngoc + ngocGain
    },
    stats: nextStats,
    cooldowns: {
      ...player.cooldowns,
      dailyAt: getNow()
    }
  });

  appendTransaction({
    userId,
    username,
    type: "daily",
    changes: {
      xu: xuGain,
      ngoc: ngocGain
    }
  });

  return {
    ok: true,
    player: updated,
    message: `Bạn nhận được ${xuGain} Xu và ${ngocGain} Ngọc từ daily. +20 Player XP.`
  };
}

function doWork(userId, username) {
  const player = createPlayer(userId, username);
  if (!player.profession.current) {
    return {
      ok: false,
      message: "Bạn chưa chọn nghề. Dùng /choose-profession trước."
    };
  }

  const remainingMs = getRemainingMs(player.cooldowns.workAt, WORK_COOLDOWN_MS);
  if (remainingMs > 0) {
    return {
      ok: false,
      message: `Bạn đang hồi sức. Quay lại sau ${formatDuration(remainingMs)}.`
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
  const nextStats = addPlayerXp(
    {
      ...player.stats,
      totalXuEarned: player.stats.totalXuEarned + xuGain,
      totalWorkActions: player.stats.totalWorkActions + 1
    },
    10
  );

  const updated = updatePlayer(userId, {
    username,
    wallet: {
      ...player.wallet,
      xu: player.wallet.xu + xuGain
    },
    stats: nextStats,
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

  appendTransaction({
    userId,
    username,
    type: "work",
    changes: {
      xu: xuGain,
      itemId: drop.itemId,
      quantity: drop.quantity
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
      xpGain,
      playerXpGain: 10
    }
  };
}

function getProfile(userId, username) {
  return createPlayer(userId, username);
}

function getWalletSummary(userId, username) {
  const player = createPlayer(userId, username);
  return {
    wallet: player.wallet,
    stats: player.stats,
    currencies
  };
}

function getShopListings() {
  return shopItems.map((entry) => ({
    ...entry,
    currencyName: currencies[entry.currency]?.name || entry.currency
  }));
}

function buyShopItem(userId, username, shopId) {
  const player = createPlayer(userId, username);
  const listing = shopItems.find((entry) => entry.shopId === shopId);

  if (!listing) {
    return {
      ok: false,
      message: "Khong tim thay vat pham trong shop."
    };
  }

  if ((player.wallet[listing.currency] || 0) < listing.price) {
    return {
      ok: false,
      message: `Ban khong du ${currencies[listing.currency]?.name || listing.currency}.`
    };
  }

  const updated = updatePlayer(userId, {
    username,
    wallet: {
      ...player.wallet,
      [listing.currency]: player.wallet[listing.currency] - listing.price
    },
    inventory: addItem(player.inventory, listing.itemId, listing.quantity)
  });

  appendTransaction({
    userId,
    username,
    type: "shop_buy",
    changes: {
      currency: listing.currency,
      amount: -listing.price,
      itemId: listing.itemId,
      quantity: listing.quantity
    }
  });

  return {
    ok: true,
    player: updated,
    message: `Ban da mua ${listing.name} voi gia ${listing.price} ${currencies[listing.currency]?.name || listing.currency}.`
  };
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

function getRecipeListings() {
  return recipes.map((recipe) => ({
    ...recipe,
    outputName: items[recipe.output.itemId]?.name || recipe.output.itemId
  }));
}

function hasEnoughInputs(inventory, inputs) {
  return inputs.every((input) => (inventory[input.itemId] || 0) >= input.quantity);
}

function consumeInputs(inventory, inputs) {
  return inputs.reduce((currentInventory, input) => {
    return removeItem(currentInventory, input.itemId, input.quantity);
  }, inventory);
}

function craftRecipe(userId, username, recipeId) {
  const player = createPlayer(userId, username);
  const recipe = recipes.find((entry) => entry.recipeId === recipeId);

  if (!recipe) {
    return {
      ok: false,
      message: "Khong tim thay cong thuc craft."
    };
  }

  if (!hasEnoughInputs(player.inventory, recipe.inputs)) {
    return {
      ok: false,
      message: "Ban chua du nguyen lieu de craft."
    };
  }

  if (player.wallet.xu < recipe.cost.xu) {
    return {
      ok: false,
      message: "Ban khong du Xu de craft."
    };
  }

  const inventoryAfterConsume = consumeInputs(player.inventory, recipe.inputs);
  const updated = updatePlayer(userId, {
    username,
    wallet: {
      ...player.wallet,
      xu: player.wallet.xu - recipe.cost.xu
    },
    inventory: addItem(inventoryAfterConsume, recipe.output.itemId, recipe.output.quantity)
  });

  appendTransaction({
    userId,
    username,
    type: "craft",
    changes: {
      xu: -recipe.cost.xu,
      outputItemId: recipe.output.itemId,
      outputQuantity: recipe.output.quantity
    }
  });

  return {
    ok: true,
    player: updated,
    message: `Ban da craft ${items[recipe.output.itemId]?.name || recipe.output.itemId} x${recipe.output.quantity}.`
  };
}

function sellItem(userId, username, itemId, quantity) {
  const player = createPlayer(userId, username);
  const owned = player.inventory[itemId] || 0;
  const sellRate = sellRates[itemId];

  if (!sellRate) {
    return {
      ok: false,
      message: "Vật phẩm này hiện chưa bán được cho hệ thống."
    };
  }

  if (owned < quantity || quantity <= 0) {
    return {
      ok: false,
      message: "Số lượng không hợp lệ hoặc kho đồ không đủ."
    };
  }

  const xuGain = sellRate * quantity;
  const nextStats = {
    ...player.stats,
    totalXuEarned: player.stats.totalXuEarned + xuGain,
    totalItemsSold: player.stats.totalItemsSold + quantity
  };

  const updated = updatePlayer(userId, {
    username,
    wallet: {
      ...player.wallet,
      xu: player.wallet.xu + xuGain
    },
    stats: nextStats,
    inventory: removeItem(player.inventory, itemId, quantity)
  });

  appendTransaction({
    userId,
    username,
    type: "sell",
    changes: {
      xu: xuGain,
      itemId,
      quantity: -quantity
    }
  });

  return {
    ok: true,
    player: updated,
    message: `Bạn đã bán ${quantity} ${items[itemId]?.name || itemId} và nhận ${xuGain} Xu.`
  };
}

module.exports = {
  chooseProfession,
  claimDaily,
  doWork,
  getProfile,
  getWalletSummary,
  getShopListings,
  getInventoryLines,
  getRecipeListings,
  buyShopItem,
  craftRecipe,
  sellItem,
  formatDuration
};
