const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const { craftRecipe, getRecipeListings } = require("../services/game-service");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("craft")
    .setDescription("Xem hoặc thực hiện chế tạo theo công thức.")
    .addStringOption((option) =>
      option
        .setName("recipe_id")
        .setDescription("Nhập recipe_id nếu muốn chế tạo ngay")
        .setRequired(false)
    ),
  async execute(interaction) {
    const recipeId = interaction.options.getString("recipe_id");

    if (recipeId) {
      const result = craftRecipe(interaction.user.id, interaction.user.username, recipeId);
      await interaction.reply(result.message);
      return;
    }

    const listings = getRecipeListings();
    const embed = new EmbedBuilder()
      .setTitle("Jianghu Crafting")
      .setDescription(
        listings
          .map((recipe) => {
            const inputs = recipe.inputs
              .map((input) => `${input.itemId} x${input.quantity}`)
              .join(", ");
            return `\`${recipe.recipeId}\` - ${recipe.name}\nNguyên liệu: ${inputs}\nPhí: ${recipe.cost.xu} Xu\nKết quả: ${recipe.outputName} x${recipe.output.quantity}`;
          })
          .join("\n\n")
      );

    await interaction.reply({ embeds: [embed] });
  }
};
