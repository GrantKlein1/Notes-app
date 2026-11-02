#!/usr/bin/env python3
"""Draw the home-screen icons. No third-party image library."""

import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "public" / "icons"


def write_png(path: Path, width: int, height: int, rgba: bytearray) -> None:
    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    raw = b"".join(b"\x00" + bytes(rgba[y * width * 4 : (y + 1) * width * 4]) for y in range(height))
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    path.write_bytes(png)


def put(pixels: bytearray, width: int, x: int, y: int, color: tuple[int, int, int, int]) -> None:
    if x < 0 or y < 0 or x >= width or y >= width:
        return
    index = (y * width + x) * 4
    src_a = color[3] / 255
    if src_a >= 1:
        pixels[index : index + 4] = bytes(color)
        return
    dst_a = pixels[index + 3] / 255
    out_a = src_a + dst_a * (1 - src_a)
    if out_a == 0:
        return
    for channel in range(3):
        pixels[index + channel] = int((color[channel] * src_a + pixels[index + channel] * dst_a * (1 - src_a)) / out_a)
    pixels[index + 3] = int(out_a * 255)


def fill(pixels: bytearray, width: int, color: tuple[int, int, int, int]) -> None:
    for index in range(0, width * width * 4, 4):
        pixels[index : index + 4] = bytes(color)


def round_rect(
    pixels: bytearray,
    width: int,
    x0: int,
    y0: int,
    rw: int,
    rh: int,
    radius: int,
    color: tuple[int, int, int, int],
) -> None:
    for y in range(y0, y0 + rh):
        for x in range(x0, x0 + rw):
            dx = 0
            dy = 0
            if x < x0 + radius:
                dx = x0 + radius - x
            elif x >= x0 + rw - radius:
                dx = x - (x0 + rw - radius - 1)
            if y < y0 + radius:
                dy = y0 + radius - y
            elif y >= y0 + rh - radius:
                dy = y - (y0 + rh - radius - 1)
            if dx * dx + dy * dy <= radius * radius:
                put(pixels, width, x, y, color)


def line(
    pixels: bytearray,
    width: int,
    x0: int,
    x1: int,
    y: int,
    thickness: int,
    color: tuple[int, int, int, int],
) -> None:
    for offset in range(thickness):
        for x in range(x0, x1):
            put(pixels, width, x, y + offset, color)


def app_icon(size: int) -> bytearray:
    pixels = bytearray(size * size * 4)
    fill(pixels, size, (10, 132, 255, 255))
    margin = int(size * 0.2)
    radius = max(8, int(size * 0.08))
    round_rect(pixels, size, margin, margin, size - margin * 2, size - margin * 2, radius, (255, 255, 255, 255))
    left = margin + int(size * 0.1)
    right = size - margin - int(size * 0.1)
    thickness = max(2, size // 48)
    gap = int(size * 0.11)
    start = margin + int(size * 0.22)
    ink = (120, 144, 176, 255)
    for index in range(3):
        line(pixels, size, left, right if index < 2 else left + int((right - left) * 0.62), start + index * gap, thickness, ink)
    return pixels


def plus_icon(size: int) -> bytearray:
    pixels = bytearray(size * size * 4)
    fill(pixels, size, (52, 199, 89, 255))
    thickness = max(8, size // 10)
    length = int(size * 0.46)
    origin = (size - length) // 2
    center = (size - thickness) // 2
    for y in range(center, center + thickness):
        for x in range(origin, origin + length):
            put(pixels, size, x, y, (255, 255, 255, 255))
    for x in range(center, center + thickness):
        for y in range(origin, origin + length):
            put(pixels, size, x, y, (255, 255, 255, 255))
    return pixels


def main() -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    write_png(ROOT / "icon-512.png", 512, 512, app_icon(512))
    write_png(ROOT / "icon-192.png", 192, 192, app_icon(192))
    write_png(ROOT / "apple-touch-icon.png", 180, 180, app_icon(180))
    write_png(ROOT / "favicon.png", 32, 32, app_icon(32))
    write_png(ROOT / "shortcut-expense.png", 192, 192, plus_icon(192))


if __name__ == "__main__":
    main()
