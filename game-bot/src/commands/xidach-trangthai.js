const { SlashCommandBuilder } = require("discord.js");
const { buildStatusEmbed, getRoomConfig, getSessionStatus } = require("../services/xidach-service");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("xidach-trangthai")
    .setDescription("Xem trạng thái ván Xì Dách hiện tại."),
  async execute(interaction) {
    const roomConfig = getRoomConfig(interaction.channelId);
    if (!roomConfig) {
      await interaction.reply("Phòng này chưa được cấu hình là phòng Xì Dách.");
      return;
    }

    const session = getSessionStatus(interaction.channelId);
    if (!session) {
      await interaction.reply("Phòng này đã bật Xì Dách nhưng hiện chưa có ván nào đang chạy.");
      return;
    }

    await interaction.reply({
      embeds: [buildStatusEmbed(session, "Đây là trạng thái hiện tại của ván Xì Dách.")]
    });
  }
};
