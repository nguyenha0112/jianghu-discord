const { SlashCommandBuilder } = require("discord.js");
const { chooseProfession } = require("../services/game-service");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("choose-profession")
    .setDescription("Chọn nghề nghiệp chính của bạn.")
    .addStringOption((option) =>
      option
        .setName("profession")
        .setDescription("Nghề bạn muốn theo")
        .setRequired(true)
        .addChoices(
          { name: "Fishing", value: "fishing" },
          { name: "Mining", value: "mining" },
          { name: "Gathering", value: "gathering" },
          { name: "Alchemy", value: "alchemy" },
          { name: "Archaeology", value: "archaeology" }
        )
    ),
  async execute(interaction) {
    const professionId = interaction.options.getString("profession", true);
    const player = chooseProfession(interaction.user.id, interaction.user.username, professionId);
    await interaction.reply(
      `Bạn đã chọn nghề ${player.profession.current}. Đây sẽ là hướng farm chính của bạn trong Jianghu.`
    );
  }
};
