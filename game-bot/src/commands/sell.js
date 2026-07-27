const { SlashCommandBuilder } = require("discord.js");
const { sellItem } = require("../services/game-service");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("sell")
    .setDescription("Ban vat pham trong kho de doi Xu.")
    .addStringOption((option) =>
      option
        .setName("item_id")
        .setDescription("Item ID, vi du river_fish")
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("quantity")
        .setDescription("So luong muon ban")
        .setRequired(true)
        .setMinValue(1)
    ),
  async execute(interaction) {
    const itemId = interaction.options.getString("item_id", true);
    const quantity = interaction.options.getInteger("quantity", true);
    const result = sellItem(interaction.user.id, interaction.user.username, itemId, quantity);
    await interaction.reply(result.message);
  }
};
