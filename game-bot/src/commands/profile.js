const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const { getProfile } = require("../services/game-service");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Xem hồ sơ Jianghu của bạn."),
  async execute(interaction) {
    const player = getProfile(interaction.user.id, interaction.user.username);
    const currentProfession = player.profession.current || "Chưa chọn";
    const currentLevel = player.profession.current
      ? player.profession.levels[player.profession.current] || 1
      : 0;

    const embed = new EmbedBuilder()
      .setTitle(`${interaction.user.username} - Hồ sơ Jianghu`)
      .addFields(
        { name: "Player Level", value: String(player.stats.playerLevel), inline: true },
        { name: "Player XP", value: String(player.stats.playerXp), inline: true },
        { name: "Xu", value: String(player.wallet.xu), inline: true },
        { name: "Ngọc", value: String(player.wallet.ngoc), inline: true },
        { name: "Nghề hiện tại", value: currentProfession, inline: true },
        { name: "Cấp nghề", value: String(currentLevel), inline: true },
        { name: "XP nghề", value: String(player.profession.xp), inline: true },
        { name: "Số loại vật phẩm", value: String(Object.keys(player.inventory).length), inline: true }
      );

    await interaction.reply({ embeds: [embed] });
  }
};
