const { SlashCommandBuilder } = require("discord.js");
const { doWork } = require("../services/game-service");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("work")
    .setDescription("Thực hiện hành động nghề nghiệp để nhận thưởng."),
  async execute(interaction) {
    const result = doWork(interaction.user.id, interaction.user.username);
    if (!result.ok) {
      await interaction.reply(result.message);
      return;
    }

    await interaction.reply(
      [
        result.profession.rewardText,
        `+${result.reward.xuGain} Xu`,
        `+${result.reward.quantity} ${result.reward.itemName}`,
        `+${result.reward.xpGain} XP nghề`,
        `+${result.reward.playerXpGain} Player XP`
      ].join("\n")
    );
  }
};
