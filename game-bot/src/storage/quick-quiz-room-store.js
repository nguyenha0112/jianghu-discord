const { createRoomStore } = require("./create-room-store");

module.exports = createRoomStore({
  gameKey: "quick_quiz",
  fileName: "quick-quiz-rooms.json"
});
