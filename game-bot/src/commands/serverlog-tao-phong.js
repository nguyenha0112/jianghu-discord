const { SlashCommandBuilder } = require("discord.js");
const { assertCanManageGameRoom } = require("../lib/room-admin");
const { enableRoom } = require("../storage/serverlog-room-store");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("serverlog-tao-phong")
    .setDescription("Thiết lập kênh hiện tại làm phòng thông báo người rời server."),
  async execute(interaction) {
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true });
      }

      assertCanManageGameRoom(interaction);
      enableRoom(interaction.guildId, {
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        channelName: interaction.channel?.name || "unknown",
        createdByUserId: interaction.user.id,
        createdByUsername: interaction.user.username
      });

      await interaction.editReply(`Đã đặt <#${interaction.channelId}> làm phòng server log. Khi có người rời server, bot sẽ gửi avatar, level thông tin cơ bản và role cũ vào đây.`);
    } catch (error) {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: error.message });
      } else {
        await interaction.reply({ content: error.message, ephemeral: true });
      }
    }
  }
};
