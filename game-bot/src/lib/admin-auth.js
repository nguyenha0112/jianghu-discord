require("dotenv").config();

function getAdminUserIds() {
  return (process.env.ADMIN_USER_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function isAdminUser(userId) {
  return getAdminUserIds().includes(userId);
}

function assertAdmin(userId) {
  if (!isAdminUser(userId)) {
    throw new Error("Ban khong co quyen dung lenh admin.");
  }
}

module.exports = {
  getAdminUserIds,
  isAdminUser,
  assertAdmin
};
