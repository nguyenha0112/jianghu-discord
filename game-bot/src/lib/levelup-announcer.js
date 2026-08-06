const { EmbedBuilder } = require("discord.js");
const { getRoom } = require("../storage/levelup-room-store");

function buildLevelUpEmbed(user, levelInfo, source = "Hoạt động") {
  const avatarUrl = user.displayAvatarURL?.({ size: 256 }) || null;
  const embed = new EmbedBuilder()
    .setColor(0xffc857)
    .setAuthor({
      name: user.username || user.displayName || "Người chơi",
      iconURL: user.displayAvatarURL?.({ size: 128 }) || undefined
    })
    .setTitle("Lên cấp tu vi")
    .setDescription(`<@${user.id}> vừa lên cấp!`)
    .addFields(
      { name: "Cấp cũ", value: String(levelInfo.levelBefore), inline: true },
      { name: "Cấp mới", value: String(levelInfo.levelAfter), inline: true },
      { name: "XP hiện tại", value: `${levelInfo.xpAfter}/100`, inline: true },
      { name: "Nguồn", value: source, inline: false }
    )
    .setTimestamp();

  if (avatarUrl) {
    embed.setThumbnail(avatarUrl);
  }

  return embed;
}

async function announceLevelUp(client, guildId, user, levelInfo, source) {
  if (!levelInfo?.didLevelUp || !client || !guildId || !user?.id) {
    return false;
  }

  const room = getRoom(guildId);
  if (!room?.channelId) {
    console.log("[levelup] skipped: no notification channel configured", { guildId, userId: user.id });
    return false;
  }

  const channel = await client.channels.fetch(room.channelId).catch(() => null);
  if (!channel?.send) {
    console.warn("[levelup] skipped: channel not found or not sendable", { guildId, channelId: room.channelId, userId: user.id });
    return false;
  }

  await channel.send({ embeds: [buildLevelUpEmbed(user, levelInfo, source)] }).catch(() => {});
  console.log("[levelup] announcement sent", {
    guildId,
    channelId: room.channelId,
    userId: user.id,
    levelBefore: levelInfo.levelBefore,
    levelAfter: levelInfo.levelAfter,
    source
  });
  return true;
}

module.exports = {
  announceLevelUp,
  buildLevelUpEmbed
};
