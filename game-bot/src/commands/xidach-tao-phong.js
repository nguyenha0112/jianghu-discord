const { SlashCommandBuilder } = require("discord.js");
const { assertCanManageGameRoom } = require("../lib/room-admin");
const { enableRoom } = require("../storage/xidach-room-store");
const { buildRoomGuideText } = require("../services/xidach-service");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("xidach-tao-phong")
    .setDescription("Bật kênh hiện tại thành phòng chơi Xì Dách."),
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
        const nextTopic = "Xì Dách | !play mở bảng cược | có nút nhập tiền | Rút/Dừng để chơi | !stop hủy";
        await interaction.channel.setTopic(nextTopic).catch(() => {});
      }

      await interaction.editReply("Đã bật kênh này thành phòng chơi Xì Dách.");
      await interaction.channel.send({
        embeds: [
          {
            color: 0x8e44ad,
            title: "Hướng dẫn phòng Xì Dách",
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
