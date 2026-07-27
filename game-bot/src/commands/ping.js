const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Kiểm tra bot có đang online không."),
  async execute(interaction) {
    await interaction.reply("Pong. Jianghu Game Bot đang online.");
  }
};
