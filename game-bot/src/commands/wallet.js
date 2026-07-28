const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const { getWalletSummary } = require("../services/game-service");
const { buildProgressBar, emojiToTwemojiUrl } = require("../lib/ui-theme");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("wallet")
    .setDescription("Xem tong quan tien te va chi so kinh te cua ban."),
  async execute(interaction) {
    const summary = await getWalletSummary(interaction.user.id, interaction.user.username);

    const embed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle(`🪙 ${interaction.user.username} • Linh Khố`)
      .setThumbnail(emojiToTwemojiUrl("🪙"))
      .setDescription(
        [
          `**Xu:** 🪙 **${summary.wallet.xu}**`,
          `**Ngọc:** 💎 **${summary.wallet.ngoc}**`,
          `**Tiến độ cấp nhân vật:** \`${buildProgressBar(summary.stats.playerXp, 100)}\` ${summary.stats.playerXp}/100 XP`
        ].join("\n")
      )
      .addFields(
        { name: "🧍 Nhân vật", value: `Level: **${summary.stats.playerLevel}**\nXP: **${summary.stats.playerXp}**`, inline: true },
        { name: "📈 Tích lũy", value: `Tổng Xu: **${summary.stats.totalXuEarned}**\nTổng Ngọc: **${summary.stats.totalNgocEarned}**`, inline: true },
        { name: "🛠️ Hoạt động", value: `Đi làm: **${summary.stats.totalWorkActions}**\nĐã bán: **${summary.stats.totalItemsSold}**`, inline: true }
      )
      .setFooter({
        text: `${summary.currencies.xu.description} | ${summary.currencies.ngoc.description}`
      });

    await interaction.reply({ embeds: [embed] });
  }
};
