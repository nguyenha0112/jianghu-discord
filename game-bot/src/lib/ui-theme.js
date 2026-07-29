const items = require("../config/items");

function emojiToTwemojiUrl(emoji) {
  if (!emoji) {
    return null;
  }

  const codePoints = [...emoji]
    .map((char) => char.codePointAt(0).toString(16))
    .join("-");

  return `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/${codePoints}.png`;
}

const professionThemes = {
  fishing: { emoji: "🎣", color: 0x3ba7ff, name: "Ngư Đạo" },
  mining: { emoji: "⛏️", color: 0x8e8e93, name: "Khoáng Đạo" },
  gathering: { emoji: "🌿", color: 0x4caf50, name: "Thảo Đạo" },
  alchemy: { emoji: "🧪", color: 0x9c6bff, name: "Đan Đạo" },
  archaeology: { emoji: "🏺", color: 0xc68642, name: "Cổ Tu Đạo" }
};

const realmThemes = {
  pham_nhan: { emoji: "🪨", color: 0x95a5a6, name: "Phàm Nhân" },
  luyen_khi: { emoji: "🌫️", color: 0x74b9ff, name: "Luyện Khí" },
  truc_co: { emoji: "🌱", color: 0x2ecc71, name: "Trúc Cơ" },
  kim_dan: { emoji: "☀️", color: 0xf1c40f, name: "Kim Đan" }
};

const rarityThemes = {
  Common: { emoji: "⚪", color: 0xbdc3c7 },
  Uncommon: { emoji: "🟢", color: 0x2ecc71 },
  Rare: { emoji: "🔵", color: 0x3498db },
  Epic: { emoji: "🟣", color: 0x9b59b6 },
  Legendary: { emoji: "🟠", color: 0xe67e22 }
};

function getProfessionTheme(professionId) {
  return professionThemes[professionId] || { emoji: "🧭", color: 0x7f8c8d, name: professionId || "Tán Tu" };
}

function getRealmTheme(realmKey) {
  return realmThemes[realmKey] || { emoji: "✨", color: 0xf1c40f, name: realmKey || "Ẩn Cảnh" };
}

function getRarityTheme(rarity) {
  return rarityThemes[rarity] || { emoji: "🔹", color: 0x5dade2 };
}

function getItemTheme(itemId) {
  const item = items[itemId];
  const rarityTheme = getRarityTheme(item?.rarity);
  return {
    item,
    emoji: item?.emoji || rarityTheme.emoji,
    color: rarityTheme.color,
    rarityEmoji: rarityTheme.emoji
  };
}

function buildProgressBar(current, max, size = 10) {
  const safeMax = Math.max(1, max);
  const ratio = Math.max(0, Math.min(1, current / safeMax));
  const filled = Math.round(ratio * size);
  return `${"█".repeat(filled)}${"░".repeat(Math.max(0, size - filled))}`;
}

function formatItemLabel(itemId, quantity = null) {
  const { item, emoji, rarityEmoji } = getItemTheme(itemId);
  const name = item?.name || itemId;
  const qty = quantity == null ? "" : ` x${quantity}`;
  return `${emoji} ${name}${qty} ${rarityEmoji}`.trim();
}

function getPrimaryVisual(professionId, realmKey) {
  const realmTheme = getRealmTheme(realmKey);
  const professionTheme = getProfessionTheme(professionId);
  return {
    color: realmTheme.color || professionTheme.color,
    thumbnailUrl: emojiToTwemojiUrl(professionTheme.emoji),
    realmIconUrl: emojiToTwemojiUrl(realmTheme.emoji)
  };
}

function formatLevelUpText(levelInfo) {
  if (!levelInfo?.didLevelUp) {
    return null;
  }
  return `🎉 Lên cấp tu vi từ **${levelInfo.levelBefore}** lên **${levelInfo.levelAfter}**.`;
}

function buildCuteLevelField(levelInfo) {
  if (!levelInfo?.didLevelUp) {
    return null;
  }
  return {
    name: "🌸 Thăng cấp",
    value: `Từ cấp **${levelInfo.levelBefore}** lên **${levelInfo.levelAfter}**\n✨ Linh lực lại dồi dào hơn rồi.`,
    inline: false
  };
}

module.exports = {
  emojiToTwemojiUrl,
  getProfessionTheme,
  getRealmTheme,
  getRarityTheme,
  getItemTheme,
  buildProgressBar,
  formatItemLabel,
  getPrimaryVisual,
  formatLevelUpText,
  buildCuteLevelField
};
