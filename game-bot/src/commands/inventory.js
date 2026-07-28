const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const { getInventoryLines } = require("../services/game-service");
const { emojiToTwemojiUrl } = require("../lib/ui-theme");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("inventory")
    .setDescription("Xem tui do hien tai cua ban."),
  async execute(interaction) {
    const lines = await getInventoryLines(interaction.user.id, interaction.user.username);
    const embed = new EmbedBuilder()
      .setColor(0x16a085)
      .setTitle(`🎒 ${interaction.user.username} • Túi Đồ`)
      .setThumbnail(emojiToTwemojiUrl("🎒"))
      .setDescription(lines.join("\n"))
      .setFooter({ text: "Vật phẩm hiếm hơn sẽ hữu ích cho craft, đột phá và giao dịch." });

    await interaction.reply({ embeds: [embed] });
  }
};
