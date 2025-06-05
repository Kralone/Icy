from fastapi import FastAPI, Request
import uvicorn
import asyncio
import discord

app = FastAPI()
bot = None  # défini depuis l’extérieur

# Fonction async qui envoie le message
async def send_password_message(discord_id, temp_password):
    try:
        user = await bot.fetch_user(discord_id)
        if user:
            await user.send(
                f"🔐 Ton mot de passe temporaire est : **{temp_password}**\n"
                f"Pense à le changer dès que possible dès ta connexion sur le site !"
            )
    except Exception as e:
        print(f"[ERROR] Impossible d'envoyer le mot de passe temporaire à {discord_id} : {e}")

@app.post("/notify-password")
async def notify_password(req: Request):
    data = await req.json()
    discord_id = int(data["discordId"])
    temp_password = data["tempPassword"]

    # Lance la coroutine dans la boucle event loop du bot
    # asyncio.run_coroutine_threadsafe(
    #     send_password_message(discord_id, temp_password),
    #     bot.loop
    # )

    return {"status": "ok"}

# Fonction à appeler depuis bot.py pour lancer le serveur API
def launch_api(discord_bot):
    global bot
    bot = discord_bot
    uvicorn.run(app, host="0.0.0.0", port=8090)
