const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const { chooseProfession } = require("../services/game-service");
const { emojiToTwemojiUrl, getProfessionTheme } = require("../lib/ui-theme");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("choose-profession")
    .setDescription("Chọn nghề nghiệp chính của bạn.")
    .addStringOption((option) =>
      option
        .setName("profession")
        .setDescription("Nghề bạn muốn theo")
        .setRequired(true)
        .addChoices(
          { name: "Câu cá", value: "fishing" },
          { name: "Đào khoáng", value: "mining" },
          { name: "Hái lượm", value: "gathering" },
          { name: "Luyện dược", value: "alchemy" },
          { name: "Khảo cổ", value: "archaeology" }
        )
    ),
  async execute(interaction) {
    const professionId = interaction.options.getString("profession", true);
    await chooseProfession(interaction.user.id, interaction.user.username, professionId);
    const professionTheme = getProfessionTheme(professionId);

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(professionTheme.color)
          .setTitle(`${professionTheme.emoji} Đã Chọn Nghề Chính`)
          .setThumbnail(emojiToTwemojiUrl(professionTheme.emoji))
          .setDescription(`Bạn đã chọn nghề **${professionTheme.name}**.`)
          .addFields(
            {
              name: "Vai trò",
              value: "Đây là hướng farm chính để kiếm Xu, kinh nghiệm và nguyên liệu.",
              inline: false
            },
            {
              name: "Gợi ý tiếp theo",
              value: "Dùng `/work` để làm nghề, `/inventory` để xem vật phẩm và `/profile` để xem tiến độ.",
              inline: false
            }
          )
      ]
    });
  }
};
