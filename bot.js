const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require("discord.js");
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

// WoW класове и специализации
const wowClasses = {
  Druid: ["Balance", "Feral", "Restoration"],
  Hunter: ["Beast Mastery", "Marksmanship", "Survival"],
  Mage: ["Arcane", "Fire", "Frost"],
  Paladin: ["Holy", "Protection", "Retribution"],
  Priest: ["Discipline", "Holy", "Shadow"],
  Rogue: ["Assassination", "Combat", "Subtlety"],
  Shaman: ["Elemental", "Enhancement", "Restoration"],
  Warlock: ["Affliction", "Demonology", "Destruction"],
  Warrior: ["Arms", "Fury", "Protection"]
};

// Роли и DPS тип
const rolesInfo = ["Tank", "Healer", "Melee DPS", "Ranged DPS"];
const roleIcons = {
  "Tank": "<:tank:123456789012345678>",
  "Healer": "<:healer:123456789012345678>",
  "Melee DPS": "<:dps:123456789012345678>",
  "Ranged DPS": "<:bow:123456789012345678>"
};

// Статус на рейда
let currentRaid = null;

// ------------------------- СЛАШ КОМАНДИ -------------------------
const commands = [
  new SlashCommandBuilder()
    .setName("roleinfo")
    .setDescription("Показва WoW класове и роли с брой членове")
    .addStringOption(option => option.setName("role").setDescription("Филтрирай по роля (DPS, Tank, Healer)").setRequired(false)
      .addChoices(
        { name: "DPS", value: "DPS" },
        { name: "Tank", value: "Tank" },
        { name: "Healer", value: "Healer" }
      )
    ),
  new SlashCommandBuilder()
    .setName("professions")
    .setDescription("Показва професии и брой членове")
    .addStringOption(option => option.setName("profession").setDescription("Филтрирай по професия").setRequired(false)),
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Показва помощ за командите"),
  new SlashCommandBuilder()
    .setName("create")
    .setDescription("Създава нов рейд")
    .addStringOption(option => option.setName("raidname").setDescription("Име на рейда").setRequired(true))
    .addStringOption(option => option.setName("datetime").setDescription("Дата и час във формат YYYY-MM-DD HH:MM").setRequired(true))
    .addIntegerOption(option => option.setName("maxplayers").setDescription("Максимален брой участници").setRequired(true))
    .addIntegerOption(option => option.setName("maxtanks").setDescription("Максимален брой танкове").setRequired(true))
    .addIntegerOption(option => option.setName("maxhealers").setDescription("Максимален брой хийлъри").setRequired(true))
    .addStringOption(option => option.setName("image").setDescription("Линк към картинка за ембед").setRequired(false))
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log("⚡ Регистриране на командите...");
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log("✅ Командите са регистрирани!");
  } catch (err) {
    console.error(err);
  }
})();

// ------------------------- ФУНКЦИИ -------------------------
function getEmojiByClass(name, guild) {
  const emoji = guild.emojis.cache.find(e => e.name.toLowerCase() === name.toLowerCase());
  return emoji ? emoji.toString() : "•";
}

function createRaidEmbed() {
  if (!currentRaid) return null;
  const embed = new EmbedBuilder()
    .setTitle(`Raid: ${currentRaid.name}`)
    .setDescription(`Дата и час: ${currentRaid.datetime}`)
    .setColor(0x00ff00)
    .setThumbnail(currentRaid.image || null)
    .setTimestamp();

  // Статистика по роли
  let roleLine = "";
  for (const role of rolesInfo) {
    const count = currentRaid.members.filter(m => m.role === role).length;
    roleLine += `${roleIcons[role]} ${role} - ${count}     `;
  }
  embed.addFields({ name: "Статистика по роли", value: roleLine, inline: false });

  // Класове и играчи
  for (const [cls, specs] of Object.entries(wowClasses)) {
    const players = currentRaid.members.filter(m => m.class === cls);
    if (players.length === 0) continue;
    const emoji = getEmojiByClass(cls, currentRaid.guild);
    let value = "";
    for (const player of players) {
      value += `${player.user} \n`;
    }
    embed.addFields({ name: `${emoji} ${cls}`, value, inline: true });
  }
  return embed;
}

// ------------------------- ИНТЕРАКЦИИ -------------------------
client.on("interactionCreate", async interaction => {
  if (!interaction.isCommand()) return;

  const guild = await client.guilds.fetch(GUILD_ID);
  await guild.members.fetch();
  await guild.emojis.fetch();

  if (interaction.commandName === "help") {
    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle("Помощ за командите на WoW Discord бота")
      .setDescription("Тук можеш да видиш как се използват командите на бота")
      .addFields(
        { name: "/roleinfo", value: "Показва WoW роли и класове с брой членове.", inline: false },
        { name: "/professions", value: "Показва професии и брой членове.", inline: false },
        { name: "/create", value: "Създава нов рейд със зададени параметри.", inline: false },
        { name: "/help", value: "Показва тази помощ.", inline: false }
      );
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (interaction.commandName === "create") {
    const raidName = interaction.options.getString("raidname");
    const datetime = interaction.options.getString("datetime");
    const maxPlayers = interaction.options.getInteger("maxplayers");
    const maxTanks = interaction.options.getInteger("maxtanks");
    const maxHealers = interaction.options.getInteger("maxhealers");
    const image = interaction.options.getString("image");

    currentRaid = {
      name: raidName,
      datetime,
      maxPlayers,
      maxTanks,
      maxHealers,
      image,
      members: [],
      guild
    };

    // Създаваме селект меню за добавяне на участници
    const classOptions = Object.keys(wowClasses).map(cls => ({ label: cls, value: cls }));
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("joinRaid")
      .setPlaceholder("Избери клас")
      .addOptions(classOptions);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.reply({ embeds: [createRaidEmbed()], components: [row] });
  }
});

// ------------------------- SELECT MENU -------------------------
client.on("interactionCreate", async interaction => {
  if (!interaction.isStringSelectMenu()) return;
  if (interaction.customId !== "joinRaid") return;
  if (!currentRaid) return;

  const selectedClass = interaction.values[0];
  const specOptions = wowClasses[selectedClass].map(spec => ({ label: spec, value: spec }));
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`spec-${interaction.user.id}`)
    .setPlaceholder("Избери специализация")
    .addOptions(specOptions);

  const row = new ActionRowBuilder().addComponents(selectMenu);
  await interaction.update({ components: [row] });
});

// ------------------------- СПЕЦИАЛИЗАЦИЯ -------------------------
client.on("interactionCreate", async interaction => {
  if (!interaction.isStringSelectMenu()) return;
  if (!interaction.customId.startsWith("spec-")) return;
  if (!currentRaid) return;

  const spec = interaction.values[0];
  const user = interaction.user;

  // Определяне на роля по специализация
  let role = "";
  if (["Holy", "Restoration", "Discipline"].includes(spec)) role = "Healer";
  else if (["Protection"].includes(spec)) role = "Tank";
  else if (["Arms", "Fury", "Combat", "Enhancement"].includes(spec)) role = "Melee DPS";
  else role = "Ranged DPS";

  // Проверка за дублиране
  if (currentRaid.members.some(m => m.id === user.id)) {
    await interaction.reply({ content: "Вече си записан!", ephemeral: true });
    return;
  }

  // Проверка за лимити
  const totalCount = currentRaid.members.length;
  const tanksCount = currentRaid.members.filter(m => m.role === "Tank").length;
  const healersCount = currentRaid.members.filter(m => m.role === "Healer").length;
  if (totalCount >= currentRaid.maxPlayers) {
    await interaction.reply({ content: "Рейдът е пълен!", ephemeral: true });
    return;
  }
  if (role === "Tank" && tanksCount >= currentRaid.maxTanks) {
    await interaction.reply({ content: "Вече има максимален брой танкове!", ephemeral: true });
    return;
  }
  if (role === "Healer" && healersCount >= currentRaid.maxHealers) {
    await interaction.reply({ content: "Вече има максимален брой хийлъри!", ephemeral: true });
    return;
  }

  currentRaid.members.push({ id: user.id, user: `<@${user.id}>`, class: spec, role });
  await interaction.update({ embeds: [createRaidEmbed()] });
});

// ------------------------- READY -------------------------
client.on("clientReady", async () => {
  console.log(`✅ Логнат като ${client.user.tag}`);
  // Старите статуси
  const staticStatuses = [
    "Използвай /help и научи от какво има нужда гилдията!",
    "Използвай /professions за да научиш какви професии",
    "Използвай /roleinfo за да научиш коя роля е нужна"
  ];

  let index = 0;
  async function setNextStatus() {
    const statusText = staticStatuses[index % staticStatuses.length];
    client.user.setPresence({
      activities: [{ name: statusText, type: 0 }],
      status: "online"
    });
    index++;
  }
  await setNextStatus();
  setInterval(setNextStatus, 300000);
});

// ------------------------- LOGIN -------------------------
client.login(TOKEN).then(() => console.log("✅ Опит за свързване с Discord...")).catch(err => console.error("❌ Грешка при логване:", err));
