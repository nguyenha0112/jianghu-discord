const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const { awardMonthlyReward } = require("../services/monthly-reward-service");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("admin-monthly-award")
    .setDescription("Ghi nhan thuong thang cho mot player.")
    .addUserOption((option) =>
      option
        .setName("nguoi_choi")
        .setDescription("Chon nguoi choi duoc thuong")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("ghi_chu")
        .setDescription("Ghi chu xet thuong")
        .setRequired(false)
    ),
  async execute(interaction) {
    try {
      const targetUser = interaction.options.getUser("nguoi_choi", true);
      const note = interaction.options.getString("ghi_chu") || "";
      const result = await awardMonthlyReward(interaction.user.id, targetUser.id, note);

      if (!result.ok) {
        await interaction.reply({ content: result.message, ephemeral: true });
        return;
      }

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xf1c40f)
            .setTitle("🏆 Đã Ghi Nhận Thưởng Tháng")
            .setDescription(`Đã ghi nhận thưởng tháng kỳ **${result.periodId}** cho <@${result.rewardEntry.userId}>.`)
            .addFields(
              { name: "Thưởng MVP", value: `💎 ${result.rewardEntry.ngocReward} Ngọc`, inline: true },
              { name: "Số dư hiện tại", value: `💎 ${result.balance} Ngọc`, inline: true },
              { name: "Ghi chú", value: note || "Không có", inline: false }
            )
        ],
        ephemeral: true
      });
    } catch (error) {
      await interaction.reply({ content: error.message, ephemeral: true });
    }
  }
};
