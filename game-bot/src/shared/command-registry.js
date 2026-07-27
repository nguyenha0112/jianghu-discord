const { SlashCommandBuilder } = require("discord.js");

const commandBuilders = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Kiem tra bot co dang online khong."),
  new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Xem profile Jianghu cua ban."),
  new SlashCommandBuilder()
    .setName("daily")
    .setDescription("Nhan daily hang ngay."),
  new SlashCommandBuilder()
    .setName("choose-profession")
    .setDescription("Chon nghe nghiep chinh cua ban.")
    .addStringOption((option) =>
      option
        .setName("profession")
        .setDescription("Nghe ban muon theo")
        .setRequired(true)
        .addChoices(
          { name: "Fishing", value: "fishing" },
          { name: "Mining", value: "mining" },
          { name: "Gathering", value: "gathering" },
          { name: "Alchemy", value: "alchemy" },
          { name: "Archaeology", value: "archaeology" }
        )
    ),
  new SlashCommandBuilder()
    .setName("work")
    .setDescription("Thuc hien hanh dong nghe nghiep de nhan reward."),
  new SlashCommandBuilder()
    .setName("inventory")
    .setDescription("Xem inventory hien tai cua ban.")
];

const commandData = commandBuilders.map((builder) => builder.toJSON());

module.exports = {
  commandBuilders,
  commandData
};
