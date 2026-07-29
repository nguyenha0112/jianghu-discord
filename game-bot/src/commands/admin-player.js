const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const { getAdminPlayerView } = require("../services/admin-service");

function formatNumber(value) {
  return new Intl.NumberFormat("vi-VN").format(Number(value || 0));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("admin-player")
    .setDescription("Xem thong tin chi tiet cua mot player.")
    .addUserOption((option) =>
      option
        .setName("nguoi_choi")
        .setDescription("Chon nguoi choi can xem")
        .setRequired(true)
    ),
  async execute(interaction) {
    try {
      const targetUser = interaction.options.getUser("nguoi_choi", true);
      const result = await getAdminPlayerView(interaction.user.id, targetUser.id);

      if (!result.ok) {
        await interaction.reply({ content: result.message, ephemeral: true });
        return;
      }

      const player = result.player;
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`Admin Player • ${player.username}`)
        .setDescription(`Thông tin quản trị nhanh của <@${player.userId}>`)
        .addFields(
          { name: "User ID", value: player.userId, inline: false },
          { name: "🪙 Xu", value: formatNumber(player.wallet.xu), inline: true },
          { name: "💎 Ngọc", value: formatNumber(player.wallet.ngoc), inline: true },
          { name: "⭐ Player Level", value: String(player.stats.playerLevel), inline: true },
          { name: "Nghề chính", value: player.profession.current || "Chưa chọn", inline: true },
          { name: "XP nghề", value: formatNumber(player.profession.xp), inline: true },
          { name: "Loại item", value: formatNumber(Object.keys(player.inventory).length), inline: true }
        );

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      await interaction.reply({ content: error.message, ephemeral: true });
    }
  }
};
