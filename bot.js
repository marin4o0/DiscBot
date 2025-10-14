const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require("discord.js");
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const wowClasses = [
  "Druid", "Hunter", "Mage", "Paladin", "Priest", "Rogue", "Shaman", "Warlock", "Warrior"
];

const categories = ["DPS", "Tank", "Healer"];

const validClasses = {
  DPS: ["Druid", "Hunter", "Mage", "Paladin", "Rogue", "Shaman", "Warlock", "Warrior"],
  Tank: ["Druid", "Paladin", "Warrior", "Shaman"],
  Healer: ["Druid", "Paladin", "Priest", "Shaman"]
};

const classSpecs = {
  Druid: ["Balance (Ranged)", "Feral (Melee)", "Restoration"],
  Hunter: ["Beast Mastery (Ranged)", "Marksmanship (Ranged)", "Survival (Melee)"],
  Mage: ["Arcane (Ranged)", "Fire (Ranged)", "Frost (Ranged)"],
  Paladin: ["Holy (Healer)", "Protection (Tank)", "Retribution (Melee)"],
  Priest: ["Discipline (Healer)", "Holy (Healer)", "Shadow (Ranged)"],
  Rogue: ["Assassination (Melee)", "Combat (Melee)", "Subtlety (Melee)"],
  Shaman: ["Elemental (Ranged)", "Enhancement (Melee)", "Restoration (Healer)"],
  Warlock: ["Affliction (Ranged)", "Demonology (Ranged)", "Destruction (Ranged)"],
  Warrior: ["Arms (Melee)", "Fury (Melee)", "Protection (Tank)"]
};

const professions = [
  "Alchemy", "Blacksmithing", "Herbalism", "Mining", "Engineering",
  "Skinning", "Leatherworking", "Enchanting", "Tailoring", "Cooking",
  "Fishing", "FirstAid", "Woodcutting"
];

// ----------- Helpers -----------
function getEmojiByName(guild, name) {
  const emoji = guild.emojis.cache.find(e => e.name === name.toLowerCase());
  return emoji ? emoji.toString() : "•";
}

// ----------- Commands Registration -----------
const commands = [
  new SlashCommandBuilder()
    .setName("roleinfo")
    .setDescription("Показва WoW класове и роли с брой членове")
    .addStringOption(option =>
      option.setName("role")
        .setDescription("Филтрирай по роля (DPS, Tank, Healer)")
        .setRequired(false)
        .addChoices(
          { name: "DPS", value: "DPS" },
          { name: "Tank", value: "Tank" },
          { name: "Healer", value: "Healer" }
        )
    )
    .addStringOption(option =>
      option.setName("class")
        .setDescription("Филтрирай по клас (напр. Warrior, Mage...)")
        .setRequired(false)
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName("professions")
    .setDescription("Показва професии и брой членове")
    .addStringOption(option =>
      option.setName("profession")
        .setDescription("Филтрирай по професия (напр. Alchemy, Woodcutting...)")
        .setRequired(false)
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Показва информация за всички команди")
    .toJSON(),
  new SlashCommandBuilder()
    .setName("create")
    .setDescription("Създава рейд събитие")
    .addStringOption(option => option.setName("name").setDescription("Име на рейда").setRequired(true))
    .addStringOption(option => option.setName("date").setDescription("Дата на рейда (напр. 26.10.2025)").setRequired(true))
    .addStringOption(option => option.setName("time").setDescription("Час на рейда (напр. 20:00)").setRequired(true))
    .addStringOption(option => option.setName("image").setDescription("Линк към снимка за ембеда").setRequired(false))
    .toJSON()
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log("⚡ Регистриране на командите...");
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log("✅ Командите са регистрирани!");
  } catch (err) {
    console.error(err);
  }
})();

// ----------- Event Handlers -----------
async function handleRoleInfo(interaction) {
  const guild = await client.guilds.fetch(GUILD_ID);
  await guild.members.fetch();
  await guild.emojis.fetch();

  const selectedRole = interaction.options.getString("role");
  const selectedClass = interaction.options.getString("class");

  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle("Информация за роли и класове")
    .setTimestamp()
    .setFooter({ text: "WoW Discord Bot" });

  const categoriesToShow = selectedRole ? [selectedRole] : categories;
  for (const category of categoriesToShow) {
    let totalCount = 0;
    let categoryValue = "";
    for (const cls of wowClasses.sort()) {
      if (!validClasses[category].includes(cls)) continue;

      const classRole = guild.roles.cache.find(r => r.name.toLowerCase() === cls.toLowerCase());
      const catRole = guild.roles.cache.find(r => r.name.toLowerCase() === category.toLowerCase());
      if (!classRole || !catRole) continue;

      const altRole = guild.roles.cache.find(r => r.name.toLowerCase() === `${cls.toLowerCase()}-alt`);
      const members = classRole.members.filter(m =>
        m.roles.cache.has(catRole.id) &&
        (!altRole || !m.roles.cache.has(altRole.id))
      );

      if (members.size > 0) {
        categoryValue += `${getEmojiByName(guild, cls)} ${cls} - ${members.size}\n`;
        totalCount += members.size;
      }
    }

    if (totalCount > 0) {
      embed.setColor(embed.data.color || 0x0099ff);
      embed.addFields({ name: `${category} (Общо: ${totalCount})`, value: categoryValue, inline: false });
    }
  }

  if (!embed.data.fields.length) {
    embed.setDescription("Няма намерени членове по зададените критерии.");
  }

  await interaction.reply({ embeds: [embed], flags: 1 << 6 });
}

async function handleProfessions(interaction) {
  const guild = await client.guilds.fetch(GUILD_ID);
  await guild.members.fetch();
  await guild.emojis.fetch();

  const selectedProfession = interaction.options.getString("profession");
  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle("Информация за професии")
    .setTimestamp()
    .setFooter({ text: "WoW Discord Bot" });

  if (selectedProfession) {
    const profRole = guild.roles.cache.find(r => r.name.toLowerCase() === selectedProfession.toLowerCase());
    if (!profRole) {
      embed.setDescription("Не е намерена такава професия.");
      return interaction.reply({ embeds: [embed], flags: 1 << 6 });
    }

    embed.setColor(profRole.color || 0x0099ff);
    embed.addFields({ name: `${getEmojiByName(guild, selectedProfession)} ${selectedProfession}`, value: `Брой: ${profRole.members.size}`, inline: false });
    return interaction.reply({ embeds: [embed], flags: 1 << 6 });
  }

  let professionsList = "";
  for (const prof of professions.sort()) {
    const profRole = guild.roles.cache.find(r => r.name.toLowerCase() === prof.toLowerCase());
    if (!profRole || profRole.members.size === 0) continue;
    professionsList += `${getEmojiByName(guild, prof)} ${prof} - ${profRole.members.size}\n`;
  }

  if (!professionsList) embed.setDescription("Няма намерени членове с избрани професии.");
  else embed.addFields({ name: "Професии", value: professionsList, inline: false });

  await interaction.reply({ embeds: [embed], flags: 1 << 6 });
}

async function handleHelp(interaction) {
  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle("Помощ за командите на WoW Discord бота")
    .setDescription("Тук можеш да видиш как се използват командите на бота:")
    .addFields(
      { name: "/roleinfo", value: "Показва WoW роли и класове с брой членове.\n- Филтрирай по роля или клас.\nПример: `/roleinfo role:DPS`", inline: false },
      { name: "/professions", value: "Показва професии и брой членове.\n- Филтрирай по професия.\nПример: `/professions profession:Alchemy`", inline: false },
      { name: "/create", value: "Създава рейд събитие. След това всички могат да се запишат чрез селект менюта.", inline: false },
      { name: "/help", value: "Показва тази помощ.", inline: false }
    )
    .setTimestamp()
    .setFooter({ text: "WoW Discord Bot" });

  await interaction.reply({ embeds: [embed], flags: 1 << 6 });
}

// ----------- Raid System -----------
const raids = new Map(); // key: messageId, value: raid info

async function handleCreate(interaction) {
  const guild = await client.guilds.fetch(GUILD_ID);
  await guild.members.fetch();

  const name = interaction.options.getString("name");
  const date = interaction.options.getString("date");
  const time = interaction.options.getString("time");
  const image = interaction.options.getString("image");

  const raid = {
    name,
    date,
    time,
    participants: {
      DPS: [], Tank: [], Healer: []
    }
  };

  const embed = new EmbedBuilder()
    .setTitle(`Рейд: ${name}`)
    .setDescription(`Дата: ${date}\nЧас: ${time}`)
    .setColor(0xff9900)
    .setTimestamp()
    .setFooter({ text: "Запиши се за рейда!" });

  if (image) embed.setImage(image);

  const classOptions = wowClasses.map(cls => ({ label: cls, value: cls }));
  const classMenu = new StringSelectMenuBuilder()
    .setCustomId(`raid_class_select`)
    .setPlaceholder("Избери клас")
    .addOptions(classOptions);

  const row = new ActionRowBuilder().addComponents(classMenu);

  const message = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
  raids.set(message.id, raid);
}

// ----------- Interaction Listener -----------
client.on("interactionCreate", async interaction => {
  if (interaction.isCommand()) {
    if (interaction.commandName === "roleinfo") await handleRoleInfo(interaction);
    else if (interaction.commandName === "professions") await handleProfessions(interaction);
    else if (interaction.commandName === "help") await handleHelp(interaction);
    else if (interaction.commandName === "create") await handleCreate(interaction);
  }

  if (interaction.isStringSelectMenu()) {
    const raid = raids.get(interaction.message.id);
    if (!raid) return;

    const selectedClass = interaction.values[0];
    // Определяне на роли и спекове за клас
    const specs = classSpecs[selectedClass];
    const options = specs.map(spec => ({ label: spec, value: spec }));

    const specMenu = new StringSelectMenuBuilder()
      .setCustomId(`raid_spec_select_${interaction.user.id}`)
      .setPlaceholder("Избери специализация")
      .addOptions(options);

    const row = new ActionRowBuilder().addComponents(specMenu);

    await interaction.update({ components: [row] });
  }
});

// ----------- Ready & Status -----------
client.once("clientReady", async () => {
  console.log(`✅ Логнат като ${client.user.tag}`);

  const guild = await client.guilds.fetch(GUILD_ID);
  await guild.members.fetch();

  const staticStatuses = [
    "Използвай /help и научи от какво има нужда гилдията!",
    "Използвай /professions за да научиш какви професии",
    "Използвай /roleinfo за да научиш коя роля е нужна"
  ];

  let index = 0;
  async function updateDynamicStatus() {
    await guild.members.fetch();
    const roleCounts = { DPS: 0, Tank: 0, Healer: 0 };
    for (const category of categories) {
      const role = guild.roles.cache.find(r => r.name.toLowerCase() === category.toLowerCase());
      if (!role) continue;
      const members = role.members.filter(m => !m.roles.cache.some(r => r.name.toLowerCase().endsWith("-alt")));
      roleCounts[category] = members.size;
    }
    return `DPS - ${roleCounts.DPS} | Tank - ${roleCounts.Tank} | Healer - ${roleCounts.Healer}`;
  }

  async function setNextStatus() {
    const statusText = index % 4 === 3 ? await updateDynamicStatus() : staticStatuses[index % staticStatuses.length];
    client.user.setPresence({ activities: [{ name: statusText, type: 0 }], status: "online" });
    index++;
  }

  await setNextStatus();
  setInterval(setNextStatus, 300000);
});

// ----------- Login -----------
client.login(TOKEN)
  .then(() => console.log("✅ Опит за свързване с Discord..."))
  .catch(err => console.error("❌ Грешка при логване в Discord:", err));
