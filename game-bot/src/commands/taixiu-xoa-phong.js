const { SlashCommandBuilder } = require("discord.js");
const { assertCanManageGameRoom } = require("../lib/room-admin");
const { disableRoom, isEnabledRoom } = require("../storage/taixiu-room-store");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("taixiu-xoa-phong")
    .setDescription("Tắt chế độ phòng chơi Tài Xỉu ở kênh hiện tại."),
  async execute(interaction) {
    try {
      assertCanManageGameRoom(interaction);

      if (!isEnabledRoom(interaction.channelId)) {
        await interaction.reply("Phòng này hiện chưa được bật chế độ Tài Xỉu.");
        return;
      }

      disableRoom(interaction.channelId);
      await interaction.reply("Đã tắt chế độ phòng Tài Xỉu ở kênh này.");
    } catch (error) {
      await interaction.reply({ content: error.message, ephemeral: true });
    }
  }
};
