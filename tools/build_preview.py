"""Build a local preview of the full portfolio."""
import base64
import mimetypes
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"
mimetypes.add_type("image/webp", ".webp")


def embedded(path):
    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    return "data:" + mime + ";base64," + base64.b64encode(path.read_bytes()).decode("ascii")


def main():
    page = (WEB / "index.html").read_text(encoding="utf-8")

    def resource(match):
        attribute, name = match.groups()
        path = WEB / name
        if not path.is_file():
            raise FileNotFoundError(path)
        # Keep large, on-demand media beside the preview to avoid loading it on entry.
        url = "../web/" + name if attribute == "data-full-src" or path.suffix == ".mp4" else embedded(path)
        return f'{attribute}="{url}"'

    page = re.sub(r'\b(src|href|poster|data-src|data-full-src)="(assets/[^"]+|favicon\.ico)"', resource, page)

    def stylesheet(match):
        path = WEB / match[1]
        css = path.read_text(encoding="utf-8")
        css = re.sub(r'url\("([.][.]/assets/[^"]+)"\)', lambda m: f'url("{embedded(path.parent / m[1])}")', css)
        return "<style>\n" + css + "\n</style>"

    page = re.sub(r'<link rel="stylesheet" href="([^"]+)">', stylesheet, page)
    scripts = re.findall(r'<script defer src="([^"]+)"></script>', page)
    page = re.sub(r'\s*<script defer src="[^"]+"></script>', "", page)
    code = "\n".join("<script>\n" + (WEB / name).read_text(encoding="utf-8") + "\n</script>" for name in scripts)
    page = page.replace("</body>", code + "\n</body>")
    output = ROOT / ".local/portfolio-preview.html"
    output.parent.mkdir(exist_ok=True)
    output.write_bytes(page.encode("utf-8"))


if __name__ == "__main__":
    main()
