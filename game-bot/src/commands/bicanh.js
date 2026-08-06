const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const { exploreSecretRealm, getSecretRealmListings } = require("../services/game-service");
const { announceLevelUp } = require("../lib/levelup-announcer");
const { emojiToTwemojiUrl, formatItemLabel } = require("../lib/ui-theme");

const secretRealmChoices = getSecretRealmListings().map((entry) => ({
  name: entry.name,
  value: entry.realmId
}));

module.exports = {
  data: new SlashCommandBuilder()
    .setName("bicanh")
    .setDescription("Tham hiem bi canh, danh quai hoac khieu chien boss.")
    .addStringOption((option) =>
      option
        .setName("bi_canh")
        .setDescription("Chon bi canh muon tham hiem")
        .setRequired(false)
        .addChoices(...secretRealmChoices)
    )
    .addStringOption((option) =>
      option
        .setName("che_do")
        .setDescription("Chon danh quai thuong hoac boss")
        .setRequired(false)
        .addChoices(
          { name: "Quai thuong", value: "thuong" },
          { name: "Boss", value: "boss" }
        )
    ),
  async execute(interaction) {
    const realmId = interaction.options.getString("bi_canh");
    const mode = interaction.options.getString("che_do") || "thuong";

    if (realmId) {
      const result = await exploreSecretRealm(interaction.user.id, interaction.user.username, realmId, mode);
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(result.ok ? (mode === "boss" ? 0xc0392b : 0x3498db) : 0xe74c3c)
            .setTitle(result.ok ? (mode === "boss" ? "👹 Khiêu Chiến Boss Bí Cảnh" : "🌌 Thám Hiểm Bí Cảnh") : "🌌 Không Thể Vào Bí Cảnh")
            .setThumbnail(emojiToTwemojiUrl(mode === "boss" ? "👹" : "🌌"))
            .setDescription(result.message)
            .addFields(
              result.ok
                ? [
                    { name: "🎯 Mục tiêu", value: `${result.battle.target.emoji} ${result.battle.target.name}`, inline: true },
                    { name: "⚔️ Giao chiến", value: `${result.battle.rounds} lượt`, inline: true },
                    { name: "💥 Lực chiến", value: `${result.battle.combat.power}`, inline: true },
                    { name: "🪙 Thu hoạch", value: `+${result.reward.xuGain} Xu`, inline: true },
                    { name: "🎁 Dị bảo", value: formatItemLabel(result.reward.itemId, result.reward.quantity), inline: true },
                    { name: "⚡ Tu vi", value: `+${result.reward.playerXpGain} XP`, inline: true },
                    { name: "📜 Chiến báo", value: result.battle.logs.join("\n"), inline: false }
                  ]
                : []
            )
        ]
      });
      await announceLevelUp(interaction.client, interaction.guildId, interaction.user, result.levelInfo, "Bí cảnh");
      return;
    }

    const listings = getSecretRealmListings();
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x34495e)
          .setTitle("🌌 Danh Sách Bí Cảnh")
          .setThumbnail(emojiToTwemojiUrl("🌌"))
          .setDescription(
            listings
              .map(
                (entry) =>
                  `**${entry.name}**\nQuái canh giữ: ${entry.monster.emoji} **${entry.monster.name}**\nBoss: ${entry.boss.emoji} **${entry.boss.name}**\nYêu cầu: cảnh giới bậc **${entry.minRealmIndex + 1}** trở lên\nHồi lại: **${entry.cooldownHours} giờ**`
              )
              .join("\n\n")
          )
          .setFooter({ text: "Dùng /bicanh rồi chọn bí cảnh và chế độ để farm quái hoặc đánh boss." })
      ]
    });
  }
};
