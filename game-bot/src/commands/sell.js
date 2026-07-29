const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const { sellItem } = require("../services/game-service");
const sellRates = require("../config/sell-rates");
const items = require("../config/items");
const { emojiToTwemojiUrl, formatItemLabel } = require("../lib/ui-theme");

const sellChoices = Object.keys(sellRates).map((itemId) => ({
  name: items[itemId]?.name || itemId,
  value: itemId
}));

module.exports = {
  data: new SlashCommandBuilder()
    .setName("sell")
    .setDescription("Ban vat pham trong kho de doi Xu.")
    .addStringOption((option) =>
      option
        .setName("vat_pham")
        .setDescription("Chon vat pham muon ban")
        .setRequired(true)
        .addChoices(...sellChoices)
    )
    .addIntegerOption((option) =>
      option
        .setName("so_luong")
        .setDescription("So luong muon ban")
        .setRequired(true)
        .setMinValue(1)
    ),
  async execute(interaction) {
    const itemId = interaction.options.getString("vat_pham", true);
    const quantity = interaction.options.getInteger("so_luong", true);
    const result = await sellItem(interaction.user.id, interaction.user.username, itemId, quantity);

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(result.ok ? 0x2ecc71 : 0xe74c3c)
          .setTitle(result.ok ? "💰 Bán Vật Phẩm Thành Công" : "💰 Không Thể Bán")
          .setThumbnail(emojiToTwemojiUrl(result.ok ? "💰" : "⚠️"))
          .setDescription(result.message)
          .addFields(result.ok ? [{ name: "Vật phẩm", value: formatItemLabel(itemId, quantity), inline: true }] : [])
      ]
    });
  }
};
