const { SlashCommandBuilder } = require("discord.js");
const { stopSession } = require("../services/word-chain-service");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("noitu-dung")
    .setDescription("Dung van noi tu hien tai."),
  async execute(interaction) {
    const session = stopSession(interaction.channelId);

    if (!session) {
      await interaction.reply("Khong co van noi tu nao de dung.");
      return;
    }

    const scoreboard =
      session.scores.size === 0
        ? "Chua co ai ghi diem."
        : [...session.scores.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([userId, score]) => `<@${userId}>: ${score}`)
            .join("\n");

    await interaction.reply(
      [
        "Da dung van noi tu.",
        `Tong so luot hop le: ${session.moveCount}`,
        `Bang diem:\n${scoreboard}`
      ].join("\n")
    );
  }
};
