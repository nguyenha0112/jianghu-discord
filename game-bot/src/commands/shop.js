const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const { buyShopItem, getShopListings } = require("../services/game-service");
const { emojiToTwemojiUrl, formatItemLabel, getItemTheme } = require("../lib/ui-theme");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("shop")
    .setDescription("Xem hoac mua vat pham trong shop.")
    .addStringOption((option) =>
      option
        .setName("shop_id")
        .setDescription("Nhap shop_id neu muon mua ngay")
        .setRequired(false)
    ),
  async execute(interaction) {
    const shopId = interaction.options.getString("shop_id");

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
          .map((entry) => {
            return `\`${entry.shopId}\`\n${formatItemLabel(entry.itemId, entry.quantity)}\nGiá: **${entry.price} ${entry.currencyName}**\n${entry.description}`;
          })
          .join("\n\n")
      )
      .setFooter({ text: "Dùng /shop với shop_id để mua ngay một vật phẩm." });

    await interaction.reply({ embeds: [embed] });
  }
};
