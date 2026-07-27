const { SlashCommandBuilder } = require("discord.js");
const { assertCanManageGameRoom } = require("../lib/room-admin");
const { enableRoom } = require("../storage/word-chain-room-store");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("noitu-tao-phong")
    .setDescription("Bật kênh hiện tại thành phòng chơi nối từ."),
  async execute(interaction) {
    try {
      assertCanManageGameRoom(interaction);
      enableRoom(interaction.channelId, {
        guildId: interaction.guildId,
        channelName: interaction.channel?.name || "unknown",
        createdByUserId: interaction.user.id,
        createdByUsername: interaction.user.username
      });

      await interaction.reply(
        [
          "Đã bật kênh này thành phòng chơi nối từ.",
          "Người chơi có thể dùng `/noitu-tao` để bắt đầu ván.",
          "Trong lúc chơi có thể gõ `!stop` để tạm dừng và `!play` để tiếp tục."
        ].join("\n")
      );
    } catch (error) {
      await interaction.reply({ content: error.message, ephemeral: true });
    }
  }
};
