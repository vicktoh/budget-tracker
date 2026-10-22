"""Mirror the state BIR PDFs listed in sources.json.

Usage: python3 -I scripts/bir/download.py scripts/bir/sources.json tmp/bir-pdfs

Writes <out>/<fy>-Q<q>.pdf plus <out>/manifest.json (sha256, bytes, pages).
Idempotent: existing files are re-hashed, not re-downloaded.
"""
import hashlib
import json
import subprocess
import sys
import urllib.request
from pathlib import Path


def main(sources_path: str, out_dir: str) -> None:
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    manifest = []
    for src in json.loads(Path(sources_path).read_text()):
        slug = f"{src['fiscal_year']}-Q{src['quarter']}"
        if src.get("full_year"):
            slug = f"{src['fiscal_year']}-FY"
        target = out / f"{slug}.pdf"
        if not target.exists():
            req = urllib.request.Request(src["url"], headers={"User-Agent": "kanohealthbudget.org archive mirror"})
            with urllib.request.urlopen(req, timeout=180) as resp:
                target.write_bytes(resp.read())
        data = target.read_bytes()
        if not data.startswith(b"%PDF"):
            raise SystemExit(f"{slug}: not a PDF ({src['url']})")
        info = subprocess.run(["pdfinfo", str(target)], capture_output=True, text=True).stdout
        pages = next((int(l.split()[-1]) for l in info.splitlines() if l.startswith("Pages:")), None)
        manifest.append({**src, "slug": slug, "file": target.name, "bytes": len(data),
                         "sha256": hashlib.sha256(data).hexdigest(), "pages": pages})
        print(slug, len(data), pages)
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main(*sys.argv[1:3])
