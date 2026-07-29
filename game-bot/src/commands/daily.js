const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const { claimDaily } = require("../services/game-service");
const { buildCuteLevelField, emojiToTwemojiUrl } = require("../lib/ui-theme");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("daily")
    .setDescription("Nhan daily hang ngay."),
  async execute(interaction) {
    const result = await claimDaily(interaction.user.id, interaction.user.username);
    if (!result.ok) {
      await interaction.reply(result.message);
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xf6c453)
      .setTitle("🎁 Quà Daily Hôm Nay")
      .setThumbnail(emojiToTwemojiUrl("🎁"))
      .setDescription(result.message)
      .addFields(
        { name: "🪙 Linh thạch", value: `🪙 ${result.player.wallet.xu} Xu`, inline: true },
        { name: "💎 Ngọc", value: `💎 ${result.player.wallet.ngoc} Ngọc`, inline: true },
        { name: "📈 Tu vi", value: `Cấp ${result.player.stats.playerLevel} • ${result.player.stats.playerXp}/100 XP`, inline: true }
      );

    const levelField = buildCuteLevelField(result.levelInfo);
    if (levelField) {
      embed.addFields(levelField);
    }

    await interaction.reply({ embeds: [embed] });
  }
};
