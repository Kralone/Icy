from bs4 import BeautifulSoup
import re

def html_to_discord(html: str) -> str:
    """
    Convertit du HTML basique en Markdown compatible Discord.
    """
    if not html:
        return ""

    soup = BeautifulSoup(html, "html.parser")

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

    # Supprimer les balises HTML restantes
    text = soup.get_text()

    # Nettoyage des espaces multiples et retours
    text = re.sub(r'\n\s*\n', '\n\n', text.strip())

    return text
