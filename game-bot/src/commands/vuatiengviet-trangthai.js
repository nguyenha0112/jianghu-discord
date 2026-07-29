const { SlashCommandBuilder } = require("discord.js");
const { buildStatusEmbed, getRoomConfig, getSessionStatus } = require("../services/vietnamese-king-service");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("vuatiengviet-trangthai")
    .setDescription("Xem trang thai van Vua Tieng Viet hien tai."),
  async execute(interaction) {
    const roomConfig = getRoomConfig(interaction.channelId);
    if (!roomConfig) {
      await interaction.reply("Phòng này chưa được cấu hình là phòng Vua Tiếng Việt.");
      return;
    }

    const session = getSessionStatus(interaction.channelId);
    if (!session) {
      await interaction.reply("Phòng này đã bật Vua Tiếng Việt nhưng hiện chưa có ván nào đang chạy. Nhắn `!play` để mở ván mới ngay.");
      return;
    }

    await interaction.reply({
      embeds: [buildStatusEmbed(session, "Đây là trạng thái hiện tại của ván.")]
    });
  }
};
