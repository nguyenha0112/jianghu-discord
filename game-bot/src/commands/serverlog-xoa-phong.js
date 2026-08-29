const { SlashCommandBuilder } = require("discord.js");
const { assertCanManageGameRoom } = require("../lib/room-admin");
const { disableRoom, getRoom } = require("../storage/serverlog-room-store");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("serverlog-xoa-phong")
    .setDescription("Tắt phòng thông báo người rời server."),
  async execute(interaction) {
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true });
      }

      assertCanManageGameRoom(interaction);
      const current = getRoom(interaction.guildId);
      if (!current) {
        await interaction.editReply("Máy chủ này chưa có phòng server log.");
        return;
      }

      disableRoom(interaction.guildId);
      await interaction.editReply("Đã tắt phòng server log.");
    } catch (error) {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: error.message });
      } else {
        await interaction.reply({ content: error.message, ephemeral: true });
      }
    }
  }
};
