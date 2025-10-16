# Discord WoW Classes & Professions Tracker Bot

This Discord bot tracks **World of Warcraft classes, specializations, and professions** of users on your server. It does **not assign roles**; instead, it reads users’ existing roles and provides statistics and summaries.

---

## Features
- Uses **Discord emojis** for icons; make sure to upload them to your server with the corresponding names, e.g., `:warrior:`, `:priest:`, `:tank:`, `:dps:`, `:healer:`, `:mining:`, `:cooking:`, etc.
- Tracks original 9 **classes** (`Warrior`, `Priest`, etc.) based on user roles.
- Tracks **specializations** (`Tank`, `DPS`, `Healer`).
- Tracks **professions** (`Mining`, `Cooking`, etc.).
- Generates statistics for the number of users per class, specialization, or profession.
- Supports **custom Discord emojis** for nicer visualization.

---

## Screenshots

### Bot Track Classes and Specializations
![Bot Screenshot 1](images/discbot.jpg)

### Bot Track Professions
![Bot Screenshot 2](images/discbot2.jpg)

---

## Classes & Specializations

| Class     | Tank | DPS | Healer |
|-----------|:----:|:---:|:------:|
| Warrior   | ✅   | ✅  |        |
| Paladin   | ✅   | ✅  | ✅     |
| Druid     | ✅   | ✅  | ✅     |
| Hunter    |      | ✅  |        |
| Mage      |      | ✅  |        |
| Rogue     |      | ✅  |        |
| Shaman    | ✅   | ✅  | ✅     |
| Priest    |      |     | ✅     |
| Warlock   |      | ✅  |        |

> ✅ = Class can perform this specialization.  

---

## Professions

| Profession       | Emoji Example  |
|-----------------|----------------|
| Alchemy         | `:alchemy:`    |
| Blacksmithing   | `:blacksmithing:` |
| Herbalism       | `:herbalism:`  |
| Mining          | `:mining:`     |
| Engineering     | `:engineering:`|
| Skinning        | `:skinning:`   |
| Leatherworking  | `:leatherworking:` |
| Enchanting      | `:enchanting:` |
| Tailoring       | `:tailoring:`  |
| Cooking         | `:cooking:`    |
| Fishing         | `:fishing:`    |
| FirstAid        | `:firstaid:`   |
| Woodcutting     | `:woodcutting:`|

---

## How to Install

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/yourrepo.git
cd yourrepo
npm install
```

2. **Create a `.env` file** in the root folder:

```env
TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_app_client_id
GUILD_ID=your_discord_server_id
```

3. **Upload required Discord emojis**  
Add emojis to your server with the following names (matching the bot icons):  
`:warrior:`, `:priest:`, `:tank:`, `:dps:`, `:healer:`, `:mining:`, `:cooking:`, etc.

4. **Run the bot**
```bash
node bot.js
```

5. **Verify bot activity**  
The bot will update its status dynamically and respond to slash commands:  
`/roleinfo`, `/professions`, `/help`.

---

## Notes
- The bot only reads roles; it does not assign them.  
- All emojis must exist on your Discord server.  
- Statistics are updated in real-time based on current roles.  
- Classes, specializations, and professions are matched by role names; make sure roles exist and are correctly named in your server.  

---

## Example `.env.example`

```env
# Discord Bot Token
TOKEN=YOUR_BOT_TOKEN_HERE

# Discord Application Client ID
CLIENT_ID=YOUR_CLIENT_ID_HERE

# Discord Server (Guild) ID
GUILD_ID=YOUR_GUILD_ID_HERE
```
