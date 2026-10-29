"""Build small, licensed WOFF2 subsets of the TW GenSen Rounded M/B fonts.

The complete 16MB OTF files are downloaded only during CI and are never
committed to our repository. Only the glyphs currently used by this static
website are included in the published WOFF2 files. Source font and license:
https://github.com/ButTaiwan/gensen-font (SIL Open Font License 1.1).
"""
from io import BytesIO
from pathlib import Path
from urllib.request import urlopen
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "fonts"
# Pin the upstream revision for reproducible deployments.
UPSTREAM = "https://raw.githubusercontent.com/ButTaiwan/gensen-font/d347d3fffcb45e08857052433a0b432ed4f7ace8/"
FONT_PATH = "otf/TW/"
WEIGHTS = ("M", "B")
SOURCE_SUFFIXES = {".astro", ".md", ".mdx", ".ts", ".tsx", ".js", ".css", ".txt", ".csv", ".yml", ".json"}

def fetch(url: str) -> bytes:
    with urlopen(url, timeout=120) as response:
        return response.read()

def text_codepoints() -> set[int]:
    characters = set(chr(i) for i in range(32, 127))
    for folder in (ROOT / "src", ROOT / "public"):
        if folder.exists():
            for file in folder.rglob("*"):
                if file.is_file() and file.suffix.lower() in SOURCE_SUFFIXES:
                    characters.update(file.read_text(encoding="utf-8-sig", errors="replace"))
    characters.update("臺灣地方實踐指南源泉圓體繁體中文年月日：，。「」『』、！？（）──")
    return {ord(char) for char in characters}

def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    chars = sorted(text_codepoints())
    print(f"Webfont subset: {len(chars)} distinct characters")
    for weight in WEIGHTS:
        filename = f"GenSenRounded2TW-{weight}"
        data = fetch(f"{UPSTREAM}{FONT_PATH}{filename}.otf")
        font = TTFont(BytesIO(data))
        options = subset.Options()
        options.layout_features = ["*"]
        options.notdef_glyph = True
        options.notdef_outline = True
        subs = subset.Subsetter(options=options)
        subs.populate(unicodes=chars)
        subs.subset(font)
        font.flavor = "woff2"
        output = OUT / f"{filename}.woff2"
        font.save(output)
        print(f"{filename}: {len(data):,} OTF bytes -> {output.stat().st_size:,} WOFF2 bytes")
    (OUT / "SIL_Open_Font_License_1.1.txt").write_bytes(
        fetch(UPSTREAM + "SIL_Open_Font_License_1.1.txt")
    )
    print("Font license copied to public/fonts/")

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Font generation failed: {exc}", file=sys.stderr)
        raise
