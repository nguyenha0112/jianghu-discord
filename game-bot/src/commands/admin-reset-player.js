const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const { resetPlayerData } = require("../services/admin-service");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("admin-reset-player")
    .setDescription("Reset toan bo du lieu cua mot player.")
    .addUserOption((option) =>
      option
        .setName("nguoi_choi")
        .setDescription("Chon nguoi choi can reset")
        .setRequired(true)
    ),
  async execute(interaction) {
    try {
      const targetUser = interaction.options.getUser("nguoi_choi", true);
      const result = await resetPlayerData(interaction.user.id, targetUser.id);
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(result.ok ? 0xf39c12 : 0xe74c3c)
            .setTitle(result.ok ? "🧹 Đã Reset Dữ Liệu Player" : "🧹 Không Thể Reset")
            .setDescription(result.message)
        ],
        ephemeral: true
      });
    } catch (error) {
      await interaction.reply({ content: error.message, ephemeral: true });
    }
  }
};
