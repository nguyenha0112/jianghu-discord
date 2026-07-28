const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const { getMonthlyLeaderboardView } = require("../services/monthly-reward-service");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("monthly")
    .setDescription("Xem bang ung vien thuong thang hien tai."),
  async execute(interaction) {
    const result = await getMonthlyLeaderboardView(interaction.user.id);
    const lines =
      result.top.length === 0
        ? "Chua co du lieu xep hang thang."
        : result.top.map((entry, index) => `${index + 1}. <@${entry.userId}> - ${entry.score} diem`).join("\n");

    const currentUserLine = result.currentUser
      ? `Ban dang co **${result.currentUser.score} diem** trong ky ${result.periodId}.`
      : "Ban chua co diem xet thuong thang trong ky nay.";

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle(`Thuong Thang - Ky ${result.periodId}`)
      .setDescription(lines)
      .addFields(
        { name: "Thong tin", value: result.rewardNote, inline: false },
        { name: "Tien do cua ban", value: currentUserLine, inline: false }
      );

    await interaction.reply({ embeds: [embed] });
  }
};
