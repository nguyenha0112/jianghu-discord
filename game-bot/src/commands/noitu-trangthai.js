const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const { getSessionStatus } = require("../services/word-chain-service");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("noitu-trangthai")
    .setDescription("Xem trang thai van noi tu hien tai."),
  async execute(interaction) {
    const session = getSessionStatus(interaction.channelId);

    if (!session) {
      await interaction.reply("Channel nay hien chua co van noi tu nao dang chay.");
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("Trang thai Noi Tu")
      .addFields(
        { name: "Chu phong", value: session.hostUsername, inline: true },
        { name: "Cum tu hien tai", value: session.currentPhrase, inline: false },
        { name: "Tu can noi tiep", value: session.requiredToken, inline: true },
        { name: "So luot hop le", value: String(session.moveCount), inline: true },
        {
          name: "Bang diem",
          value: session.scoreboard.length > 0 ? session.scoreboard.join("\n") : "Chua co diem.",
          inline: false
        }
      );

    await interaction.reply({ embeds: [embed] });
  }
};
