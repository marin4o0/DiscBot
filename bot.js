// ------------------------- IMPORTS -------------------------
const { 
  Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, 
  ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle 
} = require("discord.js");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

// ------------------------- CONSTANTS -------------------------
const wowClasses = ["Druid", "Hunter", "Mage", "Paladin", "Priest", "Rogue", "Shaman", "Warlock", "Warrior"];
const categories = ["DPS", "Tank", "Healer"];
const validClasses = {
  DPS: ["Druid","Hunter","Mage","Paladin","Rogue","Shaman","Warlock","Warrior"],
  Tank: ["Druid","Paladin","Warrior","Shaman"],
  Healer: ["Druid","Paladin","Priest","Shaman"]
};
const professions = ["Alchemy","Blacksmithing","Herbalism","Mining","Engineering","Skinning","Leatherworking","Enchanting","Tailoring","Cooking","Fishing","FirstAid","Woodcutting"];

// Emoji по име
function getEmojiByName(guild, name) {
  const emoji = guild.emojis.cache.find(e => e.name === name.toLowerCase());
  return emoji ? emoji.toString() : "•";
}

// ------------------------- ROLEINFO / PROFESSIONS / HELP -------------------------
// ... тук копираме handleRoleInfo, handleProfessions, handleHelp от предишния финален код, с flags: 1 << 6

// ------------------------- RAID SYSTEM -------------------------
const MIN_RAID = 10;
const MAX_RAID = 25;
const allowedStartRoles = ["Admin", "Moderator", "Raid Leader"];
const classSpecs = {
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

const activeRaids = new Map();

// /create команда
const raidCommand = new SlashCommandBuilder()
  .setName("create")
  .setDescription("Създава нов рейд")
  .addStringOption(option => option.setName("name").setDescription("Име на рейда").setRequired(true))
  .addStringOption(option => option.setName("date").setDescription("Дата (dd.mm.yyyy)").setRequired(true))
  .addStringOption(option => option.setName("time").setDescription("Час (hh:mm)").setRequired(true))
  .addStringOption(option => option.setName("image").setDescription("Линк към изображение").setRequired(false))
  .toJSON();

// ------------------------- COMMANDS REGISTRATION -------------------------
const commands = [
  // roleinfo, professions, help от предишния код
  raidCommand
];

const rest = new REST({ version: '10' }).setToken(TOKEN);
(async () => {
  try {
    console.log("⚡ Регистриране на командите...");
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log("✅ Командите са регистрирани!");
  } catch (err) { console.error(err); }
})();

// ------------------------- HANDLERS -------------------------
async function handleCreateRaid(interaction) {
  const raidName = interaction.options.getString("name");
  const raidDate = interaction.options.getString("date");
  const raidTime = interaction.options.getString("time");
  const raidImage = interaction.options.getString("image") || null;

  const guild = await client.guilds.fetch(GUILD_ID);
  await guild.members.fetch();

  const embed = {
    title: `📢 Рейд: ${raidName}`,
    description: `Дата: ${raidDate}\nЧас: ${raidTime}\n\n@everyone`,
    color: 0xffa500,
    fields: [
      { name: "Tank (Общо: 0)", value: "Няма записани", inline: false },
      { name: "Healer (Общо: 0)", value: "Няма записани", inline: false },
      { name: "DPS (Общо: 0)", value: "Няма записани", inline: false }
    ],
    image: raidImage ? { url: raidImage } : undefined,
    timestamp: new Date(),
    footer: { text: "WoW Discord Bot" }
  };

  const classSelect = new StringSelectMenuBuilder()
    .setCustomId("raid_class")
    .setPlaceholder("Избери клас")
    .addOptions(wowClasses.map(cls => ({
      label: cls, value: cls.toLowerCase(), emoji: getEmojiByName(guild, cls.toLowerCase())
    })));

  const roleSelect = new StringSelectMenuBuilder()
    .setCustomId("raid_role")
    .setPlaceholder("Избери роля")
    .addOptions(categories.map(cat => ({
      label: cat, value: cat.toLowerCase(), emoji: getEmojiByName(guild, cat.toLowerCase())
    })));

  const specSelect = new StringSelectMenuBuilder()
    .setCustomId("raid_spec")
    .setPlaceholder("Избери специализация")
    .addOptions([]);

  const row1 = new ActionRowBuilder().addComponents(classSelect);
  const row2 = new ActionRowBuilder().addComponents(roleSelect);
  const row3 = new ActionRowBuilder().addComponents(specSelect);

  const startButton = new ButtonBuilder().setCustomId("raid_start").setLabel("Start").setStyle(ButtonStyle.Success);
  const cancelButton = new ButtonBuilder().setCustomId("raid_cancel").setLabel("Cancel").setStyle(ButtonStyle.Danger);
  const rowButtons = new ActionRowBuilder().addComponents(startButton, cancelButton);

  const msg = await interaction.reply({ embeds: [embed], components: [row1, row2, row3, rowButtons], fetchReply: true });
  activeRaids.set(msg.id, { name: raidName, date: raidDate, time: raidTime, image: raidImage, participants: [], message: msg, started: false });
}

// ------------------------- INTERACTION HANDLER -------------------------
client.on("interactionCreate", async interaction => {
  if (interaction.isCommand()) {
    if (interaction.commandName === "roleinfo") await handleRoleInfo(interaction);
    else if (interaction.commandName === "professions") await handleProfessions(interaction);
    else if (interaction.commandName === "help") await handleHelp(interaction);
    else if (interaction.commandName === "create") await handleCreateRaid(interaction);
  }

  // Менюта и бутони за рейд
  if (activeRaids.has(interaction.message?.id)) {
    const raid = activeRaids.get(interaction.message.id);
    const memberId = interaction.user.id;

    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === "raid_class") {
        const selectedClass = interaction.values[0];
        const specs = classSpecs[selectedClass.charAt(0).toUpperCase() + selectedClass.slice(1)];
        const specSelect = new StringSelectMenuBuilder().setCustomId("raid_spec").setPlaceholder("Избери специализация").addOptions(specs.map(s => ({ label: s, value: s.toLowerCase() })));
        const row3 = new ActionRowBuilder().addComponents(specSelect);
        const components = interaction.message.components.slice(0, 2); 
        components.push(row3, interaction.message.components[3]); 
        await interaction.update({ components });
        return;
      }
      if (interaction.customId === "raid_role" || interaction.customId === "raid_spec") {
        const selected = interaction.values[0];
        const index = raid.participants.findIndex(p => p.id === memberId);
        if (index === -1) raid.participants.push({ id: memberId, class: null, role: null, spec: null });
        const participant = raid.participants.find(p => p.id === memberId);
        if (interaction.customId === "raid_role") participant.role = selected;
        if (interaction.customId === "raid_spec") participant.spec = selected;
        updateRaidEmbed(raid, interaction);
        await interaction.deferUpdate();
        return;
      }
    }

    if (interaction.isButton()) {
      const member = interaction.member;
      const hasPermission = member.roles.cache.some(r => allowedStartRoles.includes(r.name));
      if (!hasPermission) return interaction.reply({ content: "Нямаш право да натискаш този бутон!", ephemeral: true });

      if (interaction.customId === "raid_start") {
        if (raid.participants.length < MIN_RAID) return interaction.reply({ content: `Не може да се стартира рейд с по-малко от ${MIN_RAID} човека.`, ephemeral: true });
        raid.started = true;
        await interaction.reply({ content: "✅ Рейдът е стартиран!", ephemeral: true });
      }
      if (interaction.customId === "raid_cancel") {
        await interaction.message.delete();
        activeRaids.delete(interaction.message.id);
      }
    }
  }
});

// ------------------------- UPDATE RAID EMBED -------------------------
async function updateRaidEmbed(raid, interactionOrMsg) {
  const tanks = raid.participants.filter(p => p.role === "tank");
  const healers = raid.participants.filter(p => p.role === "healer");
  const dps = raid.participants.filter(p => p.role === "dps");

  const embed = {
    title: `📢 Рейд: ${raid.name}`,
    description: `Дата: ${raid.date}\nЧас: ${raid.time}\n\n@everyone`,
    color: 0xffa500,
    fields: [
      { name: `Tank (Общо: ${tanks.length})`, value: tanks.length ? tanks.map(p => `<@${p.id}>`).join("\n") : "Няма записани", inline: false },
      { name: `Healer (Общо: ${healers.length})`, value: healers.length ? healers.map(p => `<@${p.id}>`).join("\n") : "Няма записани", inline: false },
      { name: `DPS (Общо: ${dps.length})`, value: dps.length ? dps.map(p => `<@${p.id}>`).join("\n") : "Няма записани", inline: false }
    ],
    image: raid.image ? { url: raid.image } : undefined,
    timestamp: new Date(),
    footer: { text: "WoW Discord Bot" }
  };

  await raid.message.edit({ embeds: [embed] });
}

// ------------------------- READY EVENT -------------------------
client.once("clientReady", async () => {
  console.log(`✅ Логнат като ${client.user.tag}`);
  // Тук може да добавиш status както преди
});

// ------------------------- LOGIN -------------------------
client.login(TOKEN)
  .then(() => console.log("✅ Опит за свързване с Discord..."))
  .catch(err => console.error("❌ Грешка при логване в Discord:", err));
// ------------------------- IMPORTS -------------------------
const { 
  Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, 
  ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle 
} = require("discord.js");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

// ------------------------- CONSTANTS -------------------------
const wowClasses = ["Druid", "Hunter", "Mage", "Paladin", "Priest", "Rogue", "Shaman", "Warlock", "Warrior"];
const categories = ["DPS", "Tank", "Healer"];
const validClasses = {
  DPS: ["Druid","Hunter","Mage","Paladin","Rogue","Shaman","Warlock","Warrior"],
  Tank: ["Druid","Paladin","Warrior","Shaman"],
  Healer: ["Druid","Paladin","Priest","Shaman"]
};
const professions = ["Alchemy","Blacksmithing","Herbalism","Mining","Engineering","Skinning","Leatherworking","Enchanting","Tailoring","Cooking","Fishing","FirstAid","Woodcutting"];

// Emoji по име
function getEmojiByName(guild, name) {
  const emoji = guild.emojis.cache.find(e => e.name === name.toLowerCase());
  return emoji ? emoji.toString() : "•";
}

// ------------------------- ROLEINFO / PROFESSIONS / HELP -------------------------
// ... тук копираме handleRoleInfo, handleProfessions, handleHelp от предишния финален код, с flags: 1 << 6

// ------------------------- RAID SYSTEM -------------------------
const MIN_RAID = 10;
const MAX_RAID = 25;
const allowedStartRoles = ["Admin", "Moderator", "Raid Leader"];
const classSpecs = {
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

const activeRaids = new Map();

// /create команда
const raidCommand = new SlashCommandBuilder()
  .setName("create")
  .setDescription("Създава нов рейд")
  .addStringOption(option => option.setName("name").setDescription("Име на рейда").setRequired(true))
  .addStringOption(option => option.setName("date").setDescription("Дата (dd.mm.yyyy)").setRequired(true))
  .addStringOption(option => option.setName("time").setDescription("Час (hh:mm)").setRequired(true))
  .addStringOption(option => option.setName("image").setDescription("Линк към изображение").setRequired(false))
  .toJSON();

// ------------------------- COMMANDS REGISTRATION -------------------------
const commands = [
  // roleinfo, professions, help от предишния код
  raidCommand
];

const rest = new REST({ version: '10' }).setToken(TOKEN);
(async () => {
  try {
    console.log("⚡ Регистриране на командите...");
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log("✅ Командите са регистрирани!");
  } catch (err) { console.error(err); }
})();

// ------------------------- HANDLERS -------------------------
async function handleCreateRaid(interaction) {
  const raidName = interaction.options.getString("name");
  const raidDate = interaction.options.getString("date");
  const raidTime = interaction.options.getString("time");
  const raidImage = interaction.options.getString("image") || null;

  const guild = await client.guilds.fetch(GUILD_ID);
  await guild.members.fetch();

  const embed = {
    title: `📢 Рейд: ${raidName}`,
    description: `Дата: ${raidDate}\nЧас: ${raidTime}\n\n@everyone`,
    color: 0xffa500,
    fields: [
      { name: "Tank (Общо: 0)", value: "Няма записани", inline: false },
      { name: "Healer (Общо: 0)", value: "Няма записани", inline: false },
      { name: "DPS (Общо: 0)", value: "Няма записани", inline: false }
    ],
    image: raidImage ? { url: raidImage } : undefined,
    timestamp: new Date(),
    footer: { text: "WoW Discord Bot" }
  };

  const classSelect = new StringSelectMenuBuilder()
    .setCustomId("raid_class")
    .setPlaceholder("Избери клас")
    .addOptions(wowClasses.map(cls => ({
      label: cls, value: cls.toLowerCase(), emoji: getEmojiByName(guild, cls.toLowerCase())
    })));

  const roleSelect = new StringSelectMenuBuilder()
    .setCustomId("raid_role")
    .setPlaceholder("Избери роля")
    .addOptions(categories.map(cat => ({
      label: cat, value: cat.toLowerCase(), emoji: getEmojiByName(guild, cat.toLowerCase())
    })));

  const specSelect = new StringSelectMenuBuilder()
    .setCustomId("raid_spec")
    .setPlaceholder("Избери специализация")
    .addOptions([]);

  const row1 = new ActionRowBuilder().addComponents(classSelect);
  const row2 = new ActionRowBuilder().addComponents(roleSelect);
  const row3 = new ActionRowBuilder().addComponents(specSelect);

  const startButton = new ButtonBuilder().setCustomId("raid_start").setLabel("Start").setStyle(ButtonStyle.Success);
  const cancelButton = new ButtonBuilder().setCustomId("raid_cancel").setLabel("Cancel").setStyle(ButtonStyle.Danger);
  const rowButtons = new ActionRowBuilder().addComponents(startButton, cancelButton);

  const msg = await interaction.reply({ embeds: [embed], components: [row1, row2, row3, rowButtons], fetchReply: true });
  activeRaids.set(msg.id, { name: raidName, date: raidDate, time: raidTime, image: raidImage, participants: [], message: msg, started: false });
}

// ------------------------- INTERACTION HANDLER -------------------------
client.on("interactionCreate", async interaction => {
  if (interaction.isCommand()) {
    if (interaction.commandName === "roleinfo") await handleRoleInfo(interaction);
    else if (interaction.commandName === "professions") await handleProfessions(interaction);
    else if (interaction.commandName === "help") await handleHelp(interaction);
    else if (interaction.commandName === "create") await handleCreateRaid(interaction);
  }

  // Менюта и бутони за рейд
  if (activeRaids.has(interaction.message?.id)) {
    const raid = activeRaids.get(interaction.message.id);
    const memberId = interaction.user.id;

    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === "raid_class") {
        const selectedClass = interaction.values[0];
        const specs = classSpecs[selectedClass.charAt(0).toUpperCase() + selectedClass.slice(1)];
        const specSelect = new StringSelectMenuBuilder().setCustomId("raid_spec").setPlaceholder("Избери специализация").addOptions(specs.map(s => ({ label: s, value: s.toLowerCase() })));
        const row3 = new ActionRowBuilder().addComponents(specSelect);
        const components = interaction.message.components.slice(0, 2); 
        components.push(row3, interaction.message.components[3]); 
        await interaction.update({ components });
        return;
      }
      if (interaction.customId === "raid_role" || interaction.customId === "raid_spec") {
        const selected = interaction.values[0];
        const index = raid.participants.findIndex(p => p.id === memberId);
        if (index === -1) raid.participants.push({ id: memberId, class: null, role: null, spec: null });
        const participant = raid.participants.find(p => p.id === memberId);
        if (interaction.customId === "raid_role") participant.role = selected;
        if (interaction.customId === "raid_spec") participant.spec = selected;
        updateRaidEmbed(raid, interaction);
        await interaction.deferUpdate();
        return;
      }
    }

    if (interaction.isButton()) {
      const member = interaction.member;
      const hasPermission = member.roles.cache.some(r => allowedStartRoles.includes(r.name));
      if (!hasPermission) return interaction.reply({ content: "Нямаш право да натискаш този бутон!", ephemeral: true });

      if (interaction.customId === "raid_start") {
        if (raid.participants.length < MIN_RAID) return interaction.reply({ content: `Не може да се стартира рейд с по-малко от ${MIN_RAID} човека.`, ephemeral: true });
        raid.started = true;
        await interaction.reply({ content: "✅ Рейдът е стартиран!", ephemeral: true });
      }
      if (interaction.customId === "raid_cancel") {
        await interaction.message.delete();
        activeRaids.delete(interaction.message.id);
      }
    }
  }
});

// ------------------------- UPDATE RAID EMBED -------------------------
async function updateRaidEmbed(raid, interactionOrMsg) {
  const tanks = raid.participants.filter(p => p.role === "tank");
  const healers = raid.participants.filter(p => p.role === "healer");
  const dps = raid.participants.filter(p => p.role === "dps");

  const embed = {
    title: `📢 Рейд: ${raid.name}`,
    description: `Дата: ${raid.date}\nЧас: ${raid.time}\n\n@everyone`,
    color: 0xffa500,
    fields: [
      { name: `Tank (Общо: ${tanks.length})`, value: tanks.length ? tanks.map(p => `<@${p.id}>`).join("\n") : "Няма записани", inline: false },
      { name: `Healer (Общо: ${healers.length})`, value: healers.length ? healers.map(p => `<@${p.id}>`).join("\n") : "Няма записани", inline: false },
      { name: `DPS (Общо: ${dps.length})`, value: dps.length ? dps.map(p => `<@${p.id}>`).join("\n") : "Няма записани", inline: false }
    ],
    image: raid.image ? { url: raid.image } : undefined,
    timestamp: new Date(),
    footer: { text: "WoW Discord Bot" }
  };

  await raid.message.edit({ embeds: [embed] });
}

// ------------------------- READY EVENT -------------------------
client.once("clientReady", async () => {
  console.log(`✅ Логнат като ${client.user.tag}`);
  // Тук може да добавиш status както преди
});

// ------------------------- LOGIN -------------------------
client.login(TOKEN)
  .then(() => console.log("✅ Опит за свързване с Discord..."))
  .catch(err => console.error("❌ Грешка при логване в Discord:", err));
