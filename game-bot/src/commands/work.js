const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const { doWork } = require("../services/game-service");
const { announceLevelUp } = require("../lib/levelup-announcer");
const {
  buildCuteLevelField,
  emojiToTwemojiUrl,
  formatItemLabel,
  getProfessionTheme
} = require("../lib/ui-theme");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("work")
    .setDescription("Làm nghề hiện tại để nhận Xu, XP và vật phẩm."),
  async execute(interaction) {
    const result = await doWork(interaction.user.id, interaction.user.username);
    if (!result.ok) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle("⚠️ Chưa Thể Làm Nghề")
            .setThumbnail(emojiToTwemojiUrl("⚠️"))
            .setDescription(result.message)
        ]
      });
      return;
    }

    const professionTheme = getProfessionTheme(result.player.profession.current);
    const embed = new EmbedBuilder()
      .setColor(professionTheme.color)
      .setTitle(`${professionTheme.emoji} Làm Nghề Thành Công`)
      .setThumbnail(emojiToTwemojiUrl(professionTheme.emoji))
      .setDescription(`${result.profession.rewardText}\n\nNghề hiện tại: **${professionTheme.name}**.`)
      .addFields(
        { name: "🪙 Thu hoạch", value: `+${result.reward.xuGain} Xu`, inline: true },
        { name: "🎁 Vật phẩm", value: formatItemLabel(result.reward.itemId, result.reward.quantity), inline: true },
        { name: "⚡ Kinh nghiệm", value: `+${result.reward.xpGain} XP nghề\n+${result.reward.playerXpGain} XP nhân vật`, inline: true },
        { name: "📈 Cấp nghề tối đa", value: `${result.reward.realmCap}`, inline: true }
      )
      .setFooter({ text: result.reward.realmCapReached ? "Nghề đã đạt cấp tối đa hiện tại." : "Có thể tiếp tục làm nghề sau thời gian hồi." });

    const levelField = buildCuteLevelField(result.levelInfo);
    if (levelField) {
      embed.addFields(levelField);
    }

    await interaction.reply({ embeds: [embed] });
    await announceLevelUp(interaction.client, interaction.guildId, interaction.user, result.levelInfo, "Làm nghề");
  }
};
