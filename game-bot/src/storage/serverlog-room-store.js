const { createRoomStore } = require("./create-room-store");

module.exports = createRoomStore({
  gameKey: "serverlog_notifications",
  fileName: "serverlog-rooms.json"
});
