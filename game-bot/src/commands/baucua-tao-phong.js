const { SlashCommandBuilder } = require("discord.js");
const { assertCanManageGameRoom } = require("../lib/room-admin");
const { enableRoom } = require("../storage/baucua-room-store");
const { buildRoomGuideText } = require("../services/baucua-service");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("baucua-tao-phong")
    .setDescription("Bật kênh hiện tại thành phòng chơi Bầu Cua."),
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
        const nextTopic = "Bầu Cua | !play mở kèo | bấm nút để đặt cược | !trangthai xem bảng | !chot lắc";
        await interaction.channel.setTopic(nextTopic).catch(() => {});
      }

      await interaction.editReply("Đã bật kênh này thành phòng chơi Bầu Cua.");
      await interaction.channel.send({
        embeds: [
          {
            color: 0x27ae60,
            title: "Hướng dẫn phòng Bầu Cua",
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
