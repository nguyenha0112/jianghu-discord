const { SlashCommandBuilder } = require("discord.js");
const { awardMonthlyReward } = require("../services/monthly-reward-service");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("admin-monthly-award")
    .setDescription("Ghi nhan thuong thang cho mot player.")
    .addStringOption((option) =>
      option
        .setName("user_id")
        .setDescription("Discord user ID cua player")
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
      const userId = interaction.options.getString("user_id", true);
      const note = interaction.options.getString("ghi_chu") || "";
      const result = await awardMonthlyReward(interaction.user.id, userId, note);

      if (!result.ok) {
        await interaction.reply({ content: result.message, ephemeral: true });
        return;
      }

      await interaction.reply({
        content: `Da ghi nhan thuong thang ky ${result.periodId} cho <@${result.rewardEntry.userId}>. Thuong MVP: 💎 ${result.rewardEntry.ngocReward} Ngoc. So du hien tai: 💎 ${result.balance} Ngoc.`,
        ephemeral: true
      });
    } catch (error) {
      await interaction.reply({ content: error.message, ephemeral: true });
    }
  }
};
