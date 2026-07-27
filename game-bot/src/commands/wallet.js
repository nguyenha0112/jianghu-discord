const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const { getWalletSummary } = require("../services/game-service");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("wallet")
    .setDescription("Xem tổng quan tiền tệ và chỉ số kinh tế của bạn."),
  async execute(interaction) {
    const summary = getWalletSummary(interaction.user.id, interaction.user.username);

    const embed = new EmbedBuilder()
      .setTitle(`${interaction.user.username} - Wallet`)
      .addFields(
        { name: "Xu", value: String(summary.wallet.xu), inline: true },
        { name: "Ngọc", value: String(summary.wallet.ngoc), inline: true },
        { name: "Player Level", value: String(summary.stats.playerLevel), inline: true },
        { name: "Player XP", value: String(summary.stats.playerXp), inline: true },
        { name: "Tổng Xu đã kiếm", value: String(summary.stats.totalXuEarned), inline: true },
        { name: "Tổng Ngọc đã kiếm", value: String(summary.stats.totalNgocEarned), inline: true },
        { name: "Lần đi làm", value: String(summary.stats.totalWorkActions), inline: true },
        { name: "Vật phẩm đã bán", value: String(summary.stats.totalItemsSold), inline: true }
      )
      .setFooter({
        text: `${summary.currencies.xu.description} | ${summary.currencies.ngoc.description}`
      });

    await interaction.reply({ embeds: [embed] });
  }
};
