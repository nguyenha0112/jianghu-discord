const { SlashCommandBuilder } = require("discord.js");
const { assertCanManageGameRoom } = require("../lib/room-admin");
const { disableRoom, isEnabledRoom } = require("../storage/word-chain-room-store");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("noitu-xoa-phong")
    .setDescription("Tắt chế độ phòng chơi nối từ ở channel hiện tại."),
  async execute(interaction) {
    try {
      assertCanManageGameRoom(interaction);

      if (!isEnabledRoom(interaction.channelId)) {
        await interaction.reply("Phòng này hiện chưa được bật chế độ nối từ.");
        return;
      }

      disableRoom(interaction.channelId);
      await interaction.reply("Đã tắt chế độ phòng nối từ ở channel này.");
    } catch (error) {
      await interaction.reply({ content: error.message, ephemeral: true });
    }
  }
};
