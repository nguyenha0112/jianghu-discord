const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const { getRecentTransactions } = require("../services/admin-service");

function formatDateTime(rawValue) {
  if (!rawValue) {
    return "Khong ro thoi gian";
  }

  const date = new Date(rawValue);
  if (Number.isNaN(date.getTime())) {
    return rawValue;
  }

  return date.toLocaleString("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatNumber(value) {
  return new Intl.NumberFormat("vi-VN").format(Number(value || 0));
}

function formatSignedCurrency(value, unit = "Xu") {
  const amount = Number(value || 0);
  const prefix = amount > 0 ? "+" : "";
  return `${prefix}${formatNumber(amount)} ${unit}`;
}

function formatChanges(type, changes = {}) {
  switch (type) {
    case "daily":
      return `Nhan daily: 🪙 ${formatSignedCurrency(changes.xu)}${changes.ngoc ? `, 💎 ${formatSignedCurrency(changes.ngoc, "Ngoc")}` : ""}.`;
    case "work":
      return `Di lam nhan 🪙 ${formatSignedCurrency(changes.xu)}${changes.itemId ? `, vat pham \`${changes.itemId}\` x${changes.quantity || 1}` : ""}.`;
    case "sell":
      return `Ban vat pham \`${changes.itemId || "khong ro"}\` x${Math.abs(Number(changes.quantity || 0))}, nhan 🪙 ${formatSignedCurrency(changes.xu)}.`;
    case "buy_shop":
      return `Mua vat pham shop \`${changes.shopId || changes.itemId || "khong ro"}\`, tru ${formatNumber(Math.abs(Number(changes.xu || 0)))} ${changes.currency === "ngoc" ? "Ngoc" : "Xu"}.`;
    case "craft":
      return `Che tao \`${changes.recipeId || changes.itemId || "khong ro"}\`${changes.xu ? `, tru 🪙 ${formatNumber(Math.abs(Number(changes.xu)))} Xu` : ""}.`;
    case "breakthrough":
      return `Dot pha canh gioi moi \`${changes.nextRealm || "khong ro"}\`, tieu hao 🪙 ${formatNumber(Math.abs(Number(changes.xu || 0)))} Xu.`;
    case "dwelling_upgrade":
      return `Nang cap dong phu len cap ${changes.nextDwellingLevel || "?"}, tieu hao 🪙 ${formatNumber(Math.abs(Number(changes.xu || 0)))} Xu.`;
    case "equip_artifact":
      return `Trang bi phap bao \`${changes.artifactId || "khong ro"}\`.`;
    case "unequip_artifact":
      return `Thao phap bao \`${changes.artifactId || "khong ro"}\`.`;
    case "secret_realm":
      return `Tham hiem bi canh nhan 🪙 ${formatSignedCurrency(changes.xu)}${changes.itemId ? `, vat pham \`${changes.itemId}\` x${changes.quantity || 1}` : ""}${changes.playerXp ? `, +${formatNumber(changes.playerXp)} XP` : ""}.`;
    case "taixiu_bet":
      return `Dat cuoc Tai Xiu cua **${String(changes.side || "").toUpperCase()}**, tru 🪙 ${formatNumber(Math.abs(Number(changes.xu || 0)))} Xu${changes.xpGain ? `, +${formatNumber(changes.xpGain)} XP` : ""}.`;
    case "taixiu_win":
      return `Thang Tai Xiu cua **${String(changes.side || "").toUpperCase()}**, nhan 🪙 ${formatNumber(Number(changes.xu || 0))} Xu${changes.rollTotal ? `, tong xuc xac ${changes.rollTotal}` : ""}${changes.xpGain ? `, +${formatNumber(changes.xpGain)} XP` : ""}.`;
    case "word_chain_final_reward":
      return `Thuong cuoi van Noi Tu: 🪙 ${formatSignedCurrency(changes.xu)}${changes.playerXp ? `, +${formatNumber(changes.playerXp)} XP` : ""}.`;
    case "vietnamese_king_final_reward":
      return `Thuong cuoi van Vua Tieng Viet: 🪙 ${formatSignedCurrency(changes.xu)}${changes.playerXp ? `, +${formatNumber(changes.playerXp)} XP` : ""}.`;
    case "monthly_reward_award":
      return `Duoc xet thuong thang ky ${changes.periodId || "khong ro"}, nhan 💎 ${formatNumber(Number(changes.ngoc || 0))} Ngoc.`;
    case "give_xu_sent":
      return `Chuyen 🪙 ${formatNumber(Math.abs(Number(changes.xu || 0)))} Xu cho **${changes.toUsername || changes.toUserId || "khong ro"}**${changes.fee ? `, phi ${formatNumber(Number(changes.fee))} Xu` : ""}.`;
    case "give_xu_received":
      return `Nhan 🪙 ${formatNumber(Number(changes.xu || 0))} Xu tu **${changes.fromUsername || changes.fromUserId || "khong ro"}**.`;
    default:
      return JSON.stringify(changes);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("admin-transactions")
    .setDescription("Xem giao dich gan nhat.")
    .addStringOption((option) =>
      option
        .setName("user_id")
        .setDescription("Loc theo Discord user ID")
        .setRequired(false)
    )
    .addIntegerOption((option) =>
      option
        .setName("limit")
        .setDescription("So giao dich muon xem")
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(20)
    ),
  async execute(interaction) {
    try {
      const userId = interaction.options.getString("user_id");
      const limit = interaction.options.getInteger("limit") || 10;
      const rows = await getRecentTransactions(interaction.user.id, userId, limit);

      const description =
        rows.length === 0
          ? "Chua co giao dich nao."
          : rows
              .map(
                (row) =>
                  `• **${row.username}**\nThoi gian: ${formatDateTime(row.created_at)}\nLoai: \`${row.type}\`\nNoi dung: ${formatChanges(row.type, row.changes)}`
              )
              .join("\n\n");

      const embed = new EmbedBuilder().setTitle("Admin Transactions").setDescription(description.slice(0, 4000));

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      await interaction.reply({ content: error.message, ephemeral: true });
    }
  }
};
