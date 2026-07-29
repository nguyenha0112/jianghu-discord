const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const { buyShopItem, getShopListings } = require("../services/game-service");
const { emojiToTwemojiUrl, formatItemLabel, getItemTheme } = require("../lib/ui-theme");

const shopChoices = getShopListings().map((entry) => ({
  name: `${entry.name} - ${entry.price} ${entry.currencyName}`,
  value: entry.shopId
}));

module.exports = {
  data: new SlashCommandBuilder()
    .setName("shop")
    .setDescription("Xem hoac mua vat pham trong shop.")
    .addStringOption((option) =>
      option
        .setName("vat_pham")
        .setDescription("Chon vat pham muon mua ngay")
        .setRequired(false)
        .addChoices(...shopChoices)
    ),
  async execute(interaction) {
    const shopId = interaction.options.getString("vat_pham");

    if (shopId) {
      const result = await buyShopItem(interaction.user.id, interaction.user.username, shopId);
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(result.ok ? 0x2ecc71 : 0xe74c3c)
            .setTitle(result.ok ? "🛒 Mua Thành Công" : "🛒 Giao Dịch Thất Bại")
            .setThumbnail(emojiToTwemojiUrl(result.ok ? "🛍️" : "⚠️"))
            .setDescription(result.message)
        ]
      });
      return;
    }

    const listings = getShopListings();
    const firstTheme = getItemTheme(listings[0]?.itemId);
    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle("🛍️ Jianghu Tiên Phường")
      .setThumbnail(emojiToTwemojiUrl(firstTheme.emoji))
      .setDescription(
        listings
          .map((entry) => `${formatItemLabel(entry.itemId, entry.quantity)}\nGiá: **${entry.price} ${entry.currencyName}**\n${entry.description}`)
          .join("\n\n")
      )
      .setFooter({ text: "Dùng /shop rồi chọn mục 'vat_pham' nếu muốn mua ngay." });

    await interaction.reply({ embeds: [embed] });
  }
};
