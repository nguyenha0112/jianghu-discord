const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Kiem tra bot co dang online khong."),
  async execute(interaction) {
    await interaction.reply("Pong. Jianghu Game Bot dang online.");
  }
};
