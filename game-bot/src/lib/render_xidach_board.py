import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


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


TITLE_FONT = load_font(44, bold=True)
SUBTITLE_FONT = load_font(24, bold=True)
LABEL_FONT = load_font(28, bold=True)
TEXT_FONT = load_font(22, bold=False)
SMALL_FONT = load_font(18, bold=False)
CHIP_FONT = load_font(22, bold=True)


def card_asset_name(card):
    return f"{card['rank']}{card['assetCode']}.png"


def load_card(card, hidden=False):
    file_name = "BACK.png" if hidden else card_asset_name(card)
    image = Image.open(CARD_DIR / file_name).convert("RGBA")
    return image.resize((128, 180))


def draw_shadow(base, box, radius=24, color=(0, 0, 0, 120), blur=18):
    shadow = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(shadow)
    draw.rounded_rectangle(box, radius=radius, fill=color)
    shadow = shadow.filter(ImageFilter.GaussianBlur(blur))
    base.alpha_composite(shadow)


def draw_text(draw, xy, text, font, fill):
    draw.text(xy, text, font=font, fill=fill)


def draw_centered_cards(canvas, cards, center_x, y, hidden_after_first=False):
    if not cards:
        return
    gap = 92
    total_width = 128 + (len(cards) - 1) * gap
    start_x = int(center_x - total_width / 2)
    for index, card in enumerate(cards):
        hidden = hidden_after_first and index > 0
        card_image = load_card(card, hidden=hidden)
        canvas.alpha_composite(card_image, (start_x + index * gap, y))


def wrap_text(draw, text, font, max_width):
    lines = []
    for raw_line in text.split("\n"):
        words = raw_line.split(" ")
        current = ""
        for word in words:
            candidate = word if not current else f"{current} {word}"
            if draw.textlength(candidate, font=font) > max_width and current:
                lines.append(current)
                current = word
            else:
                current = candidate
        lines.append(current or "")
    return lines


def draw_chip(draw, box, fill, outline, text):
    draw.rounded_rectangle(box, radius=20, fill=fill, outline=outline, width=2)
    bbox = draw.textbbox((0, 0), text, font=CHIP_FONT)
    x = box[0] + (box[2] - box[0] - bbox[2]) / 2
    y = box[1] + (box[3] - box[1] - bbox[3]) / 2 - 2
    draw_text(draw, (x, y), text, CHIP_FONT, (255, 248, 232, 255))


def main():
    output_path = Path(sys.argv[1])
    payload = json.loads(sys.stdin.read())

    width, height = 1120, 700
    base = Image.new("RGBA", (width, height), (12, 43, 35, 255))

    glow = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.ellipse((90, 40, 720, 540), fill=(55, 132, 109, 70))
    glow_draw.ellipse((620, 220, 1080, 680), fill=(43, 103, 87, 70))
    glow = glow.filter(ImageFilter.GaussianBlur(50))
    base.alpha_composite(glow)

    draw = ImageDraw.Draw(base)
    draw.rounded_rectangle((18, 18, width - 18, height - 18), radius=34, outline=(220, 198, 141, 255), width=4)
    draw.rounded_rectangle((36, 36, width - 36, height - 36), radius=28, outline=(71, 121, 102, 255), width=2)

    draw_text(draw, (54, 44), payload["title"], TITLE_FONT, (248, 241, 220, 255))
    draw_text(draw, (56, 98), "Jianghu mini table", SUBTITLE_FONT, (178, 214, 195, 255))

    draw_shadow(base, (58, 138, 746, 640), radius=28)
    draw.rounded_rectangle((58, 138, 746, 640), radius=28, fill=(20, 80, 63, 238), outline=(86, 150, 128, 255), width=2)

    draw_text(draw, (90, 164), "Nguoi choi", LABEL_FONT, (255, 248, 232, 255))
    draw_text(draw, (90, 200), payload["playerName"], TEXT_FONT, (231, 238, 232, 255))
    draw_chip(draw, (520, 160, 700, 210), (144, 76, 36, 255), (231, 194, 125, 255), payload["betText"])
    draw_chip(draw, (520, 220, 700, 270), (41, 93, 130, 255), (142, 191, 220, 255), f"Diem {payload['playerScore']}")

    player_y = 256
    draw_centered_cards(base, payload["playerCards"], 402, player_y, hidden_after_first=False)

    draw.line((102, 404, 702, 404), fill=(84, 140, 119, 220), width=2)
    draw_text(draw, (90, 426), "Nha cai", LABEL_FONT, (255, 248, 232, 255))
    dealer_state = "Lat bai" if payload.get("revealDealer") else "Dang up bai"
    draw_text(draw, (90, 462), f"Diem {payload['dealerScoreText']} | {dealer_state}", TEXT_FONT, (231, 238, 232, 255))
    dealer_y = 486
    draw_centered_cards(base, payload["dealerCards"], 402, dealer_y, hidden_after_first=not payload.get("revealDealer"))

    draw_shadow(base, (790, 138, 1058, 640), radius=28)
    draw.rounded_rectangle((790, 138, 1058, 640), radius=28, fill=(10, 54, 43, 240), outline=(89, 155, 131, 255), width=2)
    draw_text(draw, (822, 168), "Thong tin van", LABEL_FONT, (248, 241, 220, 255))

    note_lines = [
        payload["note"],
        "",
        f"So la ban: {len(payload['playerCards'])}",
        f"So la nha cai: {len(payload['dealerCards'])}",
        "",
        f"Bai ban: {payload['playerCardsText']}",
        "",
        f"Bai nha cai: {payload['dealerCardsText']}",
    ]

    current_y = 222
    for line in note_lines:
        if not line:
            current_y += 16
            continue
        wrapped_lines = wrap_text(draw, line, SMALL_FONT, 200)
        for wrapped_line in wrapped_lines:
            draw_text(draw, (822, current_y), wrapped_line, SMALL_FONT, (232, 236, 232, 255))
            current_y += 27
        current_y += 7

    footer_text = "Render preview for Discord"
    bbox = draw.textbbox((0, 0), footer_text, font=SMALL_FONT)
    draw_text(draw, (width - bbox[2] - 48, height - 44), footer_text, SMALL_FONT, (170, 199, 185, 255))

    base.save(output_path, format="PNG")


if __name__ == "__main__":
    main()
