const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const { getAdminPlayerView } = require("../services/admin-service");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("admin-player")
    .setDescription("Xem thong tin chi tiet cua mot player.")
    .addStringOption((option) =>
      option
        .setName("user_id")
        .setDescription("Discord user ID cua player")
        .setRequired(true)
    ),
  async execute(interaction) {
    try {
      const targetUserId = interaction.options.getString("user_id", true);
      const result = await getAdminPlayerView(interaction.user.id, targetUserId);

      if (!result.ok) {
        await interaction.reply({ content: result.message, ephemeral: true });
        return;
      }

      const player = result.player;
      const embed = new EmbedBuilder()
        .setTitle(`Admin Player - ${player.username}`)
        .addFields(
          { name: "User ID", value: player.userId, inline: false },
          { name: "Xu", value: String(player.wallet.xu), inline: true },
          { name: "Ngoc", value: String(player.wallet.ngoc), inline: true },
          { name: "Player Level", value: String(player.stats.playerLevel), inline: true },
          { name: "Nghe", value: player.profession.current || "Chua chon", inline: true },
          { name: "XP nghe", value: String(player.profession.xp), inline: true },
          { name: "Loai item", value: String(Object.keys(player.inventory).length), inline: true }
        );

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      await interaction.reply({ content: error.message, ephemeral: true });
    }
  }
};
