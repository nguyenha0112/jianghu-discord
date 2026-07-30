import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
CARD_DIR = ROOT / "assets" / "cards"


def load_font(size: int, bold: bool = False):
    candidates = [
        "arialbd.ttf" if bold else "arial.ttf",
        "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf",
    ]
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            continue
    return ImageFont.load_default()


TITLE_FONT = load_font(42, bold=True)
LABEL_FONT = load_font(28, bold=True)
TEXT_FONT = load_font(24, bold=False)
SMALL_FONT = load_font(20, bold=False)


def card_asset_name(card):
    return f"{card['rank']}{card['assetCode']}.png"


def load_card(card, hidden=False):
    file_name = "BACK.png" if hidden else card_asset_name(card)
    image = Image.open(CARD_DIR / file_name).convert("RGBA")
    return image.resize((126, 176))


def draw_text(draw, xy, text, font, fill):
    draw.text(xy, text, font=font, fill=fill)


def draw_cards(canvas, cards, start_x, y, hidden_after_first=False):
    gap = 86
    for index, card in enumerate(cards):
      hidden = hidden_after_first and index > 0
      card_image = load_card(card, hidden=hidden)
      canvas.alpha_composite(card_image, (start_x + index * gap, y))


def main():
    output_path = Path(sys.argv[1])
    payload = json.loads(sys.stdin.read())

    width, height = 980, 620
    base = Image.new("RGBA", (width, height), (17, 68, 54, 255))
    draw = ImageDraw.Draw(base)

    draw.rounded_rectangle((16, 16, width - 16, height - 16), radius=28, outline=(230, 214, 161, 255), width=4)
    draw.rounded_rectangle((36, 36, width - 36, height - 36), radius=24, outline=(71, 121, 102, 255), width=2)

    draw_text(draw, (42, 34), payload["title"], TITLE_FONT, (248, 241, 220, 255))
    draw_text(draw, (44, 96), f"Người chơi: {payload['playerName']}", LABEL_FONT, (255, 255, 255, 255))
    draw_text(draw, (44, 132), f"Điểm: {payload['playerScore']} | Cược: {payload['betText']}", TEXT_FONT, (234, 229, 214, 255))

    draw_text(draw, (44, 320), "Nhà cái", LABEL_FONT, (255, 255, 255, 255))
    dealer_sub = f"Điểm: {payload['dealerScoreText']}"
    if payload.get("revealDealer"):
        dealer_sub += " | Lật bài"
    else:
        dealer_sub += " | Đang úp bài"
    draw_text(draw, (44, 356), dealer_sub, TEXT_FONT, (234, 229, 214, 255))

    draw_cards(base, payload["playerCards"], 44, 164, hidden_after_first=False)
    draw_cards(base, payload["dealerCards"], 44, 388, hidden_after_first=not payload.get("revealDealer"))

    note_box = (604, 104, 934, 560)
    draw.rounded_rectangle(note_box, radius=22, fill=(12, 47, 38, 255), outline=(88, 150, 127, 255), width=2)
    draw_text(draw, (626, 126), "Thông tin ván", LABEL_FONT, (248, 241, 220, 255))

    note_lines = [
        payload["note"],
        "",
        f"Số lá bạn: {len(payload['playerCards'])}",
        f"Số lá nhà cái: {len(payload['dealerCards'])}",
        "",
        f"Bài bạn: {payload['playerCardsText']}",
        "",
        f"Bài nhà cái: {payload['dealerCardsText']}",
    ]

    current_y = 176
    for line in note_lines:
        if not line:
            current_y += 14
            continue
        wrapped = []
        words = line.split(" ")
        current = ""
        for word in words:
            candidate = word if not current else f"{current} {word}"
            if draw.textlength(candidate, font=SMALL_FONT) > 280:
                wrapped.append(current)
                current = word
            else:
                current = candidate
        if current:
            wrapped.append(current)

        for wrapped_line in wrapped:
            draw_text(draw, (626, current_y), wrapped_line, SMALL_FONT, (232, 236, 232, 255))
            current_y += 28
        current_y += 6

    base.save(output_path, format="PNG")


if __name__ == "__main__":
    main()
