"""Convert the supplied pose sheet into aligned, transparent web sprite strips.

The source currently contains one pose per action, not temporal animation frames.
Motion profiles synthesize small translations/scales of that pose without redrawing it.
New sheets may be configured with rows/columns and per-action cell mappings below.
"""

from __future__ import annotations

import argparse
import json
from collections import deque
from pathlib import Path
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG = Path(__file__).with_name("panda-assets.json")


def edge_connected_background(image: Image.Image) -> Image.Image:
    """Clear only near-white pixels reachable from a crop edge.

    White facial and belly pixels enclosed by the dark outline are preserved.
    """
    rgba = image.convert("RGBA")
    width, height = rgba.size
    pixels = rgba.load()
    candidate = bytearray(width * height)
    for y in range(height):
        for x in range(width):
            r, g, b, _ = pixels[x, y]
            candidate[y * width + x] = int(
                r >= 210 and g >= 210 and b >= 205 and max(r, g, b) - min(r, g, b) <= 38
            )

    visited = bytearray(width * height)
    queue: deque[int] = deque()
    for x in range(width):
        for y in (0, height - 1):
            index = y * width + x
            if candidate[index] and not visited[index]:
                visited[index] = 1
                queue.append(index)
    for y in range(height):
        for x in (0, width - 1):
            index = y * width + x
            if candidate[index] and not visited[index]:
                visited[index] = 1
                queue.append(index)

    while queue:
        index = queue.popleft()
        x, y = index % width, index // width
        for nx, ny in (
            (x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1),
            (x - 1, y - 1), (x + 1, y - 1), (x - 1, y + 1), (x + 1, y + 1),
        ):
            if 0 <= nx < width and 0 <= ny < height:
                neighbor = ny * width + nx
                if candidate[neighbor] and not visited[neighbor]:
                    visited[neighbor] = 1
                    queue.append(neighbor)

    alpha = Image.new("L", (width, height), 255)
    alpha.putdata([0 if value else 255 for value in visited])
    rgba.putalpha(alpha)
    return rgba


def extract_cell(sheet: Image.Image, rows: int, columns: int, cell: int, content_ratio: float) -> Image.Image:
    row, column = divmod(cell, columns)
    if not 0 <= row < rows:
        raise ValueError(f"cell {cell} is outside {columns} x {rows} sheet")
    left = round(column * sheet.width / columns)
    right = round((column + 1) * sheet.width / columns)
    top = round(row * sheet.height / rows)
    bottom = top + round((sheet.height / rows) * content_ratio)
    return sheet.crop((left, top, right, bottom))


def normalize_pose(image: Image.Image, frame_size: int) -> Image.Image:
    foreground = edge_connected_background(image)
    bbox = foreground.getchannel("A").getbbox()
    if not bbox:
        raise ValueError("No subject detected after background removal")
    subject = foreground.crop(bbox)
    max_width, max_height = frame_size - 20, frame_size - 20
    scale = min(max_width / subject.width, max_height / subject.height)
    width = max(1, round(subject.width * scale))
    height = max(1, round(subject.height * scale))
    subject = subject.resize((width, height), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (frame_size, frame_size), (0, 0, 0, 0))
    canvas.alpha_composite(subject, ((frame_size - width) // 2, frame_size - height - 8))
    return canvas


MOTIONS: dict[str, list[tuple[float, int, int]]] = {
    "breathe": [(1, 0, 0), (1.005, 0, -1), (1.01, 0, -2), (1.014, 0, -2),
                (1.01, 0, -1), (1.005, 0, 0), (1, 0, 1), (1, 0, 0)],
    "think": [(1, 0, 0), (1, 1, 0), (1.005, 2, -1), (1.01, 2, -1), (1.005, 1, 0), (1, 0, 0)],
    "type": [(1, 0, 0), (1, 0, 1), (1, 1, 0), (1, 1, 1),
             (1, 0, 0), (1, 0, 1), (1, -1, 0), (1, -1, 1)],
    "search": [(1, 0, 0), (1, 1, -1), (1, 2, -1), (1, 1, 0), (1, 0, 0), (1, -1, 0)],
    "celebrate": [(1, 0, 0), (1.015, 0, -6), (1.025, 0, -15), (1.025, 0, -10),
                  (1, 0, 0), (1.01, 0, -4), (1.02, 0, -9), (1, 0, 0)],
    "sleep": [(1, 0, 0), (1.004, 0, 0), (1.008, 0, -1),
              (1.01, 0, -1), (1.006, 0, 0), (1, 0, 0)],
    "still": [(1, 0, 0)],
}


def motion_frame(base: Image.Image, scale: float, dx: int, dy: int) -> Image.Image:
    size = base.width
    if scale == 1 and dx == 0 and dy == 0:
        return base.copy()
    bbox = base.getchannel("A").getbbox()
    if not bbox:
        return base.copy()
    subject = base.crop(bbox)
    width, height = round(subject.width * scale), round(subject.height * scale)
    subject = subject.resize((width, height), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", base.size, (0, 0, 0, 0))
    x = (size - width) // 2 + dx
    y = size - height - 8 + dy
    canvas.alpha_composite(subject, (x, y))
    return canvas


def build(config_path: Path) -> None:
    config = json.loads(config_path.read_text(encoding="utf-8"))
    sheet = Image.open(ROOT / config["source"]).convert("RGB")
    output_dir = ROOT / "public" / "panda"
    source_manifest = ROOT / "src" / "components" / "panda-pet" / "manifest.json"
    output_dir.mkdir(parents=True, exist_ok=True)
    source_manifest.parent.mkdir(parents=True, exist_ok=True)
    size = int(config["frameSize"])
    manifest = {}

    for name, action in config["actions"].items():
        cell = extract_cell(sheet, config["rows"], config["columns"], action["cell"],
                            action.get("contentHeightRatio", config["contentHeightRatio"]))
        base = normalize_pose(cell, size)
        sequence = MOTIONS[action["motion"]]
        if len(sequence) != action["frames"]:
            raise ValueError(f"{name}: frame count does not match motion profile")
        strip = Image.new("RGBA", (size * len(sequence), size), (0, 0, 0, 0))
        for index, (scale, dx, dy) in enumerate(sequence):
            strip.alpha_composite(motion_frame(base, scale, dx, dy), (index * size, 0))
        filename = f"{name}.webp"
        strip.save(output_dir / filename, "WEBP", lossless=True, method=6)
        manifest[name] = {
            "src": f"/panda/{filename}", "frames": len(sequence), "fps": action["fps"],
            "loop": action["loop"], "frameWidth": size, "frameHeight": size,
        }
        print(f"{name}: cell {action['cell']}, {len(sequence)} frames, {(output_dir / filename).stat().st_size:,} bytes")

    serialized = json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
    (output_dir / "manifest.json").write_text(serialized, encoding="utf-8")
    source_manifest.write_text(serialized, encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    build(parser.parse_args().config.resolve())
