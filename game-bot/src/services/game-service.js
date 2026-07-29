const professions = require("../config/professions");
const items = require("../config/items");
const currencies = require("../config/currencies");
const sellRates = require("../config/sell-rates");
const shopItems = require("../config/shop-items");
const recipes = require("../config/recipes");
const cultivationRealms = require("../config/cultivation-realms");
const spiritRoots = require("../config/spirit-roots");
const dwellingLevels = require("../config/dwelling-levels");
const artifacts = require("../config/artifacts");
const secretRealms = require("../config/secret-realms");
const { appendTransaction } = require("../storage/transaction-store");
const { ensurePlayer, getPlayer, updatePlayer } = require("../storage/player-store");
const { addPlayerXp, applyPlayerXp } = require("../lib/player-progression");

const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const WORK_COOLDOWN_MS = 60 * 60 * 1000;
const DAILY_BASE_XU = 45;
const DAILY_DWELLING_XU = 5;
const DAILY_BASE_NGOC = 1;

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
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
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

function ensureCultivation(player) {
  return {
    realm: player.cultivation?.realm || "pham_nhan",
    realmIndex: player.cultivation?.realmIndex ?? 0,
    spiritRootKey: player.cultivation?.spiritRootKey || spiritRoots[0].key,
    dwellingLevel: player.cultivation?.dwellingLevel || 1,
    equippedArtifactId: player.cultivation?.equippedArtifactId || null
  };
}

function getCurrentRealm(player) {
  return cultivationRealms[ensureCultivation(player).realmIndex] || cultivationRealms[0];
}

function getNextRealm(player) {
  return cultivationRealms[ensureCultivation(player).realmIndex + 1] || null;
}

function getRealmCap(player) {
  return getCurrentRealm(player)?.levelCap || 10;
}

function getCurrentDwelling(player) {
  return dwellingLevels.find((entry) => entry.level === ensureCultivation(player).dwellingLevel) || dwellingLevels[0];
}

function getNextDwelling(player) {
  return dwellingLevels.find((entry) => entry.level === ensureCultivation(player).dwellingLevel + 1) || null;
}

function getSpiritRootByKey(key) {
  return spiritRoots.find((entry) => entry.key === key) || spiritRoots[0];
}

function getArtifactById(itemId) {
  return artifacts[itemId] || null;
}

function hasEnoughInputs(inventory, inputs) {
  return inputs.every((input) => (inventory[input.itemId] || 0) >= input.quantity);
}

function consumeInputs(inventory, inputs) {
  return inputs.reduce((currentInventory, input) => removeItem(currentInventory, input.itemId, input.quantity), inventory);
}

function formatCost(cost) {
  if (!cost) {
    return "Không có";
  }
  const parts = [];
  if (cost.xu > 0) {
    parts.push(`${cost.xu} Xu`);
  }
  if (cost.items?.length) {
    parts.push(cost.items.map((entry) => `${items[entry.itemId]?.name || entry.itemId} x${entry.quantity}`).join(", "));
  }
  return parts.join(" | ") || "Không cần tài nguyên";
}

function getProfessionBonuses(player, professionId) {
  const cultivation = ensureCultivation(player);
  const spiritRoot = getSpiritRootByKey(cultivation.spiritRootKey);
  const dwelling = getCurrentDwelling(player);
  const artifact = getArtifactById(cultivation.equippedArtifactId);
  const rootMatches = spiritRoot.favoredProfession === professionId;
  const artifactMatches = artifact?.favoredProfession === professionId;

  return {
    spiritRoot,
    dwelling,
    artifact,
    rootMatches,
    artifactMatches,
    xuMultiplier:
      (rootMatches ? spiritRoot.xuMultiplier : 1) *
      (1 + dwelling.xuBonusPercent / 100) *
      (artifactMatches ? artifact.xuMultiplier : 1),
    professionXpMultiplier:
      (rootMatches ? spiritRoot.professionXpMultiplier : 1) *
      (1 + dwelling.professionXpBonusPercent / 100) *
      (artifactMatches ? artifact.professionXpMultiplier : 1)
  };
}

function getCombatStats(player) {
  const cultivation = ensureCultivation(player);
  const currentProfessionId = player.profession.current;
  const professionLevel = currentProfessionId ? player.profession.levels[currentProfessionId] || 1 : 1;
  const bonuses = currentProfessionId ? getProfessionBonuses(player, currentProfessionId) : null;

  const hp = 100 + cultivation.realmIndex * 45 + cultivation.dwellingLevel * 15 + professionLevel * 8;
  const attack = 18 + cultivation.realmIndex * 14 + cultivation.dwellingLevel * 5 + professionLevel * 3 + (bonuses?.artifactMatches ? 8 : 0);
  const defense = 8 + cultivation.realmIndex * 6 + cultivation.dwellingLevel * 2 + Math.floor(professionLevel * 1.5);
  const critRate = Math.min(35, 5 + cultivation.realmIndex * 4 + cultivation.dwellingLevel * 2 + Math.floor(professionLevel / 4));
  const power = attack + defense + Math.floor(hp / 5) + critRate;

  return { hp, attack, defense, critRate, power };
}

function simulateSecretRealmBattle(player, realm, mode = "thuong") {
  const combat = getCombatStats(player);
  const target = mode === "boss" ? realm.boss : realm.monster;
  const monsterHp = randomBetween(target.hpRange[0], target.hpRange[1]);
  let playerMomentum = combat.attack + Math.floor(combat.power * 0.15);
  let remainingMonsterHp = monsterHp;
  let rounds = 0;
  const logs = [];

  while (remainingMonsterHp > 0 && rounds < 4) {
    rounds += 1;
    const crit = randomBetween(1, 100) <= combat.critRate;
    const damage =
      randomBetween(Math.max(8, Math.floor(playerMomentum * 0.35)), Math.max(14, Math.floor(playerMomentum * 0.55))) *
      (crit ? 2 : 1);
    remainingMonsterHp = Math.max(0, remainingMonsterHp - damage);
    logs.push(`Lượt ${rounds}: Bạn tung linh lực gây **${damage}** sát thương${crit ? " và kích hoạt bạo kích" : ""}.`);
    playerMomentum += 4;
  }

  return {
    combat,
    target,
    monsterHp,
    rounds,
    remainingMonsterHp,
    logs,
    summary:
      remainingMonsterHp <= 0
        ? `Bạn đã hạ gục ${target.emoji} **${target.name}** sau **${rounds}** lượt.`
        : `Bạn áp chế ${target.emoji} **${target.name}** và cướp được cơ duyên trước khi nó kịp phản công.`
  };
}

async function createPlayer(userId, username) {
  await ensurePlayer(userId, username);
  return getPlayer(userId);
}

async function chooseProfession(userId, username, professionId) {
  if (!professions[professionId]) {
    throw new Error("Unknown profession.");
  }
  const player = await createPlayer(userId, username);
  return updatePlayer(userId, {
    username,
    profession: {
      current: professionId,
      xp: player.profession.xp,
      levels: {
        ...player.profession.levels,
        [professionId]: player.profession.levels[professionId] || 1
      }
    },
    cultivation: ensureCultivation(player)
  });
}

async function claimDaily(userId, username) {
  const player = await createPlayer(userId, username);
  const remainingMs = getRemainingMs(player.cooldowns.dailyAt, DAILY_COOLDOWN_MS);
  if (remainingMs > 0) {
    return { ok: false, message: `Daily chưa sẵn sàng. Quay lại sau ${formatDuration(remainingMs)}.` };
  }

  const cultivation = ensureCultivation(player);
  const dwelling = getCurrentDwelling(player);
  const xuGain = DAILY_BASE_XU + cultivation.dwellingLevel * DAILY_DWELLING_XU;
  const ngocGain = DAILY_BASE_NGOC + Math.floor((cultivation.dwellingLevel - 1) / 3);
  const playerXpResult = applyPlayerXp(
    {
      ...player.stats,
      totalXuEarned: player.stats.totalXuEarned + xuGain,
      totalNgocEarned: player.stats.totalNgocEarned + ngocGain
    },
    20
  );

  const updated = await updatePlayer(userId, {
    username,
    wallet: { xu: player.wallet.xu + xuGain, ngoc: player.wallet.ngoc + ngocGain },
    stats: playerXpResult.stats,
    cultivation,
    cooldowns: { ...player.cooldowns, dailyAt: getNow() }
  });

  appendTransaction({ userId, username, type: "daily", changes: { xu: xuGain, ngoc: ngocGain } });
  return {
    ok: true,
    player: updated,
    levelInfo: playerXpResult.levelInfo,
    message: `Bạn nhận được ${xuGain} Xu và ${ngocGain} Ngọc từ daily. Động phủ ${dwelling.name} giúp linh khí dồi dào hơn. +20 Player XP.`
  };
}

async function doWork(userId, username) {
  const player = await createPlayer(userId, username);
  if (!player.profession.current) {
    return { ok: false, message: "Bạn chưa chọn đạo tu. Dùng /choose-profession trước." };
  }

  const remainingMs = getRemainingMs(player.cooldowns.workAt, WORK_COOLDOWN_MS);
  if (remainingMs > 0) {
    return { ok: false, message: `Bạn đang hồi sức. Quay lại sau ${formatDuration(remainingMs)}.` };
  }

  const professionId = player.profession.current;
  const professionConfig = professions[professionId];
  const bonuses = getProfessionBonuses(player, professionId);
  const xuGain = Math.max(1, Math.floor(randomBetween(professionConfig.xuRange[0], professionConfig.xuRange[1]) * bonuses.xuMultiplier));
  const drop = pickWeightedDrop(professionConfig.drops);
  const currentLevel = player.profession.levels[professionId] || 1;
  const xpGain = Math.max(1, Math.floor(professionConfig.xpGain * bonuses.professionXpMultiplier));
  const nextXp = player.profession.xp + xpGain;
  const uncappedLevel = currentLevel + Math.floor(nextXp / 100);
  const realmCap = getRealmCap(player);
  const nextLevel = Math.min(uncappedLevel, realmCap);
  const carriedXp = nextXp % 100;
  const playerXpResult = applyPlayerXp(
    { ...player.stats, totalXuEarned: player.stats.totalXuEarned + xuGain, totalWorkActions: player.stats.totalWorkActions + 1 },
    10
  );

  const updated = await updatePlayer(userId, {
    username,
    wallet: { ...player.wallet, xu: player.wallet.xu + xuGain },
    stats: playerXpResult.stats,
    inventory: addItem(player.inventory, drop.itemId, drop.quantity),
    profession: {
      current: professionId,
      xp: carriedXp,
      levels: { ...player.profession.levels, [professionId]: nextLevel }
    },
    cultivation: ensureCultivation(player),
    cooldowns: { ...player.cooldowns, workAt: getNow() }
  });

  appendTransaction({ userId, username, type: "work", changes: { xu: xuGain, itemId: drop.itemId, quantity: drop.quantity } });

  return {
    ok: true,
    player: updated,
    profession: professionConfig,
    levelInfo: playerXpResult.levelInfo,
    reward: {
      xuGain,
      itemId: drop.itemId,
      itemName: items[drop.itemId]?.name || drop.itemId,
      quantity: drop.quantity,
      xpGain,
      playerXpGain: 10,
      realmCapReached: uncappedLevel > realmCap,
      realmName: getCurrentRealm(player).name,
      realmCap,
      spiritRootName: bonuses.spiritRoot.name,
      spiritRootMatches: bonuses.rootMatches,
      dwellingName: bonuses.dwelling.name,
      artifactName: bonuses.artifact?.name || null,
      artifactMatches: bonuses.artifactMatches
    },
    message: uncappedLevel > realmCap ? `Bạn đã chạm giới hạn cảnh giới ${getCurrentRealm(player).name}. Hãy đột phá để tiếp tục tăng cấp đạo tu.` : null
  };
}

async function getProfile(userId, username) {
  return createPlayer(userId, username);
}

async function getWalletSummary(userId, username) {
  const player = await createPlayer(userId, username);
  return { wallet: player.wallet, stats: player.stats, currencies };
}

function getShopListings() {
  return shopItems.map((entry) => ({ ...entry, currencyName: currencies[entry.currency]?.name || entry.currency }));
}

async function buyShopItem(userId, username, shopId) {
  const player = await createPlayer(userId, username);
  const listing = shopItems.find((entry) => entry.shopId === shopId);
  if (!listing) {
    return { ok: false, message: "Không tìm thấy vật phẩm trong shop." };
  }
  if ((player.wallet[listing.currency] || 0) < listing.price) {
    return { ok: false, message: `Bạn không đủ ${currencies[listing.currency]?.name || listing.currency}.` };
  }
  const updated = await updatePlayer(userId, {
    username,
    wallet: { ...player.wallet, [listing.currency]: player.wallet[listing.currency] - listing.price },
    inventory: addItem(player.inventory, listing.itemId, listing.quantity)
  });
  appendTransaction({
    userId,
    username,
    type: "shop_buy",
    changes: { currency: listing.currency, amount: -listing.price, itemId: listing.itemId, quantity: listing.quantity }
  });
  return { ok: true, player: updated, message: `Bạn đã mua ${listing.name} với giá ${listing.price} ${currencies[listing.currency]?.name || listing.currency}.` };
}

async function getInventoryLines(userId, username) {
  const player = await createPlayer(userId, username);
  const entries = Object.entries(player.inventory);
  if (entries.length === 0) {
    return ["Kho đồ đang trống."];
  }
  return entries
    .sort((left, right) => right[1] - left[1])
    .slice(0, 14)
    .map(([itemId, quantity]) => {
      const item = items[itemId];
      return `${item ? `${item.emoji} ${item.name}` : itemId} x${quantity} [${item?.rarity || "Unknown"}]`;
    });
}

function getRecipeListings() {
  return recipes.map((recipe) => ({ ...recipe, outputName: items[recipe.output.itemId]?.name || recipe.output.itemId }));
}

async function craftRecipe(userId, username, recipeId) {
  const player = await createPlayer(userId, username);
  const recipe = recipes.find((entry) => entry.recipeId === recipeId);
  if (!recipe) {
    return { ok: false, message: "Không tìm thấy công thức craft." };
  }
  if (!hasEnoughInputs(player.inventory, recipe.inputs)) {
    return { ok: false, message: "Bạn chưa đủ nguyên liệu để craft." };
  }
  if (player.wallet.xu < recipe.cost.xu) {
    return { ok: false, message: "Bạn không đủ Xu để craft." };
  }
  const inventoryAfterConsume = consumeInputs(player.inventory, recipe.inputs);
  const updated = await updatePlayer(userId, {
    username,
    wallet: { ...player.wallet, xu: player.wallet.xu - recipe.cost.xu },
    inventory: addItem(inventoryAfterConsume, recipe.output.itemId, recipe.output.quantity)
  });
  appendTransaction({
    userId,
    username,
    type: "craft",
    changes: { xu: -recipe.cost.xu, outputItemId: recipe.output.itemId, outputQuantity: recipe.output.quantity }
  });
  return { ok: true, player: updated, message: `Bạn đã craft ${items[recipe.output.itemId]?.name || recipe.output.itemId} x${recipe.output.quantity}.` };
}

async function sellItem(userId, username, itemId, quantity) {
  const player = await createPlayer(userId, username);
  const owned = player.inventory[itemId] || 0;
  const sellRate = sellRates[itemId];
  if (!sellRate) {
    return { ok: false, message: "Vật phẩm này hiện chưa bán được cho hệ thống." };
  }
  if (owned < quantity || quantity <= 0) {
    return { ok: false, message: "Số lượng không hợp lệ hoặc kho đồ không đủ." };
  }
  const xuGain = sellRate * quantity;
  const updated = await updatePlayer(userId, {
    username,
    wallet: { ...player.wallet, xu: player.wallet.xu + xuGain },
    stats: { ...player.stats, totalXuEarned: player.stats.totalXuEarned + xuGain, totalItemsSold: player.stats.totalItemsSold + quantity },
    inventory: removeItem(player.inventory, itemId, quantity)
  });
  appendTransaction({ userId, username, type: "sell", changes: { xu: xuGain, itemId, quantity: -quantity } });
  return { ok: true, player: updated, message: `Bạn đã bán ${quantity} ${items[itemId]?.name || itemId} và nhận ${xuGain} Xu.` };
}

async function getCultivationStatus(userId, username) {
  const player = await createPlayer(userId, username);
  const cultivation = ensureCultivation(player);
  const currentRealm = getCurrentRealm(player);
  const nextRealm = getNextRealm(player);
  const professionLevel = player.profession.current ? player.profession.levels[player.profession.current] || 1 : 0;
  return {
    player,
    cultivation,
    currentRealm,
    nextRealm,
    professionLevel,
    spiritRoot: getSpiritRootByKey(cultivation.spiritRootKey),
    dwelling: getCurrentDwelling(player),
    artifact: getArtifactById(cultivation.equippedArtifactId),
    combat: getCombatStats(player),
    canBreakthrough: Boolean(nextRealm) && professionLevel >= currentRealm.levelCap
  };
}

async function getCultivationOverview(userId, username) {
  const player = await createPlayer(userId, username);
  const cultivation = ensureCultivation(player);
  const currentRealm = getCurrentRealm(player);
  const nextRealm = getNextRealm(player);
  const professionEntries = Object.entries(professions).map(([professionId, professionConfig]) => ({
    professionId,
    name: professionConfig.name,
    level: player.profession.levels[professionId] || 1,
    isCurrent: player.profession.current === professionId
  }));
  const currentProfessionLevel = player.profession.current ? player.profession.levels[player.profession.current] || 1 : 0;
  return {
    player,
    cultivation,
    spiritRoot: getSpiritRootByKey(cultivation.spiritRootKey),
    dwelling: getCurrentDwelling(player),
    nextDwelling: getNextDwelling(player),
    artifact: getArtifactById(cultivation.equippedArtifactId),
    combat: getCombatStats(player),
    currentRealm,
    nextRealm,
    currentProfessionLevel,
    professionEntries,
    currentProfession: player.profession.current ? professions[player.profession.current] : null,
    canBreakthrough: Boolean(nextRealm) && currentProfessionLevel >= currentRealm.levelCap,
    breakthroughCostText: nextRealm ? formatCost(nextRealm.breakthroughCost) : "Đã đạt cảnh giới tối đa",
    dwellingUpgradeCostText: getNextDwelling(player) ? formatCost(getNextDwelling(player).upgradeCost) : "Động phủ đã tối đa"
  };
}

async function attemptBreakthrough(userId, username) {
  const player = await createPlayer(userId, username);
  const currentRealm = getCurrentRealm(player);
  const nextRealm = getNextRealm(player);
  const professionLevel = player.profession.current ? player.profession.levels[player.profession.current] || 1 : 0;
  if (!player.profession.current) {
    return { ok: false, message: "Bạn chưa chọn đạo tu chính nên chưa thể đột phá." };
  }
  if (!nextRealm) {
    return { ok: false, message: "Bạn đã ở cảnh giới cao nhất hiện tại." };
  }
  if (professionLevel < currentRealm.levelCap) {
    return { ok: false, message: `Bạn cần đạt cấp đạo tu ${currentRealm.levelCap} để đột phá từ ${currentRealm.name}.` };
  }
  if (player.wallet.xu < nextRealm.breakthroughCost.xu) {
    return { ok: false, message: `Bạn chưa đủ Xu để đột phá. Cần ${formatCost(nextRealm.breakthroughCost)}.` };
  }
  if (!hasEnoughInputs(player.inventory, nextRealm.breakthroughCost.items || [])) {
    return { ok: false, message: `Bạn chưa đủ tài nguyên đột phá. Cần ${formatCost(nextRealm.breakthroughCost)}.` };
  }
  const updated = await updatePlayer(userId, {
    username,
    wallet: { ...player.wallet, xu: player.wallet.xu - nextRealm.breakthroughCost.xu },
    inventory: consumeInputs(player.inventory, nextRealm.breakthroughCost.items || []),
    cultivation: { ...ensureCultivation(player), realm: nextRealm.key, realmIndex: ensureCultivation(player).realmIndex + 1 }
  });
  appendTransaction({ userId, username, type: "breakthrough", changes: { xu: -nextRealm.breakthroughCost.xu, nextRealm: nextRealm.key } });
  return { ok: true, player: updated, currentRealm, nextRealm, message: `Bạn đã đột phá từ ${currentRealm.name} lên ${nextRealm.name}. Giới hạn cấp đạo tu mới: ${nextRealm.levelCap}.` };
}

async function getDwellingStatus(userId, username) {
  const player = await createPlayer(userId, username);
  return {
    player,
    cultivation: ensureCultivation(player),
    dwelling: getCurrentDwelling(player),
    nextDwelling: getNextDwelling(player),
    upgradeCostText: getNextDwelling(player) ? formatCost(getNextDwelling(player).upgradeCost) : "Động phủ đã tối đa"
  };
}

async function upgradeDwelling(userId, username) {
  const player = await createPlayer(userId, username);
  const currentDwelling = getCurrentDwelling(player);
  const nextDwelling = getNextDwelling(player);
  if (!nextDwelling) {
    return { ok: false, message: "Động phủ của bạn đã đạt cấp tối đa." };
  }
  if (player.wallet.xu < nextDwelling.upgradeCost.xu) {
    return { ok: false, message: `Bạn chưa đủ Xu để nâng cấp động phủ. Cần ${formatCost(nextDwelling.upgradeCost)}.` };
  }
  if (!hasEnoughInputs(player.inventory, nextDwelling.upgradeCost.items || [])) {
    return { ok: false, message: `Bạn chưa đủ vật liệu để nâng cấp động phủ. Cần ${formatCost(nextDwelling.upgradeCost)}.` };
  }
  const updated = await updatePlayer(userId, {
    username,
    wallet: { ...player.wallet, xu: player.wallet.xu - nextDwelling.upgradeCost.xu },
    inventory: consumeInputs(player.inventory, nextDwelling.upgradeCost.items || []),
    cultivation: { ...ensureCultivation(player), dwellingLevel: nextDwelling.level }
  });
  appendTransaction({ userId, username, type: "dwelling_upgrade", changes: { xu: -nextDwelling.upgradeCost.xu, nextDwellingLevel: nextDwelling.level } });
  return { ok: true, player: updated, currentDwelling, nextDwelling, message: `Bạn đã nâng động phủ từ ${currentDwelling.name} lên ${nextDwelling.name}. Tăng ${nextDwelling.xuBonusPercent}% Xu farm và ${nextDwelling.professionXpBonusPercent}% XP đạo tu.` };
}

async function getArtifactStatus(userId, username) {
  const player = await createPlayer(userId, username);
  const cultivation = ensureCultivation(player);
  const ownedArtifacts = Object.keys(player.inventory)
    .filter((itemId) => getArtifactById(itemId))
    .map((itemId) => ({ ...getArtifactById(itemId), quantity: player.inventory[itemId] }));
  return { player, equippedArtifact: getArtifactById(cultivation.equippedArtifactId), ownedArtifacts };
}

async function equipArtifact(userId, username, artifactId) {
  const player = await createPlayer(userId, username);
  const artifact = getArtifactById(artifactId);
  if (!artifact) {
    return { ok: false, message: "Pháp bảo này không tồn tại." };
  }
  if ((player.inventory[artifactId] || 0) < 1) {
    return { ok: false, message: "Bạn chưa sở hữu pháp bảo này." };
  }
  const updated = await updatePlayer(userId, {
    username,
    cultivation: { ...ensureCultivation(player), equippedArtifactId: artifactId }
  });
  appendTransaction({ userId, username, type: "equip_artifact", changes: { artifactId } });
  return { ok: true, player: updated, artifact, message: `Bạn đã trang bị pháp bảo **${artifact.name}**.` };
}

async function unequipArtifact(userId, username) {
  const player = await createPlayer(userId, username);
  const cultivation = ensureCultivation(player);
  if (!cultivation.equippedArtifactId) {
    return { ok: false, message: "Hiện tại bạn chưa trang bị pháp bảo nào." };
  }
  const artifact = getArtifactById(cultivation.equippedArtifactId);
  const updated = await updatePlayer(userId, {
    username,
    cultivation: { ...cultivation, equippedArtifactId: null }
  });
  appendTransaction({ userId, username, type: "unequip_artifact", changes: { artifactId: cultivation.equippedArtifactId } });
  return { ok: true, player: updated, artifact, message: `Bạn đã tháo pháp bảo **${artifact?.name || cultivation.equippedArtifactId}**.` };
}

function getSecretRealmById(realmId) {
  return secretRealms.find((entry) => entry.realmId === realmId) || null;
}

function getSecretRealmListings() {
  return secretRealms;
}

async function exploreSecretRealm(userId, username, realmId, mode = "thuong") {
  const player = await createPlayer(userId, username);
  const realm = getSecretRealmById(realmId);
  if (!realm) {
    return { ok: false, message: "Không tìm thấy bí cảnh này." };
  }
  if (mode === "boss" && !realm.boss) {
    return { ok: false, message: "Bí cảnh này chưa có boss riêng." };
  }
  const cultivation = ensureCultivation(player);
  if (cultivation.realmIndex < realm.minRealmIndex) {
    return { ok: false, message: `Bạn cần đạt cảnh giới ${cultivationRealms[realm.minRealmIndex].name} để vào ${realm.name}.` };
  }
  const cooldownMs = realm.cooldownHours * 60 * 60 * 1000;
  const remainingMs = getRemainingMs(player.cooldowns.secretRealmAt || 0, cooldownMs);
  if (remainingMs > 0) {
    return { ok: false, message: `Bí cảnh chưa ổn định lại. Quay lại sau ${formatDuration(remainingMs)}.` };
  }

  const battle = simulateSecretRealmBattle(player, realm, mode);
  const xuGainBase = randomBetween(realm.xuRange[0], realm.xuRange[1]);
  const xuGain = mode === "boss" ? Math.floor(xuGainBase * (realm.boss?.xuMultiplier || 2)) : xuGainBase;
  const playerXpGain = mode === "boss" ? Math.floor(realm.playerXpGain * (realm.boss?.xpMultiplier || 2)) : realm.playerXpGain;
  const bossBonusWeight = mode === "boss" ? realm.boss?.dropBonusWeight || 0 : 0;
  const dropTable = realm.drops.map((entry) => ({
    ...entry,
    weight: entry.weight + ((items[entry.itemId]?.rarity === "Epic" || items[entry.itemId]?.rarity === "Legendary") ? bossBonusWeight : 0)
  }));
  const drop = pickWeightedDrop(dropTable);
  const playerXpResult = applyPlayerXp({ ...player.stats, totalXuEarned: player.stats.totalXuEarned + xuGain }, playerXpGain);

  const updated = await updatePlayer(userId, {
    username,
    wallet: { ...player.wallet, xu: player.wallet.xu + xuGain },
    stats: playerXpResult.stats,
    inventory: addItem(player.inventory, drop.itemId, drop.quantity),
    cooldowns: { ...player.cooldowns, secretRealmAt: getNow() }
  });

  appendTransaction({
    userId,
    username,
    type: mode === "boss" ? "secret_realm_boss" : "secret_realm",
    changes: { realmId, mode, xu: xuGain, itemId: drop.itemId, quantity: drop.quantity }
  });

  return {
    ok: true,
    player: updated,
    levelInfo: playerXpResult.levelInfo,
    realm,
    mode,
    reward: {
      xuGain,
      itemId: drop.itemId,
      itemName: items[drop.itemId]?.name || drop.itemId,
      quantity: drop.quantity,
      playerXpGain
    },
    battle,
    message: `${battle.target.emoji} **${battle.target.name}** ${battle.target.attackText}. ${battle.summary} Bạn đã ${mode === "boss" ? "đánh bại boss tại" : "thám hiểm"} **${realm.name}** và mang về ${xuGain} Xu cùng ${items[drop.itemId]?.name || drop.itemId} x${drop.quantity}.`
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
  formatDuration,
  getCultivationStatus,
  getCultivationOverview,
  attemptBreakthrough,
  getDwellingStatus,
  upgradeDwelling,
  getArtifactStatus,
  equipArtifact,
  unequipArtifact,
  getSecretRealmListings,
  exploreSecretRealm,
  getCombatStats
};
