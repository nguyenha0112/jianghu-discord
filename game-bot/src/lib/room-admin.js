require("dotenv").config();

const { PermissionFlagsBits } = require("discord.js");

function getAdminUserIds() {
  return (process.env.ADMIN_USER_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function getAdminRoleIds() {
  return (process.env.ADMIN_ROLE_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function hasAdminRole(member) {
  const allowedRoles = getAdminRoleIds();
  if (!member || allowedRoles.length === 0 || !member.roles?.cache) {
    return false;
  }

  return allowedRoles.some((roleId) => member.roles.cache.has(roleId));
}

function hasDiscordManagePermission(member) {
  if (!member?.permissions?.has) {
    return false;
  }

  return (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.permissions.has(PermissionFlagsBits.ManageGuild) ||
    member.permissions.has(PermissionFlagsBits.ManageChannels)
  );
}

function canManageGameRoom(interaction) {
  return (
    getAdminUserIds().includes(interaction.user.id) ||
    hasAdminRole(interaction.member) ||
    hasDiscordManagePermission(interaction.member)
  );
}

function assertCanManageGameRoom(interaction) {
  if (!canManageGameRoom(interaction)) {
    throw new Error(
      "Ban khong co quyen cau hinh phong noi tu. Can role duoc chi dinh trong env hoac quyen Discord Manage Channels, Manage Server, hoac Administrator."
    );
  }
}

module.exports = {
  canManageGameRoom,
  assertCanManageGameRoom
};
