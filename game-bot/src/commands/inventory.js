const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const { getInventoryLines } = require("../services/game-service");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("inventory")
    .setDescription("Xem inventory hien tai cua ban."),
  async execute(interaction) {
    const lines = getInventoryLines(interaction.user.id, interaction.user.username);
    const embed = new EmbedBuilder()
      .setTitle(`${interaction.user.username} - Inventory`)
      .setDescription(lines.join("\n"));

    await interaction.reply({ embeds: [embed] });
  }
};
