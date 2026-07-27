const { SlashCommandBuilder } = require("discord.js");
const {
  getHelpText,
  scheduleTurnTimeout,
  sendOrRefreshStatusMessage,
  startSession
} = require("../services/word-chain-service");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("noitu-tao")
    .setDescription("Tạo một ván nối từ PvP trong kênh hiện tại.")
    .addStringOption((option) =>
      option
        .setName("tu_goi_y")
        .setDescription("Cụm mở đầu 2 tiếng nếu bạn muốn tự chọn")
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

      await interaction.reply(`Đã tạo ván nối từ mới.\n${getHelpText(session)}`);
      scheduleTurnTimeout(session, interaction.channel);
      await sendOrRefreshStatusMessage(interaction.channel, session, {
        title: "Nối Từ PvP",
        accent: 0x3498db,
        lastMoveLine: "Ván mới đã bắt đầu."
      });
    } catch (error) {
      await interaction.reply({ content: error.message, ephemeral: true });
    }
  }
};
