require("dotenv").config();

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

function canManageGameRoom(interaction) {
  return getAdminUserIds().includes(interaction.user.id) || hasAdminRole(interaction.member);
}

function assertCanManageGameRoom(interaction) {
  if (!canManageGameRoom(interaction)) {
    throw new Error("Bạn không có quyền cấu hình phòng nối từ.");
  }
}

module.exports = {
  canManageGameRoom,
  assertCanManageGameRoom
};
