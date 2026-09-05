import unittest
from unittest.mock import AsyncMock, MagicMock

from discord import app_commands

from cogs.user import UserCog


class UserCommandTest(unittest.IsolatedAsyncioTestCase):
    def make_command(self):
        api_client = MagicMock()
        api_client.api_request = AsyncMock()
        bot = MagicMock()
        bot.get_cog.return_value = api_client
        cog = UserCog(bot)

        interaction = MagicMock()
        interaction.response.defer = AsyncMock()
        interaction.followup.send = AsyncMock()

        member = MagicMock()
        member.id = 123456789
        member.name = "discord_handle"
        member.mention = "<@123456789>"
        return cog, api_client, interaction, member

    async def test_creates_user_with_selected_role_and_discord_handle(self):
        cog, api_client, interaction, member = self.make_command()
        api_client.api_request.return_value = {
            "httpCode": 201,
            "messageDetail": {"title": "Compte créé", "message": "Bienvenue"},
        }

        await cog.ajouter_utilisateur.callback(
            cog,
            interaction,
            member,
            app_commands.Choice(name="Ingénieur", value="INGENIEUR"),
        )

        interaction.response.defer.assert_awaited_once_with(ephemeral=True)
        api_client.api_request.assert_awaited_once_with(
            "POST",
            "api/users/bot/create",
            {
                "discordId": "123456789",
                "username": "discord_handle",
                "role": "INGENIEUR",
            },
        )
        sent_embed = interaction.followup.send.await_args.kwargs["embed"]
        self.assertIn("discord\\_handle", sent_embed.description)
        self.assertIn("Ingénieur", sent_embed.description)
        self.assertIn("<@123456789>", sent_embed.description)
        self.assertNotIn("{0}", sent_embed.description)

    async def test_uses_trimmed_optional_pseudonym(self):
        cog, api_client, interaction, member = self.make_command()
        api_client.api_request.return_value = {
            "httpCode": 201,
            "messageDetail": {"title": "Compte créé", "message": "Bienvenue"},
        }

        await cog.ajouter_utilisateur.callback(
            cog,
            interaction,
            member,
            app_commands.Choice(name="Junior", value="JUNIOR"),
            "  Pseudo SC  ",
        )

        payload = api_client.api_request.await_args.args[2]
        self.assertEqual("Pseudo SC", payload["username"])

    async def test_rejects_invalid_pseudonym_without_backend_call(self):
        cog, api_client, interaction, member = self.make_command()

        await cog.ajouter_utilisateur.callback(
            cog,
            interaction,
            member,
            app_commands.Choice(name="Junior", value="JUNIOR"),
            "   ",
        )

        api_client.api_request.assert_not_awaited()
        interaction.followup.send.assert_awaited_once_with(
            "Le pseudo doit contenir entre 1 et 50 caractères.",
            ephemeral=True,
        )

    async def test_backend_conflict_is_reported_to_invoker(self):
        cog, api_client, interaction, member = self.make_command()
        api_client.api_request.return_value = {
            "httpCode": 409,
            "messageDetail": {"title": "Compte existant", "message": "Déjà inscrit"},
        }

        await cog.ajouter_utilisateur.callback(
            cog,
            interaction,
            member,
            app_commands.Choice(name="Junior", value="JUNIOR"),
        )

        sent_embed = interaction.followup.send.await_args.kwargs["embed"]
        self.assertEqual("Compte existant", sent_embed.title)
        self.assertEqual("Déjà inscrit", sent_embed.description)


if __name__ == "__main__":
    unittest.main()
