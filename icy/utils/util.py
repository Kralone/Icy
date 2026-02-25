import discord
class Util:
    def __init__(self):
        self.allowed_roles = {682666307300491265}

        self.predefined_messages = {
            "no_permission": "Vous n'avez pas la permission d'utiliser cette commande.",
            "not_registered": "Vous devez d'abord être enregistrés pour accéder à cette commande.",
            "welcome": "Bienvenue sur le serveur ! Nous sommes ravis de vous accueillir.",
            "rules": "Voici les règles du serveur : 1. Respectez les autres 2. Pas de spam 3. Amusez-vous !",
            "help": "Besoin d'aide ? Utilisez /commands pour voir la liste des commandes disponibles."
        }

    def get_allowed_roles(self):
        return self.allowed_roles

    def get_message(self, message_key: str):
        message = self.predefined_messages.get(message_key.lower())
        if message:
            return message
        else:
            return "Clé de message invalide. Utilisez une clé valide comme 'welcome', 'rules' ou 'help'."


