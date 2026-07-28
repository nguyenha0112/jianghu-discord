const { SlashCommandBuilder } = require("discord.js");
const { appendTransaction } = require("../storage/transaction-store");
const { ensurePlayer, updatePlayer } = require("../storage/player-store");

const MIN_TRANSFER = 100;
const MAX_TRANSFER = 100000;
const TRANSFER_FEE_RATE = 0.05;
const MIN_TRANSFER_FEE = 10;

function formatNumber(value) {
  return new Intl.NumberFormat("vi-VN").format(Number(value || 0));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("give-xu")
    .setDescription("Chuyen Xu cho mot nguoi choi khac.")
    .addUserOption((option) =>
      option
        .setName("nguoi_nhan")
        .setDescription("Nguoi nhan Xu")
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("so_xu")
        .setDescription("So Xu muon chuyen")
        .setRequired(true)
        .setMinValue(1)
    ),
  async execute(interaction) {
    const receiver = interaction.options.getUser("nguoi_nhan", true);
    const amount = interaction.options.getInteger("so_xu", true);
    const fee = Math.max(MIN_TRANSFER_FEE, Math.floor(amount * TRANSFER_FEE_RATE));
    const totalCost = amount + fee;

    if (receiver.bot) {
      await interaction.reply({ content: "Khong the chuyen Xu cho bot.", ephemeral: true });
      return;
    }

    if (receiver.id === interaction.user.id) {
      await interaction.reply({ content: "Ban khong the tu chuyen Xu cho chinh minh.", ephemeral: true });
      return;
    }

    if (amount < MIN_TRANSFER) {
      await interaction.reply({ content: `Moi lan chuyen toi thieu la 🪙 ${formatNumber(MIN_TRANSFER)} Xu.`, ephemeral: true });
      return;
    }

    if (amount > MAX_TRANSFER) {
      await interaction.reply({
        content: `Moi lan chuyen toi da la 🪙 ${formatNumber(MAX_TRANSFER)} Xu de tranh lam dung.`,
        ephemeral: true
      });
      return;
    }

    const sender = await ensurePlayer(interaction.user.id, interaction.user.username);
    const recipient = await ensurePlayer(receiver.id, receiver.username);

    if ((sender.wallet?.xu || 0) < totalCost) {
      await interaction.reply({
        content: `Ban khong du Xu de chuyen. Can 🪙 ${formatNumber(totalCost)} Xu gom ${formatNumber(amount)} Xu chuyen va ${formatNumber(fee)} Xu phi. So du hien tai: 🪙 ${formatNumber(sender.wallet?.xu || 0)} Xu.`,
        ephemeral: true
      });
      return;
    }

    const updatedSender = await updatePlayer(sender.userId, {
      wallet: {
        ...sender.wallet,
        xu: sender.wallet.xu - totalCost
      }
    });

    const updatedRecipient = await updatePlayer(recipient.userId, {
      wallet: {
        ...recipient.wallet,
        xu: recipient.wallet.xu + amount
      }
    });

    appendTransaction({
      userId: sender.userId,
      username: interaction.user.username,
      type: "give_xu_sent",
      changes: {
        xu: -amount,
        fee,
        toUserId: receiver.id,
        toUsername: receiver.username
      }
    });

    appendTransaction({
      userId: recipient.userId,
      username: receiver.username,
      type: "give_xu_received",
      changes: {
        xu: amount,
        fromUserId: interaction.user.id,
        fromUsername: interaction.user.username
      }
    });

    await interaction.reply(
      `Da chuyen 🪙 ${formatNumber(amount)} Xu cho <@${receiver.id}>.\nPhi chuyen: 🪙 ${formatNumber(fee)} Xu.\nTong tru: 🪙 ${formatNumber(totalCost)} Xu.\nSo du cua ban: 🪙 ${formatNumber(updatedSender.wallet.xu)} Xu.\nSo du cua ${receiver.username}: 🪙 ${formatNumber(updatedRecipient.wallet.xu)} Xu.`
    );
  }
};
