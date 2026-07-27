const { SlashCommandBuilder } = require("discord.js");
const { claimDaily } = require("../services/game-service");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("daily")
    .setDescription("Nhan daily hang ngay."),
  async execute(interaction) {
    const result = await claimDaily(interaction.user.id, interaction.user.username);
    await interaction.reply(result.message);
  }
};
