const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const { buyShopItem, getShopListings } = require("../services/game-service");

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
      await interaction.reply(result.message);
      return;
    }

    const listings = getShopListings();
    const embed = new EmbedBuilder()
      .setTitle("Jianghu Shop")
      .setDescription(
        listings
          .map((entry) => {
            return `\`${entry.shopId}\` - ${entry.name} | ${entry.price} ${entry.currencyName}\n${entry.description}`;
          })
          .join("\n\n")
      );

    await interaction.reply({ embeds: [embed] });
  }
};
