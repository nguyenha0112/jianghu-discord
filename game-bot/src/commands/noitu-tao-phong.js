const { SlashCommandBuilder } = require("discord.js");
const { assertCanManageGameRoom } = require("../lib/room-admin");
const { enableRoom } = require("../storage/word-chain-room-store");
const { buildRoomGuideText } = require("../services/word-chain-service");

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

      if (interaction.channel && "setTopic" in interaction.channel && typeof interaction.channel.setTopic === "function") {
        const nextTopic = "Phong noi tu: !batdau de mo van, !stop de tam dung, !play de tiep tuc.";
        await interaction.channel.setTopic(nextTopic).catch(() => {});
      }

      await interaction.reply("Đã bật kênh này thành phòng chơi nối từ.");
      await interaction.channel.send({
        embeds: [
          {
            color: 0x3498db,
            title: "Hướng dẫn phòng nối từ",
            description: buildRoomGuideText()
          }
        ]
      });
    } catch (error) {
      await interaction.reply({ content: error.message, ephemeral: true });
    }
  }
};
