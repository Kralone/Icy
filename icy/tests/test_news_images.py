import unittest
from messaging.news_handler import NewsHandler
from utils.html_to_discord import html_to_discord

class NewsImageTest(unittest.TestCase):
    def test_article_image_precedes_type_image(self):
        self.assertEqual('https://media.robertsspaceindustries.com/article.jpg', NewsHandler._image_url({
            'imageUrl': 'https://media.robertsspaceindustries.com/article.jpg',
            'type': {'imageUrl': 'https://example.com/type.jpg'}}))

    def test_invalid_article_falls_back_and_relative_image_is_not_sent_to_discord(self):
        self.assertEqual('https://example.com/type.jpg', NewsHandler._image_url({
            'imageUrl': 'javascript:bad', 'type': {'imageUrl': 'https://example.com/type.jpg'}}))
        self.assertIsNone(NewsHandler._image_url({'type': {'imageUrl': '/images/news.png'}}))
        self.assertIsNone(NewsHandler._image_url({}))

    def test_news_source_link_and_paragraph_survive_conversion(self):
        self.assertEqual('Texte français.\n\n[Source : RSI](https://robertsspaceindustries.com/en/comm-link/1)',
                         html_to_discord('<p>Texte français.</p><p><a href="https://robertsspaceindustries.com/en/comm-link/1">Source : RSI</a></p>'))

    def test_unsafe_link_keeps_only_its_label(self):
        self.assertEqual('Source', html_to_discord('<a href="javascript:alert(1)">Source</a>'))
