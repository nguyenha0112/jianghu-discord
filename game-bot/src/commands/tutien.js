const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const { getCultivationOverview } = require("../services/game-service");
const {
  buildProgressBar,
  emojiToTwemojiUrl,
  getProfessionTheme,
  getRealmTheme
} = require("../lib/ui-theme");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("tutien")
    .setDescription("Xem tổng quan tu tiên, đạo tu và tiến độ đột phá."),
  async execute(interaction) {
    const overview = await getCultivationOverview(interaction.user.id, interaction.user.username);
    const realmTheme = getRealmTheme(overview.currentRealm.key);
    const activeProfessionTheme = getProfessionTheme(overview.player.profession.current);

    const professionLines = overview.professionEntries
      .sort((left, right) => right.level - left.level)
      .map((entry) => {
        const theme = getProfessionTheme(entry.professionId);
        const marker = entry.isCurrent ? "• Đạo tu chính" : "• Đạo tu phụ";
        return `${theme.emoji} **${entry.name}** - Cấp **${entry.level}** ${entry.isCurrent ? marker : ""}`;
      })
      .join("\n");

    const nextStepLine = overview.nextRealm
      ? overview.canBreakthrough
        ? `Đã đủ điều kiện tiến lên **${overview.nextRealm.name}**. Dùng \`/dotpha\` để đột phá.`
        : `Cần đưa đạo tu chính lên cấp **${overview.currentRealm.levelCap}** để tiến vào **${overview.nextRealm.name}**.`
      : "Bạn đã chạm cảnh giới cao nhất hiện có trong bản build này.";

    const embed = new EmbedBuilder()
      .setColor(realmTheme.color)
      .setTitle(`${realmTheme.emoji} ${interaction.user.username} • Tổng Quan Tu Tiên`)
      .setThumbnail(emojiToTwemojiUrl(realmTheme.emoji))
      .setDescription(
        [
          `**Cảnh giới hiện tại:** ${realmTheme.name}`,
          `**Đạo tu chính:** ${activeProfessionTheme.emoji} ${overview.currentProfession?.name || "Chưa chọn"}`,
          `**Tiến độ tu vi:** \`${buildProgressBar(overview.player.stats.playerXp, 100)}\` ${overview.player.stats.playerXp}/100 XP`,
          `**Tiến độ đạo tu chính:** \`${buildProgressBar(overview.player.profession.xp, 100)}\` ${overview.player.profession.xp}/100 XP nghề`
        ].join("\n")
      )
      .addFields(
        {
          name: "Lộ Trình Cảnh Giới",
          value: [
            `Hiện tại: **${overview.currentRealm.name}**`,
            `Giới hạn cấp hiện tại: **${overview.currentRealm.levelCap}**`,
            `Cảnh giới kế: **${overview.nextRealm?.name || "Tối đa"}**`
          ].join("\n"),
          inline: true
        },
        {
          name: "Điều Kiện Đột Phá",
          value: [
            `Mốc cấp đạo tu: **${overview.currentRealm.levelCap}**`,
            `Tài nguyên cần: ${overview.breakthroughCostText}`,
            `Trạng thái: **${overview.canBreakthrough ? "Có thể đột phá" : "Chưa đủ điều kiện"}**`
          ].join("\n"),
          inline: true
        },
        {
          name: "Linh Căn Và Động Phủ",
          value: [
            `${overview.spiritRoot.emoji} **${overview.spiritRoot.name}**`,
            `Hợp với: **${getProfessionTheme(overview.spiritRoot.favoredProfession).name}**`,
            `${overview.dwelling.emoji} Động phủ: **${overview.dwelling.name}**`,
            `${overview.artifact ? `${overview.artifact.emoji} Pháp bảo: **${overview.artifact.name}**` : "Chưa trang bị pháp bảo"}`
          ].join("\n"),
          inline: true
        },
        {
          name: "Chỉ Số Chiến Đấu",
          value: [
            `HP: **${overview.combat.hp}**`,
            `Công: **${overview.combat.attack}**`,
            `Thủ: **${overview.combat.defense}**`,
            `Bạo kích: **${overview.combat.critRate}%**`,
            `Lực chiến: **${overview.combat.power}**`
          ].join("\n"),
          inline: true
        },
        {
          name: "Đạo Tu Và Nghề Nghiệp",
          value: professionLines || "Chưa có dữ liệu nghề.",
          inline: false
        },
        {
          name: "Bước Tiếp Theo",
          value: `${nextStepLine}\n${overview.nextDwelling ? `Có thể hướng tới động phủ **${overview.nextDwelling.name}** với chi phí: ${overview.dwellingUpgradeCostText}.` : "Động phủ hiện tại đã đạt cấp tối đa."}`,
          inline: false
        }
      )
      .setFooter({
        text: "Trong Jianghu, nghề nghiệp chính là đạo tu để farm tài nguyên, tăng cấp và mở khóa đột phá cảnh giới."
      });

    await interaction.reply({ embeds: [embed] });
  }
};
