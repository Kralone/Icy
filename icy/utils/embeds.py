import discord

class EmbedFactory:
    """Classe utilitaire pour générer des embeds Discord."""

    @staticmethod
    def success_embed(title: str = "Success", description: str = "ça va bien se passer", image_url: str = None, thumbnail_url: str = None):
        """Embed pour les messages de succès."""
        embed = discord.Embed(
            title=title,
            description=description,
            color=discord.Color.green()
        )

        if image_url:
            embed.set_image(url=image_url)

        if thumbnail_url:
            embed.set_thumbnail(url=thumbnail_url)

        return embed

    @staticmethod
    def error_embed(title: str = "Oups...", description: str = "Une erreur s'est produite.", image_url: str = None, thumbnail_url: str = None):
        """Embed pour les messages d'erreur."""
        embed = discord.Embed(
            title=title,
            description=description,
            color=discord.Color.red()
        )

        if image_url:
            embed.set_image(url=image_url)

        if thumbnail_url:
            embed.set_thumbnail(url=thumbnail_url)

        return embed

    @staticmethod
    def no_permission_embed():
        embed = discord.Embed(
            title="Mais tu vas où ?",
            description="Vous n'avez pas la permission d'utiliser cette commande.",
            color=discord.Color.red()
        )
        return embed

    @staticmethod
    def info_embed(title: str = "Info", description: str = "ça va bien se passer", image_url: str = None, thumbnail_url: str = None):
        """Embed pour les messages d'information."""
        embed = discord.Embed(
            title=title,
            description=description,
            color=discord.Color.blue()
        )

        if image_url:
            embed.set_image(url=image_url)

        if thumbnail_url:
            embed.set_thumbnail(url=thumbnail_url)

        return embed

    @staticmethod
    def ship_list_embed(ships, author: discord.User):
        """Embed pour lister les vaisseaux d'un utilisateur."""
        embed = discord.Embed(
            title="Liste de vos vaisseaux",
            color=discord.Color.green()
        )

        if not ships:
            embed.description = "Aucun vaisseau trouvé."
        else:
            for s in ships:
                embed.add_field(name=f"{s['name']} ({s['brand']})", value=f"ID: {s['id']}", inline=False)

        embed.set_footer(text=f"Demandé par {author.name}", icon_url=author.avatar.url)
        return embed
