from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / ".local/dashhub"
OUTPUT = ROOT / "web/assets/projects/dashhub"
SCREENS = (
    "timeline", "code-review", "missions", "study-analysis",
    "skill-tree", "skill-map", "skill-detail", "roadmap",
)


def encode(slug):
    with Image.open(SOURCE / f"{slug}.png") as image:
        if image.size not in {(2880, 1704), (2048, 1211)}:
            raise ValueError(f'Unexpected screenshot dimensions for {slug}: {image.size}')
        width, height = image.size
        crop_top = round(width * 172 / 2048)
        image = image.convert('RGB').crop((0, crop_top, width, height))
        result = []
        for size, target, quality in [('preview', 1040, 83), ('full', width, 91)]:
            view = image if target == width else image.resize(
                (target, round(image.height * target / width)), Image.Resampling.LANCZOS)
            output = BytesIO()
            view.save(output, format='WEBP', quality=quality, method=5)
            result.append((f"{slug}-{size}.webp", output.getvalue()))
        return result

def main():
    with ThreadPoolExecutor(max_workers=4) as pool:
        images = list(pool.map(encode, SCREENS))
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(dir=OUTPUT) as temp:
        for pair in images:
            for name, data in pair:
                stage = Path(temp) / name
                stage.write_bytes(data)
                stage.replace(OUTPUT / name)
    print(f"Updated {len(images)} gallery screens in {OUTPUT}.")


if __name__ == '__main__':
    main()
