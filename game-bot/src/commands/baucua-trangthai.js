const { SlashCommandBuilder } = require("discord.js");
const { buildStatusEmbed, getRoomConfig, getSessionStatus } = require("../services/baucua-service");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("baucua-trangthai")
    .setDescription("Xem trạng thái kèo Bầu Cua hiện tại."),
  async execute(interaction) {
    const roomConfig = getRoomConfig(interaction.channelId);
    if (!roomConfig) {
      await interaction.reply("Phòng này chưa được cấu hình là phòng Bầu Cua.");
      return;
    }

    const session = getSessionStatus(interaction.channelId);
    if (!session) {
      await interaction.reply("Phòng này đã bật Bầu Cua nhưng hiện chưa có kèo nào đang mở.");
      return;
    }

    await interaction.reply({
      embeds: [buildStatusEmbed(session, "Đây là trạng thái hiện tại của kèo Bầu Cua.")]
    });
  }
};
