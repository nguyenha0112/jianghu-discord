const { EmbedBuilder } = require("discord.js");
const { getRoom } = require("../storage/serverlog-room-store");

function buildMemberLeaveEmbed(member) {
  const user = member.user;
  const joinedAt = member.joinedAt ? Math.floor(member.joinedAt.getTime() / 1000) : null;
  const createdAt = user.createdAt ? Math.floor(user.createdAt.getTime() / 1000) : null;
  const roleValues = member.roles?.cache?.values ? [...member.roles.cache.values()] : [];
  const roles = roleValues
    .filter((role) => role.id !== member.guild.id)
    .sort((left, right) => right.position - left.position)
    .map((role) => `<@&${role.id}>`)
    .slice(0, 12);

  const embed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setAuthor({
      name: user.tag || user.username,
      iconURL: user.displayAvatarURL?.({ size: 128 }) || undefined
    })
    .setTitle("Thành viên đã rời server")
    .setDescription(`<@${user.id}> đã rời khỏi **${member.guild.name}**.`)
    .addFields(
      { name: "User ID", value: user.id, inline: true },
      { name: "Tài khoản tạo", value: createdAt ? `<t:${createdAt}:R>` : "Không rõ", inline: true },
      { name: "Vào server", value: joinedAt ? `<t:${joinedAt}:R>` : "Không rõ", inline: true }
    )
    .setThumbnail(user.displayAvatarURL?.({ size: 256 }) || null)
    .setTimestamp();

  if (roles?.length) {
    embed.addFields({ name: "Role trước khi rời", value: roles.join(" "), inline: false });
  }

  return embed;
}

async function announceMemberLeave(member) {
  const room = getRoom(member.guild.id);
  if (!room?.channelId) {
    console.log("[serverlog] member leave skipped: no channel configured", {
      guildId: member.guild.id,
      userId: member.user.id
    });
    return false;
  }

  const channel = await member.client.channels.fetch(room.channelId).catch((error) => {
    console.warn("[serverlog] cannot fetch leave channel", {
      guildId: member.guild.id,
      channelId: room.channelId,
      message: error.message
    });
    return null;
  });

  if (!channel?.send) {
    console.warn("[serverlog] leave channel is not sendable", {
      guildId: member.guild.id,
      channelId: room.channelId,
      userId: member.user.id
    });
    return false;
  }

  await channel.send({ embeds: [buildMemberLeaveEmbed(member)] }).catch((error) => {
    console.error("[serverlog] failed to send member leave log", {
      guildId: member.guild.id,
      channelId: room.channelId,
      userId: member.user.id,
      message: error.message
    });
  });

  console.log("[serverlog] member leave sent", {
    guildId: member.guild.id,
    channelId: room.channelId,
    userId: member.user.id
  });
  return true;
}

module.exports = {
  announceMemberLeave,
  buildMemberLeaveEmbed
};
