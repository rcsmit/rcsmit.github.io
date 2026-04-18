from pathlib import Path
import re
import base64
import shutil

# =========================================================
# CONFIG
# =========================================================
BASE_DIR = Path(r"C:\Users\rcxsm\rcsmit.github.io")
EXCLUDED_DIRS = {"evgeny", "luiza", "frank"}

THEME_COLOR = "#111111"
BACKGROUND_COLOR = "#ffffff"

# Tiny placeholder PNGs
ICON_192_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAMAAAADACAIAAADdvvtQAAABMElEQVR4nO3SwQkAIBDAsNP9d9Yh"
    "BKEkE/TZPTMLAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPg1q3sA"
    "AW0M3WQAAAAASUVORK5CYII="
)

ICON_512_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAgAAAAIACAIAAAB7GkOtAAABxElEQVR4nO3BAQ0AAADCoPdPbQ43"
    "oAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD4G1kAAQABl9p6"
    "AAAAAElFTkSuQmCC"
)

# =========================================================
# HELPERS
# =========================================================
def write_binary_from_b64(path: Path, b64_data: str) -> None:
    path.write_bytes(base64.b64decode(b64_data))


def slugify(name: str) -> str:
    value = re.sub(r"[_\\-]+", " ", name).strip()
    return " ".join(word.capitalize() for word in value.split())


def create_manifest(folder: Path) -> None:
    app_name = slugify(folder.name)
    short_name = app_name[:12] if app_name else folder.name[:12]

    manifest = f"""{{
  "name": "{app_name}",
  "short_name": "{short_name}",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "orientation": "portrait-primary",
  "theme_color": "{THEME_COLOR}",
  "background_color": "{BACKGROUND_COLOR}",
  "icons": [
    {{
      "src": "icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    }},
    {{
      "src": "icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }}
  ]
}}
"""
    (folder / "manifest.webmanifest").write_text(manifest, encoding="utf-8")


def create_service_worker(folder: Path) -> None:
    sw = """const CACHE_NAME = 'pwa-cache-v1';
const URLS_TO_CACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(URLS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
        });
        return response;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
"""
    (folder / "sw.js").write_text(sw, encoding="utf-8")

from PIL import Image

def generate_icons_from_favicon(folder: Path) -> bool:
    favicon = folder / "favicon.ico"
    if not favicon.exists():
        return False

    try:
        img = Image.open(favicon)

        # Pick largest frame if ICO has multiple sizes
        if hasattr(img, "n_frames"):
            best = None
            best_size = 0
            for i in range(img.n_frames):
                img.seek(i)
                size = img.size[0] * img.size[1]
                if size > best_size:
                    best_size = size
                    best = img.copy()
            img = best

        img = img.convert("RGBA")

        icon192 = img.resize((192, 192), Image.LANCZOS)
        icon512 = img.resize((512, 512), Image.LANCZOS)

        icon192.save(folder / "icon-192.png", format="PNG")
        icon512.save(folder / "icon-512.png", format="PNG")

        return True

    except Exception as e:
        print(f"ICON ERROR {folder.name}: {e}")
        return False


def ensure_icons(folder: Path) -> None:
    icon192 = folder / "icon-192.png"
    icon512 = folder / "icon-512.png"

    if icon192.exists() and icon512.exists():
        return

    # Try favicon first
    if generate_icons_from_favicon(folder):
        return

    # Fallback
    if not icon192.exists():
        write_binary_from_b64(icon192, ICON_192_B64)
    if not icon512.exists():
        write_binary_from_b64(icon512, ICON_512_B64)


def inject_into_head(html: str, snippet: str) -> str:
    if snippet in html:
        return html
    if "</head>" in html:
        return html.replace("</head>", f"{snippet}\n</head>", 1)
    return snippet + "\n" + html


def inject_into_body(html: str, snippet: str) -> str:
    if snippet in html:
        return html
    if "</body>" in html:
        return html.replace("</body>", f"{snippet}\n</body>", 1)
    return html + "\n" + snippet


def get_backup_path(index_file: Path) -> Path:
    folder = index_file.parent
    candidate = folder / "index.pre_pwa_backup.html"

    if not candidate.exists():
        return candidate

    i = 1
    while True:
        candidate = folder / f"index.pre_pwa_backup_{i}.html"
        if not candidate.exists():
            return candidate
        i += 1


def create_backup(index_file: Path) -> Path:
    backup_path = get_backup_path(index_file)
    shutil.copy2(index_file, backup_path)
    return backup_path


def patch_index_html(folder: Path) -> tuple[bool, str]:
    index_file = folder / "index.html"
    if not index_file.exists():
        return False, "no index.html found"

    html = index_file.read_text(encoding="utf-8", errors="ignore")
    original = html

    manifest_block = f"""  <link rel="manifest" href="manifest.webmanifest">
  <meta name="theme-color" content="{THEME_COLOR}">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <link rel="apple-touch-icon" href="icon-192.png">"""

    sw_block = """<script>
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker registered', reg.scope))
      .catch(err => console.error('Service Worker registration failed', err));
  });
}
</script>"""

    if 'rel="manifest"' not in html:
        html = inject_into_head(html, manifest_block)

    if "navigator.serviceWorker.register('./sw.js')" not in html:
        html = inject_into_body(html, sw_block)

    if html == original:
        return True, "already patched"

    backup_path = create_backup(index_file)
    index_file.write_text(html, encoding="utf-8")
    return True, f"patched with backup: {backup_path.name}"


def process_folder(folder: Path) -> str:
    if not folder.is_dir():
        return f"SKIP  {folder.name:<20} not a directory"

    if folder.name.lower() in EXCLUDED_DIRS:
        return f"SKIP  {folder.name:<20} excluded"

    create_manifest(folder)
    create_service_worker(folder)
    ensure_icons(folder)

    ok, message = patch_index_html(folder)

    if ok:
        return f"OK    {folder.name:<20} {message}"
    return f"WARN  {folder.name:<20} {message}"


# =========================================================
# MAIN
# =========================================================
def main() -> None:
    if not BASE_DIR.exists():
        print(f"Base directory does not exist: {BASE_DIR}")
        return

    print(f"Scanning: {BASE_DIR}")
    print("-" * 80)

    for item in sorted(BASE_DIR.iterdir(), key=lambda p: p.name.lower()):
        if item.is_dir():
            print(process_folder(item))

    print("-" * 80)
    print("Done.")


if __name__ == "__main__":
    main()