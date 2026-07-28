const { SlashCommandBuilder } = require("discord.js");
const { assertCanManageGameRoom } = require("../lib/room-admin");
const { enableRoom } = require("../storage/taixiu-room-store");
const { buildRoomGuideText } = require("../services/taixiu-service");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("taixiu-tao-phong")
    .setDescription("Bật kênh hiện tại thành phòng chơi Tài Xỉu."),
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
        const nextTopic = "Tài Xỉu | !play mở kèo | !tai 100 / !xiu 100 đặt cược | !trangthai xem bảng | !chot lắc";
        await interaction.channel.setTopic(nextTopic).catch(() => {});
      }

      await interaction.reply("Đã bật kênh này thành phòng chơi Tài Xỉu.");
      await interaction.channel.send({
        embeds: [
          {
            color: 0xe67e22,
            title: "Hướng dẫn phòng Tài Xỉu",
            description: buildRoomGuideText()
          }
        ]
      });
    } catch (error) {
      await interaction.reply({ content: error.message, ephemeral: true });
    }
  }
};
