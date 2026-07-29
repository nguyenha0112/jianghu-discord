const { SlashCommandBuilder } = require("discord.js");
const { assertCanManageGameRoom } = require("../lib/room-admin");
const { enableRoom } = require("../storage/vietnamese-king-room-store");
const { buildRoomGuideText } = require("../services/vietnamese-king-service");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("vuatiengviet-tao-phong")
    .setDescription("Bật kênh hiện tại thành phòng chơi Vua Tiếng Việt."),
  async execute(interaction) {
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true });
      }

      assertCanManageGameRoom(interaction);

      enableRoom(interaction.channelId, {
        guildId: interaction.guildId,
        channelName: interaction.channel?.name || "unknown",
        createdByUserId: interaction.user.id,
        createdByUsername: interaction.user.username
      });

      if (interaction.channel && "setTopic" in interaction.channel && typeof interaction.channel.setTopic === "function") {
        const nextTopic = "Vua Tiếng Việt | !play mở ván | !goiy xem gợi ý | !trangthai xem bảng | !stop kết thúc";
        await interaction.channel.setTopic(nextTopic).catch(() => {});
      }

      await interaction.editReply("Đã bật kênh này thành phòng chơi Vua Tiếng Việt.");
      await interaction.channel.send({
        embeds: [
          {
            color: 0xf1c40f,
            title: "Hướng dẫn phòng Vua Tiếng Việt",
            description: buildRoomGuideText()
          }
        ]
      });
    } catch (error) {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: error.message });
      } else {
        await interaction.reply({ content: error.message, ephemeral: true });
      }
    }
  }
};
