const { SlashCommandBuilder } = require("discord.js");
const { claimDaily } = require("../services/game-service");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("daily")
    .setDescription("Nhận daily hằng ngày."),
  async execute(interaction) {
    const result = claimDaily(interaction.user.id, interaction.user.username);
    await interaction.reply(result.message);
  }
};
