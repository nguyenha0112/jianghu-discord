require("dotenv").config();

const { getSupabaseClient, hasSupabaseConfig } = require("../lib/supabase");

async function main() {
  if (!hasSupabaseConfig()) {
    console.error("Thiếu cấu hình Supabase trong .env.");
    process.exit(1);
  }

  const supabase = getSupabaseClient();

  const { error } = await supabase.from("players").select("user_id", {
    count: "exact",
    head: true
  });

  if (!error) {
    console.log("Kết nối Supabase thành công. Bảng players đã sẵn sàng.");
    return;
  }

  const message = error.message || "";

  if (message.includes("relation") && message.includes("does not exist")) {
    console.log("Kết nối Supabase thành công, nhưng schema game-bot chưa được tạo.");
    return;
  }

  console.error("Supabase trả về lỗi:", error);
  process.exit(1);
}

main().catch((error) => {
  console.error("Kiểm tra Supabase thất bại:", error);
  process.exit(1);
});
