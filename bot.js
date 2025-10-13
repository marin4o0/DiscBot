const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require("discord.js");
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

const CLIENT_ID = "1427092918178676878";
const GUILD_ID = "1424701361672552529"; // сложи ID на сървъра
const TOKEN = "MTQyNzA5MjkxODE3ODY3Njg3OA.GGPl01.g8w1c8fd1eqKajJOVtzsI6ytaf6_5igz6e8roY";

const wowClasses = [
  "Druid","Hunter","Mage","Paladin","Priest","Rogue","Shaman","Warlock","Warrior"
];

const categories = ["DPS", "Tank", "Healer"];

const validClasses = {
  DPS: ["Druid","Hunter","Mage","Paladin","Rogue","Shaman","Warlock","Warrior"],
  Tank: ["Druid","Paladin","Warrior","Shaman"],
  Healer: ["Druid","Paladin","Priest","Shaman"]
};

// ---------------- Регистрация на Slash команда ----------------
const commands = [
  new SlashCommandBuilder()
    .setName("roleinfo")
    .setDescription("Показва WoW класове по роля")
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log("⚡ Регистриране на /roleinfo команда...");
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log("✅ Командата е регистрирана!");
  } catch (err) {
    console.error(err);
  }
})();

// ---------------- Логика на командата ----------------
client.on("interactionCreate", async interaction => {
  if (!interaction.isCommand()) return;
  if (interaction.commandName !== "roleinfo") return;

  const guild = await client.guilds.fetch(GUILD_ID);
  await guild.members.fetch();

  let message = "";

  for (const category of categories) {
    let categoryMessage = `**${category}**\n`;

    for (const cls of wowClasses.sort()) {
      // Пропускаме класове, които не могат да играят тази роля
      if (!validClasses[category].includes(cls)) continue;

      const classRole = guild.roles.cache.find(r => r.name.toLowerCase() === cls.toLowerCase());
      const categoryRole = guild.roles.cache.find(r => r.name.toLowerCase() === category.toLowerCase());
      const altRole = guild.roles.cache.find(r => r.name.toLowerCase() === `${cls.toLowerCase()}-alt`);

      if (!classRole || !categoryRole) continue;

      // Филтрираме основните членове (без алтове)
      const members = classRole.members.filter(m =>
        m.roles.cache.has(categoryRole.id) &&
        (!altRole || !m.roles.cache.has(altRole.id))
      );

      // Показваме само ако има поне 1 член
      if (members.size > 0) {
        categoryMessage += `> ${cls} - ${members.size}\n`;
      }
    }

    // Добавяме само ако има класове с >0 членове
    if (categoryMessage.trim() !== `**${category}**`) {
      message += categoryMessage + "\n";
    }
  }

  if (!message) message = "Няма данни за роли и класове.";

  await interaction.reply({ content: message, ephemeral: false });
});

// ---------------- Логин ----------------
client.once("ready", () => {
  console.log(`✅ Логнат като ${client.user.tag}`);
});

client.login(TOKEN);