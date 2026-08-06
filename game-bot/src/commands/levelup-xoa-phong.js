const { SlashCommandBuilder } = require("discord.js");
const { assertCanManageGameRoom } = require("../lib/room-admin");
const { disableRoom, getRoom } = require("../storage/levelup-room-store");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("levelup-xoa-phong")
    .setDescription("Tắt phòng thông báo level-up của máy chủ."),
  async execute(interaction) {
    try {
      assertCanManageGameRoom(interaction);
      const current = getRoom(interaction.guildId);
      if (!current) {
        await interaction.reply({ content: "Máy chủ này chưa có phòng thông báo level-up.", ephemeral: true });
        return;
      }
      disableRoom(interaction.guildId);
      await interaction.reply({ content: "Đã tắt phòng thông báo level-up.", ephemeral: true });
    } catch (error) {
      await interaction.reply({ content: error.message, ephemeral: true }).catch(() => {});
    }
  }
};
