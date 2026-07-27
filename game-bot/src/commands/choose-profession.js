const { SlashCommandBuilder } = require("discord.js");
const { chooseProfession } = require("../services/game-service");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("choose-profession")
    .setDescription("Chon nghe nghiep chinh cua ban.")
    .addStringOption((option) =>
      option
        .setName("profession")
        .setDescription("Nghe ban muon theo")
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
    const player = await chooseProfession(interaction.user.id, interaction.user.username, professionId);
    await interaction.reply(
      `Ban da chon nghe ${player.profession.current}. Day se la huong farm chinh cua ban trong Jianghu.`
    );
  }
};
