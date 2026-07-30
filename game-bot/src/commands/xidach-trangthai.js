const { SlashCommandBuilder } = require("discord.js");
const { buildStatusEmbed, buildVisualAttachments, getRoomConfig, getSessionStatus } = require("../services/xidach-service");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("xidach-trangthai")
    .setDescription("Xem trang thai van Xi Dach hien tai."),
  async execute(interaction) {
    const roomConfig = getRoomConfig(interaction.channelId);
    if (!roomConfig) {
      await interaction.reply("Phong nay chua duoc cau hinh la phong Xi Dach.");
      return;
    }

    const session = getSessionStatus(interaction.channelId);
    if (!session) {
      await interaction.reply("Phong nay da bat Xi Dach nhung hien chua co van nao dang chay.");
      return;
    }

    await interaction.reply({
      embeds: [buildStatusEmbed(session, "Day la trang thai hien tai cua van Xi Dach.")],
      files: buildVisualAttachments(session)
    });
  }
};
