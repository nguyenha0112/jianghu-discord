const { SlashCommandBuilder } = require("discord.js");
const { getHelpText, startSession } = require("../services/word-chain-service");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("noitu-tao")
    .setDescription("Tạo một ván nối từ trong channel hiện tại.")
    .addStringOption((option) =>
      option
        .setName("tu_goi_y")
        .setDescription("Cụm từ mở đầu nếu bạn muốn tự chọn")
        .setRequired(false)
    ),
  async execute(interaction) {
    try {
      const seedPhrase = interaction.options.getString("tu_goi_y");
      const session = startSession({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        channelName: interaction.channel?.name || "unknown",
        hostUserId: interaction.user.id,
        hostUsername: interaction.user.username,
        seedPhrase
      });

      await interaction.reply(
        [
          "Đã tạo ván nối từ mới.",
          getHelpText(session)
        ].join("\n")
      );
    } catch (error) {
      await interaction.reply({ content: error.message, ephemeral: true });
    }
  }
};
