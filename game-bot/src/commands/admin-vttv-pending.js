const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const { getVietnameseKingPendingCandidates } = require("../services/admin-service");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("admin-vttv-pending")
    .setDescription("Xem danh sách câu đố Vua Tiếng Việt đang chờ duyệt.")
    .addIntegerOption((option) =>
      option
        .setName("limit")
        .setDescription("Số mục muốn xem")
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(20)
    ),
  async execute(interaction) {
    try {
      const limit = interaction.options.getInteger("limit") || 10;
      const result = getVietnameseKingPendingCandidates(interaction.user.id, limit);

      const description =
        result.items.length === 0
          ? "Chưa có mục pending nào."
          : result.items
              .map(
                (item, index) =>
                  `${index + 1}. **${item.answer}**\nLoại: ${item.type} | Độ khó: ${item.difficulty} | Nguồn: ${item.source}\nHint: ${item.hint || "Chưa có"}\nNghĩa: ${item.meaning || "Chưa có"}`
              )
              .join("\n\n");

      const embed = new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle("Admin Vua Tiếng Việt - Pending")
        .setDescription(description.slice(0, 4000))
        .addFields(
          { name: "Tổng số", value: String(result.summary.total), inline: true },
          { name: "Pending", value: String(result.summary.pending), inline: true },
          { name: "Approved", value: String(result.summary.approved), inline: true }
        );

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      await interaction.reply({ content: error.message, ephemeral: true });
    }
  }
};
