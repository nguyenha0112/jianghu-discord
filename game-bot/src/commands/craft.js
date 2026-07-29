const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const { craftRecipe, getRecipeListings } = require("../services/game-service");
const { emojiToTwemojiUrl, formatItemLabel } = require("../lib/ui-theme");

const recipeChoices = getRecipeListings().map((recipe) => ({
  name: recipe.name,
  value: recipe.recipeId
}));

module.exports = {
  data: new SlashCommandBuilder()
    .setName("craft")
    .setDescription("Xem hoac thuc hien craft theo cong thuc.")
    .addStringOption((option) =>
      option
        .setName("cong_thuc")
        .setDescription("Chon cong thuc muon craft ngay")
        .setRequired(false)
        .addChoices(...recipeChoices)
    ),
  async execute(interaction) {
    const recipeId = interaction.options.getString("cong_thuc");

    if (recipeId) {
      const result = await craftRecipe(interaction.user.id, interaction.user.username, recipeId);
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(result.ok ? 0x2ecc71 : 0xe74c3c)
            .setTitle(result.ok ? "⚗️ Luyện Chế Thành Công" : "⚗️ Luyện Chế Thất Bại")
            .setThumbnail(emojiToTwemojiUrl(result.ok ? "⚗️" : "⚠️"))
            .setDescription(result.message)
        ]
      });
      return;
    }

    const listings = getRecipeListings();
    const embed = new EmbedBuilder()
      .setColor(0x9b59b6)
      .setTitle("⚗️ Lò Luyện Jianghu")
      .setThumbnail(emojiToTwemojiUrl("⚗️"))
      .setDescription(
        listings
          .map((recipe) => {
            const inputs = recipe.inputs.map((input) => formatItemLabel(input.itemId, input.quantity)).join(", ");
            return `**${recipe.name}**\nNguyên liệu: ${inputs}\nPhí: **${recipe.cost.xu} Xu**\nKết quả: ${formatItemLabel(recipe.output.itemId, recipe.output.quantity)}`;
          })
          .join("\n\n")
      )
      .setFooter({ text: "Dùng /craft rồi chọn mục 'cong_thuc' nếu muốn luyện chế ngay." });

    await interaction.reply({ embeds: [embed] });
  }
};
