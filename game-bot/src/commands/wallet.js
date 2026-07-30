const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const { getWalletSummary } = require("../services/game-service");
const { buildProgressBar } = require("../lib/ui-theme");
const { buildCurrencyPairAttachment } = require("../lib/currency-assets");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("wallet")
    .setDescription("Xem tong quan tien te va chi so kinh te cua ban."),
  async execute(interaction) {
    const summary = await getWalletSummary(interaction.user.id, interaction.user.username);
    const currencyAttachment = buildCurrencyPairAttachment();

    const embed = new EmbedBuilder()
      .setColor(0xf5b041)
      .setTitle(`Linh kho cua ${interaction.user.username}`)
      .setThumbnail("attachment://currencies.png")
      .setDescription(
        [
          `**Xu hien co:** ${summary.wallet.xu}`,
          `**Ngoc hien co:** ${summary.wallet.ngoc}`,
          `**Tien do tu vi:** \`${buildProgressBar(summary.stats.playerXp, 100)}\` ${summary.stats.playerXp}/100 XP`
        ].join("\n")
      )
      .addFields(
        { name: "Nhan vat", value: `Cap **${summary.stats.playerLevel}**\nXP hien tai **${summary.stats.playerXp}**`, inline: true },
        { name: "Tich luy", value: `Tong Xu **${summary.stats.totalXuEarned}**\nTong Ngoc **${summary.stats.totalNgocEarned}**`, inline: true },
        { name: "Hoat dong", value: `Di lam **${summary.stats.totalWorkActions}** lan\nDa ban **${summary.stats.totalItemsSold}** vat pham`, inline: true }
      )
      .setFooter({
        text: `${summary.currencies.xu.description} | ${summary.currencies.ngoc.description}`
      });

    await interaction.reply({ embeds: [embed], files: [currencyAttachment] });
  }
};
