const { SlashCommandBuilder } = require("discord.js");
const { resetPlayerData } = require("../services/admin-service");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("admin-reset-player")
    .setDescription("Reset toan bo du lieu cua mot player.")
    .addStringOption((option) =>
      option
        .setName("user_id")
        .setDescription("Discord user ID cua player")
        .setRequired(true)
    ),
  async execute(interaction) {
    try {
      const userId = interaction.options.getString("user_id", true);
      const result = await resetPlayerData(interaction.user.id, userId);
      await interaction.reply({ content: result.message, ephemeral: true });
    } catch (error) {
      await interaction.reply({ content: error.message, ephemeral: true });
    }
  }
};
