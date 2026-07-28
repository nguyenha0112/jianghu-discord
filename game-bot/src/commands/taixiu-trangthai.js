const { SlashCommandBuilder } = require("discord.js");
const { buildStatusEmbed, getRoomConfig, getSessionStatus } = require("../services/taixiu-service");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("taixiu-trangthai")
    .setDescription("Xem trạng thái kèo Tài Xỉu hiện tại."),
  async execute(interaction) {
    const roomConfig = getRoomConfig(interaction.channelId);
    if (!roomConfig) {
      await interaction.reply("Phòng này chưa được cấu hình là phòng Tài Xỉu.");
      return;
    }

    const session = getSessionStatus(interaction.channelId);
    if (!session) {
      await interaction.reply("Phòng này đã bật Tài Xỉu nhưng hiện chưa có kèo nào đang mở.");
      return;
    }

    await interaction.reply({
      embeds: [buildStatusEmbed(session, "Đây là trạng thái hiện tại của kèo.")]
    });
  }
};
