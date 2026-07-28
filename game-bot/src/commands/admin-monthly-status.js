const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const { getMonthlyRewardStatus } = require("../services/monthly-reward-service");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("admin-monthly-status")
    .setDescription("Xem trang thai xet thuong thang hien tai."),
  async execute(interaction) {
    try {
      const result = await getMonthlyRewardStatus(interaction.user.id);
      const snapshotText =
        result.snapshot.length === 0
          ? "Chua co ung vien."
          : result.snapshot.map((entry, index) => `${index + 1}. <@${entry.userId}> - ${entry.score} diem`).join("\n");
      const rewardsText =
        result.rewards.length === 0
          ? "Chua co ai duoc xet."
          : result.rewards.map((entry) => `<@${entry.userId}> - 💎 ${entry.ngocReward} Ngoc - ${entry.rewardType}`).join("\n");

      const embed = new EmbedBuilder()
        .setColor(0xe67e22)
        .setTitle(`Admin Monthly Reward - ${result.periodId}`)
        .addFields(
          { name: "Trang thai", value: result.status, inline: true },
          { name: "So ung vien", value: String(result.snapshot.length), inline: true },
          { name: "So da xet", value: String(result.rewards.length), inline: true },
          { name: "Top ung vien", value: snapshotText.slice(0, 1024), inline: false },
          { name: "Da trao", value: rewardsText.slice(0, 1024), inline: false }
        );

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      await interaction.reply({ content: error.message, ephemeral: true });
    }
  }
};
