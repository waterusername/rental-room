"""Draw a 1024x640 map with a pin. Used only when Street View has no nearby panorama."""

import math
import sys
import time
import urllib.request
from io import BytesIO

from PIL import Image, ImageDraw

WIDTH = 1024
HEIGHT = 640
ZOOM = 18
UA = "GrinbergRentalRoom/1.0 (apartment map fallback; contact ApplyGrinberg@gmail.com)"
SOURCES = [
    "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
]


def world_px(lat, lon, zoom):
    n = 2**zoom
    x = (lon + 180.0) / 360.0 * n * 256
    lat_rad = math.radians(lat)
    y = (1 - math.log(math.tan(lat_rad) + 1 / math.cos(lat_rad)) / math.pi) / 2 * n * 256
    return x, y


def fetch_tile(template, z, x, y):
    url = template.format(z=z, x=x, y=y)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as res:
        data = res.read()
    if not data or data[:4] == b"<htm" or data[:1] == b"<":
        raise RuntimeError(f"tile was not an image: {url}")
    return Image.open(BytesIO(data)).convert("RGB")


def stitch(lat, lon):
    cx, cy = world_px(lat, lon, ZOOM)
    left = cx - WIDTH / 2
    top = cy - HEIGHT / 2
    x0 = math.floor(left / 256)
    y0 = math.floor(top / 256)
    x1 = math.floor((left + WIDTH - 1) / 256)
    y1 = math.floor((top + HEIGHT - 1) / 256)
    last_error = None
    for template in SOURCES:
        try:
            canvas = Image.new("RGB", ((x1 - x0 + 1) * 256, (y1 - y0 + 1) * 256), (232, 230, 223))
            for ty in range(y0, y1 + 1):
                for tx in range(x0, x1 + 1):
                    tile = fetch_tile(template, ZOOM, tx, ty)
                    canvas.paste(tile, ((tx - x0) * 256, (ty - y0) * 256))
                    time.sleep(0.15)
            crop_x = int(round(left - x0 * 256))
            crop_y = int(round(top - y0 * 256))
            image = canvas.crop((crop_x, crop_y, crop_x + WIDTH, crop_y + HEIGHT))
            return image
        except Exception as exc:  # try the next tile server
            last_error = exc
    raise RuntimeError(f"map tiles failed: {last_error}")


def draw_pin(image):
    draw = ImageDraw.Draw(image)
    x = WIDTH // 2
    y = HEIGHT // 2
    draw.ellipse((x - 16, y - 16, x + 16, y + 16), fill=(27, 58, 49), outline=(255, 255, 255), width=4)
    draw.ellipse((x - 5, y - 5, x + 5, y + 5), fill=(255, 255, 255))
    return image


def main():
    lat = float(sys.argv[1])
    lon = float(sys.argv[2])
    dest = sys.argv[3]
    image = draw_pin(stitch(lat, lon))
    image.save(dest, "JPEG", quality=86, optimize=True)


if __name__ == "__main__":
    main()
