const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const { getWalletSummary } = require("../services/game-service");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("wallet")
    .setDescription("Xem tong quan tien te va chi so kinh te cua ban."),
  async execute(interaction) {
    const summary = await getWalletSummary(interaction.user.id, interaction.user.username);

    const embed = new EmbedBuilder()
      .setTitle(`${interaction.user.username} - Wallet`)
      .addFields(
        { name: "Xu", value: String(summary.wallet.xu), inline: true },
        { name: "Ngoc", value: String(summary.wallet.ngoc), inline: true },
        { name: "Player Level", value: String(summary.stats.playerLevel), inline: true },
        { name: "Player XP", value: String(summary.stats.playerXp), inline: true },
        { name: "Tong Xu da kiem", value: String(summary.stats.totalXuEarned), inline: true },
        { name: "Tong Ngoc da kiem", value: String(summary.stats.totalNgocEarned), inline: true },
        { name: "Lan di lam", value: String(summary.stats.totalWorkActions), inline: true },
        { name: "Vat pham da ban", value: String(summary.stats.totalItemsSold), inline: true }
      )
      .setFooter({
        text: `${summary.currencies.xu.description} | ${summary.currencies.ngoc.description}`
      });

    await interaction.reply({ embeds: [embed] });
  }
};
