const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const { chooseProfession } = require("../services/game-service");
const { emojiToTwemojiUrl, getProfessionTheme } = require("../lib/ui-theme");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("choose-profession")
    .setDescription("Chon dao tu chinh cua ban.")
    .addStringOption((option) =>
      option
        .setName("profession")
        .setDescription("Dao tu ban muon theo")
        .setRequired(true)
        .addChoices(
          { name: "Ngư Đạo", value: "fishing" },
          { name: "Khoáng Đạo", value: "mining" },
          { name: "Thảo Đạo", value: "gathering" },
          { name: "Đan Đạo", value: "alchemy" },
          { name: "Cổ Tu Đạo", value: "archaeology" }
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
          .setTitle(`${professionTheme.emoji} Đã Chọn Đạo Tu Chính`)
          .setThumbnail(emojiToTwemojiUrl(professionTheme.emoji))
          .setDescription(`Bạn đã nhập đạo theo hướng **${professionTheme.name}**.`)
          .addFields(
            {
              name: "Vai trò",
              value: "Đây sẽ là hướng farm chính để kiếm tài nguyên, tăng cấp nghề và mở khóa các mốc đột phá.",
              inline: false
            },
            {
              name: "Gợi ý tiếp theo",
              value: "Dùng `/work` để bắt đầu farm, `/tutien` để xem tổng quan và `/dongphu` để chuẩn bị hướng nâng cấp lâu dài.",
              inline: false
            }
          )
      ]
    });
  }
};
