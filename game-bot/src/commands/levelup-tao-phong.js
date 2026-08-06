const { SlashCommandBuilder } = require("discord.js");
const { assertCanManageGameRoom } = require("../lib/room-admin");
const { enableRoom } = require("../storage/levelup-room-store");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("levelup-tao-phong")
    .setDescription("Thiết lập kênh hiện tại thành phòng thông báo khi người chơi lên cấp."),
  async execute(interaction) {
    try {
      assertCanManageGameRoom(interaction);
      enableRoom(interaction.guildId, {
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        channelName: interaction.channel?.name || "unknown",
        createdByUserId: interaction.user.id,
        createdByUsername: interaction.user.username
      });

      await interaction.reply({
        content: `Đã đặt <#${interaction.channelId}> làm phòng thông báo level-up. Khi người chơi lên cấp, bot sẽ gửi avatar + cấp mới vào đây.`,
        ephemeral: true
      });
    } catch (error) {
      await interaction.reply({ content: error.message, ephemeral: true }).catch(() => {});
    }
  }
};
