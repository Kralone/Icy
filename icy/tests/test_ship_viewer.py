import unittest
from unittest.mock import AsyncMock

from cogs.ship_viewer import ShipViewer


class ShipViewerTest(unittest.IsolatedAsyncioTestCase):
    async def test_fetches_ships_through_bot_endpoint(self):
        api_client = AsyncMock()
        api_client.api_request.return_value = {
            "httpCode": 200,
            "data": [{"id": 42, "name": "Prospector"}],
        }
        view = ShipViewer(api_client, 123456789)

        await view.fetch_ships()

        api_client.api_request.assert_awaited_once_with(
            "GET", "api/user-ships/bot?discordId=123456789"
        )
        self.assertEqual(42, view.ships[0]["id"])

    async def test_malformed_backend_response_disables_view(self):
        api_client = AsyncMock()
        api_client.api_request.return_value = {"httpCode": 200, "data": None}
        view = ShipViewer(api_client, 123456789)

        await view.fetch_ships()

        self.assertEqual([], view.ships)
        self.assertTrue(all(item.disabled for item in view.children))

    async def test_other_user_cannot_delete_ship(self):
        api_client = AsyncMock()
        view = ShipViewer(api_client, 123456789)
        view.ships = [{"id": 42, "name": "Prospector"}]
        interaction = AsyncMock()
        interaction.user.id = 987654321

        delete_button = view.children[1]
        await delete_button.callback(interaction)

        api_client.api_request.assert_not_awaited()
        interaction.response.send_message.assert_awaited_once_with(
            "Cette liste de vaisseaux ne vous appartient pas.", ephemeral=True
        )

    async def test_stale_empty_view_does_not_divide_by_zero(self):
        api_client = AsyncMock()
        view = ShipViewer(api_client, 123456789)
        interaction = AsyncMock()
        interaction.user.id = 123456789

        next_button = view.children[2]
        await next_button.callback(interaction)

        interaction.response.send_message.assert_awaited_once_with(
            "Aucun vaisseau n'est disponible.", ephemeral=True
        )


if __name__ == "__main__":
    unittest.main()
