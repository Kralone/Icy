from bs4 import BeautifulSoup
import re
from urllib.parse import urlparse, quote

def html_to_discord(html: str) -> str:
    """
    Convertit du HTML basique en Markdown compatible Discord.
    """
    if not html:
        return ""

    soup = BeautifulSoup(html, "html.parser")

    # 🔹 <br> → saut de ligne
    for br in soup.find_all("br"):
        br.replace_with("\n")

    # <b> ou <strong> → **gras**
    for b in soup.find_all(["b", "strong"]):
        b.insert_before("**")
        b.insert_after("**")

    # <i> ou <em> → *italique*
    for i in soup.find_all(["i", "em"]):
        i.insert_before("*")
        i.insert_after("*")

    # <u> → __souligné__
    for u in soup.find_all("u"):
        u.insert_before("__")
        u.insert_after("__")

    # <font color="..."> → ajoute un emoji coloré (approximation)
    for font in soup.find_all("font"):
        color = font.get("color")
        if color:
            color = color.strip().lower()
            font.insert_before(f"🎨({color}) ")

    # Preserve source links and paragraph boundaries in news embeds.
    for link in soup.find_all("a"):
        href = (link.get("href") or "").strip()
        try:
            parsed = urlparse(href)
            valid = parsed.scheme in ("http", "https") and parsed.hostname and not parsed.username
        except ValueError:
            valid = False
        if valid:
            label = link.get_text().replace("[", "\\[").replace("]", "\\]")
            safe_url = quote(href, safe=":/?#=&%+@,;~!$*'-._")
            link.replace_with(f"[{label}]({safe_url})")
    for paragraph in soup.find_all("p"):
        paragraph.insert_after("\n\n")

    # Supprimer les balises HTML restantes
    text = soup.get_text()

    # Nettoyage des espaces multiples et retours
    text = re.sub(r'\n\s*\n', '\n\n', text.strip())

    return text
