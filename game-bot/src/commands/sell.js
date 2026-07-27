const { SlashCommandBuilder } = require("discord.js");
const { sellItem } = require("../services/game-service");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("sell")
    .setDescription("Bán vật phẩm trong kho để đổi Xu.")
    .addStringOption((option) =>
      option
        .setName("item_id")
        .setDescription("Item ID, ví dụ river_fish")
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("quantity")
        .setDescription("Số lượng muốn bán")
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
