const { SlashCommandBuilder } = require("discord.js");
const { startSession } = require("../services/word-chain-service");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("noitu-tao")
    .setDescription("Tao mot van noi tu trong channel hien tai.")
    .addStringOption((option) =>
      option
        .setName("tu_goi_y")
        .setDescription("Cum tu mo dau neu ban muon tu chon")
        .setRequired(false)
    ),
  async execute(interaction) {
    const seedPhrase = interaction.options.getString("tu_goi_y");
    const session = startSession({
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      channelName: interaction.channel?.name || "unknown",
      hostUserId: interaction.user.id,
      hostUsername: interaction.user.username,
      seedPhrase
    });

    await interaction.reply(
      [
        "Da tao van noi tu moi.",
        `Cum tu mo dau: "${session.seedPhrase}"`,
        `Tu tiep theo phai bat dau bang "${session.requiredToken}".`,
        "Tu gio moi nguoi cu gui tin nhan thuong trong channel nay de noi tu."
      ].join("\n")
    );
  }
};
