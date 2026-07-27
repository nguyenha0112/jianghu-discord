const { SlashCommandBuilder } = require("discord.js");
const {
  getHelpText,
  getRoomMode,
  scheduleTurnTimeout,
  sendOrRefreshStatusMessage,
  startSession
} = require("../services/word-chain-service");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("noitu-tao")
    .setDescription("Tạo ván nối từ theo chế độ của phòng hiện tại.")
    .addStringOption((option) =>
      option
        .setName("tu_goi_y")
        .setDescription("Cụm mở đầu 2 tiếng nếu bạn muốn tự chọn")
        .setRequired(false)
    ),
  async execute(interaction) {
    try {
      const seedPhrase = interaction.options.getString("tu_goi_y");
      const mode = getRoomMode(interaction.channelId);
      const session = startSession({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        channelName: interaction.channel?.name || "unknown",
        hostUserId: interaction.user.id,
        hostUsername: interaction.user.username,
        seedPhrase,
        mode
      });

      await interaction.reply(`Đã tạo ván nối từ ${mode.toUpperCase()} mới.\n${getHelpText(session)}`);
      scheduleTurnTimeout(session, interaction.channel);
      await sendOrRefreshStatusMessage(interaction.channel, session, {
        accent: 0x3498db,
        lastMoveLine: "Ván mới đã bắt đầu."
      });
    } catch (error) {
      await interaction.reply({ content: error.message, ephemeral: true });
    }
  }
};
