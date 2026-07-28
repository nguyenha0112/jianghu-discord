const { SlashCommandBuilder } = require("discord.js");
const { buildStatusEmbed, getRoomConfig, getSessionStatus } = require("../services/vietnamese-king-service");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("vuatiengviet-trangthai")
    .setDescription("Xem trạng thái ván Vua Tiếng Việt hiện tại."),
  async execute(interaction) {
    const roomConfig = getRoomConfig(interaction.channelId);
    if (!roomConfig) {
      await interaction.reply("Phòng này chưa được cấu hình là phòng Vua Tiếng Việt.");
      return;
    }

    const session = getSessionStatus(interaction.channelId);
    if (!session) {
      await interaction.reply("Phòng này đã bật Vua Tiếng Việt nhưng hiện chưa có ván nào đang chạy.");
      return;
    }

    await interaction.reply({
      embeds: [buildStatusEmbed(session, "Đây là trạng thái hiện tại của ván.")]
    });
  }
};
