const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const { getRecentTransactions } = require("../services/admin-service");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("admin-transactions")
    .setDescription("Xem giao dich gan nhat.")
    .addStringOption((option) =>
      option
        .setName("user_id")
        .setDescription("Loc theo Discord user ID")
        .setRequired(false)
    )
    .addIntegerOption((option) =>
      option
        .setName("limit")
        .setDescription("So giao dich muon xem")
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(20)
    ),
  async execute(interaction) {
    try {
      const userId = interaction.options.getString("user_id");
      const limit = interaction.options.getInteger("limit") || 10;
      const rows = await getRecentTransactions(interaction.user.id, userId, limit);

      const description =
        rows.length === 0
          ? "Chua co giao dich nao."
          : rows
              .map((row) => {
                return `[${row.created_at}] ${row.username} | ${row.type} | ${JSON.stringify(row.changes)}`;
              })
              .join("\n");

      const embed = new EmbedBuilder()
        .setTitle("Admin Transactions")
        .setDescription(description.slice(0, 4000));

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      await interaction.reply({ content: error.message, ephemeral: true });
    }
  }
};
