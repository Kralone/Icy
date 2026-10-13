import os

PRODUCTION_URL = "https://iceforge.fr"


def public_base_url() -> str:
    """Adresse du site dans les liens envoyés sur Discord.

    Chaque environnement donne la sienne par ICEFORGE_PUBLIC_URL. La production est la valeur par défaut :
    un environnement de test qui ne la renseigne pas enverrait ses membres sur le site réel.
    """
    return (os.getenv("ICEFORGE_PUBLIC_URL") or PRODUCTION_URL).strip().rstrip("/")
