import uuid

import discord
import asyncpg
import os
from dotenv import load_dotenv

# Charger les variables d'environnement
load_dotenv()

database_url = os.getenv("DATABASE_URL")

class Database:
    _instance = None

    def __init__(self):
        if Database._instance is not None:
            raise Exception("Cette classe est un singleton. Utilisez get_instance().")
        self.connection = None
        Database._instance = self

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = Database()
        return cls._instance

    async def connect(self):
        """Établit une connexion avec la base de données."""
        if self.connection is None:
            self.connection = await asyncpg.connect(database_url)

    async def close(self):
        """Ferme la connexion à la base de données."""
        if self.connection:
            await self.connection.close()
            self.connection = None

    async def init_db(self):
        """Initialise les tables dans la base de données si elles n'existent pas."""
        queries = [
            '''
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                username TEXT NOT NULL,
                discord_id BIGINT UNIQUE NOT NULL,
                rank TEXT NOT NULL DEFAULT 'Member',
                created_at TIMESTAMP DEFAULT now()
            );
            ''',
            '''
            CREATE TABLE IF NOT EXISTS ship_user(
                user_id UUID NOT NULL,
                ship_id INT NOT NULL,
                PRIMARY KEY (user_id, ship_id),
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (ship_id) REFERENCES ship_data(id)
            );
            ''',
            '''
            CREATE TABLE IF NOT EXISTS brand (
                id SERIAL PRIMARY KEY,
                nom TEXT NOT NULL,
                image TEXT
            );
            ''',
            '''
            create table IF NOT EXISTS ship_data (
                id SERIAL PRIMARY KEY,
                name        text NOT NULL,
                brand       text NOT NULL,
                focus       text,
                scu         integer,
                size        text,
                crew        text,
                flight_ready boolean,
                image_url   text NOT NULL
            );
            ''',
            '''
            CREATE TABLE IF NOT EXISTS events (
                id UUID PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                activity_type TEXT NOT NULL,
                event_date DATE NOT NULL,
                event_time TIME NOT NULL,
                location TEXT NOT NULL,
                is_finished BOOLEAN DEFAULT FALSE
            );
            ''',
            '''
            CREATE TABLE IF NOT EXISTS event_participants (
                event_id UUID NOT NULL,
                user_id BIGINT NOT NULL,
                status TEXT NOT NULL,
                PRIMARY KEY (event_id, user_id),
                FOREIGN KEY (event_id) REFERENCES events(id)
            );
            '''

        ]
        for query in queries:
            await self.connection.execute(query)

    async def execute_query(self, query: str, *args):
        """Exécute une requête SQL avec des arguments."""
        await self.connection.execute(query, *args)

    async def fetch_query(self, query: str, *args):
        """Récupère une ligne à partir d'une requête SQL."""
        results = await self.fetch_all_query(query, *args)
        if results:
            return results[0]
        return None

    async def fetch_all_query(self, query: str, *args):
        """Récupère plusieurs lignes à partir d'une requête SQL."""
        return await self.connection.fetch(query, *args)

db = Database.get_instance()

async def add_user(username: str, discord_id: int):
    """Ajoute un utilisateur à la base de données."""
    query = "INSERT INTO users (username, discord_id) VALUES ($1, $2) ON CONFLICT (discord_id) DO NOTHING"
    await db.execute_query(query, username, discord_id)

async def add_user_by_mention(mentioned_user: discord.Member):
    """Ajoute un utilisateur en utilisant une mention Discord."""
    username = mentioned_user.name
    discord_id = mentioned_user.id
    await add_user(username, discord_id)
    """Ajoute un utilisateur à la base de données."""
    query = "INSERT INTO users (username, discord_id) VALUES ($1, $2) ON CONFLICT (discord_id) DO NOTHING"
    await db.execute_query(query, username, discord_id)


async def remove_user_by_discord_id(discord_id: int):
    """"Supprime un utilisateur de la base de données via son ID Discord."""
    query = "DELETE FROM users WHERE discord_id = $1"
    await db.execute_query(query, discord_id)

async def get_user_id_by_discord_id(discord_id):
    query = "SELECT id FROM users WHERE discord_id = $1"
    user_record = await db.fetch_query(query, discord_id)
    if user_record:
        return user_record['id']  # Retourne directement l'UUID
    return None

async def get_ship_user_association(user_id: str, ship_id: int):
    """Vérifie si l'association entre l'utilisateur et le vaisseau existe."""
    query = "SELECT * FROM ship_user WHERE user_id = $1 AND ship_id = $2"
    association = await db.fetch_query(query, user_id, ship_id)
    return association

async def add_ship(name: str, brand: str, ship_type: str, user_id: str):
    """Ajoute un vaisseau à un utilisateur."""
    query = "INSERT INTO ships (name, brand, type, user_id) VALUES ($1, $2, $3, $4)"
    await db.execute_query(query, name, brand, ship_type, user_id)

async def remove_ship_by_id(ship_id: int, user_id: str):
    """Supprime un vaisseau par son ID."""
    query = "DELETE FROM ship_user WHERE ship_id = $1 AND user_id = $2"
    await db.execute_query(query, ship_id, user_id)

async def remove_ship_by_name(name: str, user_id: str):
    """Supprime un vaisseau par son nom et son propriétaire."""
    query = "DELETE FROM ships WHERE name = $1 AND user_id = $2"
    await db.execute_query(query, name, user_id)

async def get_user_ships(user_id: str):
    """Récupère tous les vaisseaux d'un utilisateur avec leurs détails, y compris l'image du constructeur."""
    query = """
    SELECT sd.id, sd.name, sd.brand, sd.image_url, b.image AS brand_image_url
    FROM ship_user su
    JOIN ship_data sd ON su.ship_id = sd.id
    JOIN brand b ON sd.brand = b.nom
    WHERE su.user_id = $1
    """
    return await db.fetch_all_query(query, user_id)

async def add_ship_to_user(user_id: int, ship_id: int):
    query = "INSERT INTO ship_user (user_id, ship_id) VALUES ($1, $2)"
    await db.execute_query(query, user_id, ship_id)

async def get_fleet_summary():
    query = """
    SELECT sd.name, sd.focus, COUNT(sd.name) as count
    FROM ship_user su
    JOIN ship_data sd ON su.ship_id = sd.id
    GROUP BY sd.name, sd.focus
    ORDER BY sd.name

    """
    return await db.fetch_all_query(query)
