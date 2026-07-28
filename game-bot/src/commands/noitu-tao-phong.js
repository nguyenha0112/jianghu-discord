const { SlashCommandBuilder } = require("discord.js");
const { assertCanManageGameRoom } = require("../lib/room-admin");
const { enableRoom } = require("../storage/word-chain-room-store");
const { buildRoomGuideText } = require("../services/word-chain-service");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("noitu-tao-phong")
    .setDescription("Bật kênh hiện tại thành phòng chơi nối từ.")
    .addStringOption((option) =>
      option
        .setName("che_do")
        .setDescription("Chọn chế độ chơi cho phòng này")
        .setRequired(true)
        .addChoices(
          { name: "PvP", value: "pvp" },
          { name: "PvE", value: "pve" }
        )
    ),
  async execute(interaction) {
    try {
      assertCanManageGameRoom(interaction);
      const mode = interaction.options.getString("che_do", true);

      enableRoom(interaction.channelId, {
        guildId: interaction.guildId,
        channelName: interaction.channel?.name || "unknown",
        mode,
        createdByUserId: interaction.user.id,
        createdByUsername: interaction.user.username
      });

      if (interaction.channel && "setTopic" in interaction.channel && typeof interaction.channel.setTopic === "function") {
        const nextTopic = `Nối Từ ${mode.toUpperCase()} | !play mở ván | !trangthai xem bảng | !stop kết thúc | !help xem luật`;
        await interaction.channel.setTopic(nextTopic).catch(() => {});
      }

      await interaction.reply(`Đã bật kênh này thành phòng chơi nối từ ${mode.toUpperCase()}.`);
      await interaction.channel.send({
        embeds: [
          {
            color: 0x3498db,
            title: "Hướng dẫn phòng nối từ",
            description: buildRoomGuideText(mode)
          }
        ]
      });
    } catch (error) {
      await interaction.reply({ content: error.message, ephemeral: true });
    }
  }
};
