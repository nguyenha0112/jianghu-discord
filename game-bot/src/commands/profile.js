const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const { getProfile } = require("../services/game-service");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Xem profile Jianghu cua ban."),
  async execute(interaction) {
    const player = getProfile(interaction.user.id, interaction.user.username);
    const currentProfession = player.profession.current || "Chua chon";
    const currentLevel = player.profession.current
      ? player.profession.levels[player.profession.current] || 1
      : 0;

    const embed = new EmbedBuilder()
      .setTitle(`${interaction.user.username} - Jianghu Profile`)
      .addFields(
        { name: "Xu", value: String(player.wallet.xu), inline: true },
        { name: "Ngoc", value: String(player.wallet.ngoc), inline: true },
        { name: "Nghe hien tai", value: currentProfession, inline: true },
        { name: "Cap nghe", value: String(currentLevel), inline: true },
        { name: "XP nghe", value: String(player.profession.xp), inline: true },
        { name: "So loai vat pham", value: String(Object.keys(player.inventory).length), inline: true }
      );

    await interaction.reply({ embeds: [embed] });
  }
};
