const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const { getDwellingStatus, upgradeDwelling } = require("../services/game-service");
const { emojiToTwemojiUrl } = require("../lib/ui-theme");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("dongphu")
    .setDescription("Xem hoặc nâng cấp động phủ của bạn.")
    .addStringOption((option) =>
      option
        .setName("hanh_dong")
        .setDescription("Chọn thao tác muốn thực hiện")
        .setRequired(false)
        .addChoices(
          { name: "Xem động phủ", value: "xem" },
          { name: "Nâng cấp động phủ", value: "nangcap" }
        )
    ),
  async execute(interaction) {
    const action = interaction.options.getString("hanh_dong") || "xem";

    if (action === "nangcap") {
      const result = await upgradeDwelling(interaction.user.id, interaction.user.username);
      if (!result.ok) {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xe67e22)
              .setTitle("🏚️ Nâng Cấp Động Phủ Thất Bại")
              .setThumbnail(emojiToTwemojiUrl("🏚️"))
              .setDescription(result.message)
          ]
        });
        return;
      }

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle(`${result.nextDwelling.emoji} Nâng Cấp Động Phủ Thành Công`)
            .setThumbnail(emojiToTwemojiUrl(result.nextDwelling.emoji))
            .setDescription(result.message)
            .addFields(
              { name: "Từ", value: result.currentDwelling.name, inline: true },
              { name: "Lên", value: result.nextDwelling.name, inline: true },
              { name: "Hiệu quả mới", value: `+${result.nextDwelling.xuBonusPercent}% Xu\n+${result.nextDwelling.professionXpBonusPercent}% XP đạo tu`, inline: true }
            )
        ]
      });
      return;
    }

    const status = await getDwellingStatus(interaction.user.id, interaction.user.username);
    const dwelling = status.dwelling;
    const nextDwelling = status.nextDwelling;

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x3498db)
          .setTitle(`${dwelling.emoji} Động Phủ Tu Luyện`)
          .setThumbnail(emojiToTwemojiUrl(dwelling.emoji))
          .setDescription(
            [
              `**Động phủ hiện tại:** ${dwelling.name}`,
              `**Thưởng Xu farm:** +${dwelling.xuBonusPercent}%`,
              `**Thưởng XP đạo tu:** +${dwelling.professionXpBonusPercent}%`
            ].join("\n")
          )
          .addFields(
            {
              name: "Nâng cấp kế tiếp",
              value: nextDwelling
                ? `${nextDwelling.emoji} **${nextDwelling.name}**`
                : "Đã đạt cấp tối đa",
              inline: true
            },
            {
              name: "Chi phí",
              value: status.upgradeCostText,
              inline: true
            },
            {
              name: "Cách dùng",
              value: "Dùng `/dongphu hanh_dong:nangcap` để nâng cấp ngay khi đủ điều kiện.",
              inline: false
            }
          )
      ]
    });
  }
};
