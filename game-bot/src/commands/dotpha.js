const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const items = require("../config/items");
const { attemptBreakthrough, getCultivationStatus } = require("../services/game-service");
const { emojiToTwemojiUrl, getRealmTheme } = require("../lib/ui-theme");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("dotpha")
    .setDescription("Đột phá cảnh giới khi đã đủ điều kiện."),
  async execute(interaction) {
    const preview = await getCultivationStatus(interaction.user.id, interaction.user.username);
    const result = await attemptBreakthrough(interaction.user.id, interaction.user.username);

    if (!result.ok) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xe67e22)
            .setTitle("🧱 Đột Phá Thất Bại")
            .setThumbnail(emojiToTwemojiUrl("🧱"))
            .setDescription(result.message)
            .addFields(
              { name: "Cảnh giới hiện tại", value: preview.currentRealm.name, inline: true },
              { name: "Mốc cấp nghề", value: String(preview.currentRealm.levelCap), inline: true },
              {
                name: "Tài nguyên cần",
                value:
                  preview.nextRealm
                    ? [
                        preview.nextRealm.breakthroughCost.xu > 0 ? `${preview.nextRealm.breakthroughCost.xu} Xu` : null,
                        ...(preview.nextRealm.breakthroughCost.items || []).map(
                          (entry) => `${items[entry.itemId]?.name || entry.itemId} x${entry.quantity}`
                        )
                      ]
                        .filter(Boolean)
                        .join(", ")
                    : "Không có",
                inline: false
              }
            )
        ]
      });
      return;
    }

    const nextRealmTheme = getRealmTheme(result.nextRealm.key);
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(nextRealmTheme.color)
          .setTitle(`${nextRealmTheme.emoji} Đột Phá Thành Công`)
          .setThumbnail(emojiToTwemojiUrl(nextRealmTheme.emoji))
          .setDescription(result.message)
          .addFields(
            { name: "Từ", value: result.currentRealm.name, inline: true },
            { name: "Lên", value: result.nextRealm.name, inline: true },
            { name: "Giới hạn cấp mới", value: String(result.nextRealm.levelCap), inline: true }
          )
          .setFooter({ text: "Cảnh giới mới đã mở ra. Bạn có thể tiếp tục tu luyện nghề nghiệp để vươn lên tầng cao hơn." })
      ]
    });
  }
};
