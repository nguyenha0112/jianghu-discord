const { SlashCommandBuilder } = require("discord.js");
const { chooseProfession } = require("../services/game-service");
const { getProfessionTheme } = require("../lib/ui-theme");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("choose-profession")
    .setDescription("Chọn đạo tu chính của bạn.")
    .addStringOption((option) =>
      option
        .setName("profession")
        .setDescription("Đạo tu bạn muốn theo")
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

    await interaction.reply(
      `${professionTheme.emoji} Bạn đã nhập đạo theo hướng **${professionTheme.name}**. Đây sẽ là đạo tu chính để farm tài nguyên, luyện công và chuẩn bị đột phá cảnh giới trong Jianghu.`
    );
  }
};
