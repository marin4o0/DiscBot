const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, Events } = require("discord.js");
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const wowClasses = ["Druid","Hunter","Mage","Paladin","Priest","Rogue","Shaman","Warlock","Warrior"];
const categories = ["DPS","Tank","Healer"];
const validClasses = {
  DPS: ["Druid","Hunter","Mage","Paladin","Rogue","Shaman","Warlock","Warrior"],
  Tank: ["Druid","Paladin","Warrior","Shaman"],
  Healer: ["Druid","Paladin","Priest","Shaman"]
};
const professions = [
  "Alchemy","Blacksmithing","Herbalism","Mining","Engineering","Skinning","Leatherworking","Enchanting",
  "Tailoring","Cooking","Fishing","FirstAid","Woodcutting"
];

const specializations = {
  Druid: ["Balance","Feral Combat","Restoration"],
  Hunter: ["Beast Mastery","Marksmanship","Survival"],
  Mage: ["Arcane","Fire","Frost"],
  Paladin: ["Holy","Protection","Retribution"],
  Priest: ["Discipline","Holy","Shadow"],
  Rogue: ["Assassination","Combat","Subtlety"],
  Shaman: ["Elemental","Enhancement","Restoration"],
  Warlock: ["Affliction","Demonology","Destruction"],
  Warrior: ["Arms","Fury","Protection"]
};

// DPS spec mapping to Melee/Ranged
const dpsType = {
  "Balance":"Ranged","Feral Combat":"Melee","Beast Mastery":"Ranged","Marksmanship":"Ranged","Survival":"Ranged",
  "Arcane":"Ranged","Fire":"Ranged","Frost":"Ranged","Retribution":"Melee","Assassination":"Melee","Combat":"Melee",
  "Subtlety":"Melee","Enhancement":"Melee","Shadow":"Ranged","Fury":"Melee","Arms":"Melee","Destruction":"Ranged"
};

const raids = new Map(); // raidId -> raidData

// ------------------------- UTILS -------------------------
function getEmojiByName(guild, name) {
  const emoji = guild.emojis.cache.find(e => e.name === name.toLowerCase());
  return emoji ? emoji.toString() : "•";
}

// ------------------------- COMMANDS -------------------------
const commands = [
  // RoleInfo
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
  // Professions
  new SlashCommandBuilder()
    .setName("professions")
    .setDescription("Показва професии и брой членове")
    .addStringOption(option =>
      option.setName("profession")
        .setDescription("Филтрирай по професия (напр. Alchemy, Woodcutting...)")
        .setRequired(false)
    )
    .toJSON(),
  // Help
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Показва информация за всички команди")
    .toJSON(),
  // Create Raid
  new SlashCommandBuilder()
    .setName("create")
    .setDescription("Създава нов рейд")
    .addStringOption(opt => opt.setName("name").setDescription("Име на рейда").setRequired(true))
    .addStringOption(opt => opt.setName("date").setDescription("Дата и час на рейда").setRequired(true))
    .addStringOption(opt => opt.setName("image").setDescription("Линк към картинка за embed").setRequired(false))
    .toJSON()
];

const rest = new REST({ version: '10' }).setToken(TOKEN);
(async () => {
  try {
    console.log("⚡ Регистриране на командите...");
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log("✅ Командите са регистрирани!");
  } catch (err) { console.error(err); }
})();

// ------------------------- ROLE & PROFESSION HANDLERS -------------------------
async function handleRoleInfo(interaction) {
  const guild = await client.guilds.fetch(GUILD_ID);
  await guild.members.fetch();
  await guild.emojis.fetch();

  const selectedRole = interaction.options.getString("role");
  const selectedClass = interaction.options.getString("class");

  const embed = {
    color: 0x0099ff,
    title: "Информация за роли и класове",
    description: "",
    fields: [],
    timestamp: new Date(),
    footer: { text: "WoW Discord Bot" }
  };

  if (selectedClass) {
    const classRole = guild.roles.cache.find(r => r.name.toLowerCase() === selectedClass.toLowerCase());
    if (!classRole) {
      embed.description = "Не е намерен такъв клас.";
      return interaction.reply({ embeds: [embed], flags: 1 << 6 });
    }
    embed.color = classRole.color || 0x0099ff;

    for (const cat of categories) {
      if (!validClasses[cat].includes(selectedClass)) continue;
      if (selectedRole && selectedRole !== cat) continue;

      const catRole = guild.roles.cache.find(r => r.name.toLowerCase() === cat.toLowerCase());
      if (!catRole) continue;

      const altRole = guild.roles.cache.find(r => r.name.toLowerCase() === `${selectedClass.toLowerCase()}-alt`);
      const members = classRole.members.filter(m =>
        m.roles.cache.has(catRole.id) &&
        (!altRole || !m.roles.cache.has(altRole.id))
      );

      if (members.size > 0) {
        const emoji = getEmojiByName(guild, selectedClass);
        embed.fields.push({ name: `${emoji} ${selectedClass} (${cat})`, value: `Брой: ${members.size}`, inline: false });
      }
    }

    if (embed.fields.length === 0) embed.description = "Няма членове, които отговарят на зададените критерии.";
    return interaction.reply({ embeds: [embed], flags: 1 << 6 });
  }

  const categoriesToShow = selectedRole ? [selectedRole] : categories;

  for (const category of categoriesToShow) {
    let totalCount = 0;
    let categoryValue = "";

    for (const cls of wowClasses.sort()) {
      if (!validClasses[category].includes(cls)) continue;

      const classRole = guild.roles.cache.find(r => r.name.toLowerCase() === cls.toLowerCase());
      const categoryRole = guild.roles.cache.find(r => r.name.toLowerCase() === category.toLowerCase());
      if (!classRole || !categoryRole) continue;

      const altRole = guild.roles.cache.find(r => r.name.toLowerCase() === `${cls.toLowerCase()}-alt`);
      const members = classRole.members.filter(m =>
        m.roles.cache.has(categoryRole.id) &&
        (!altRole || !m.roles.cache.has(altRole.id))
      );

      if (members.size > 0) {
        const emoji = getEmojiByName(guild, cls.toLowerCase());
        categoryValue += `${emoji} ${cls} - ${members.size}\n`;
        totalCount += members.size;
      }
    }

    if (totalCount > 0) {
      const categoryRole = guild.roles.cache.find(r => r.name.toLowerCase() === category.toLowerCase());
      embed.color = categoryRole?.color || embed.color;
      embed.fields.push({ name: `${category} (Общо: ${totalCount})`, value: categoryValue, inline: false });
    }
  }

  if (embed.fields.length === 0) embed.description = "Няма намерени членове по зададените критерии.";
  return interaction.reply({ embeds: [embed], flags: 1 << 6 });
}

async function handleProfessions(interaction) {
  const guild = await client.guilds.fetch(GUILD_ID);
  await guild.members.fetch();
  await guild.emojis.fetch();

  const selectedProfession = interaction.options.getString("profession");
  const embed = { color: 0x0099ff, title: "Информация за професии", description: "", fields: [], timestamp: new Date(), footer: { text: "WoW Discord Bot" } };

  if (selectedProfession) {
    const profRole = guild.roles.cache.find(r => r.name.toLowerCase() === selectedProfession.toLowerCase());
    if (!profRole) { embed.description = "Не е намерена такава професия."; return interaction.reply({ embeds: [embed], flags: 1 << 6 }); }
    embed.color = profRole.color || embed.color;
    const members = profRole.members;
    const emoji = getEmojiByName(guild, selectedProfession.toLowerCase()) || "•";
    embed.fields.push({ name: `${emoji} ${selectedProfession}`, value: `Брой: ${members.size}`, inline: false });
    return interaction.reply({ embeds: [embed], flags: 1 << 6 });
  }

  let professionsList = "";
  for (const prof of professions.sort()) {
    const profRole = guild.roles.cache.find(r => r.name.toLowerCase() === prof.toLowerCase());
    if (!profRole) continue;
    const members = profRole.members;
    if (members.size === 0) continue;
    const emoji = getEmojiByName(guild, prof.toLowerCase()) || "•";
    professionsList += `${emoji} ${prof} - ${members.size}\n`;
  }

  if (!professionsList) embed.description = "Няма намерени членове с избрани професии.";
  else embed.fields.push({ name: "Професии", value: professionsList, inline: false });

  return interaction.reply({ embeds: [embed], flags: 1 << 6 });
}

async function handleHelp(interaction) {
  const embed = {
    color: 0x00ff00,
    title: "Помощ за командите на WoW Discord бота",
    description: "Тук можеш да видиш как се използват командите на бота:",
    fields: [
      { name: "/roleinfo", value: "Показва WoW роли и класове с брой членове.\n- Можеш да филтрираш по роля: DPS, Tank, Healer.\n- Можеш да филтрираш по клас (напр. Warrior, Mage).\nПример: `/roleinfo role:DPS`", inline: false },
      { name: "/professions", value: "Показва професии и брой членове.\n- Можеш да филтрираш по професия (напр. Alchemy, Woodcutting).\nПример: `/professions profession:Alchemy`", inline: false },
      { name: "/create", value: "Създава нов рейд.\nПример: `/create name:\"Zul Gurub\" date:\"26.10.2025 20:00\"`", inline: false },
      { name: "/help", value: "Показва тази помощ и информация за командите.", inline: false }
    ],
    timestamp: new Date(),
    footer: { text: "WoW Discord Bot" }
  };

  await interaction.reply({ embeds: [embed], flags: 1 << 6 });
}

// ------------------------- RAID SYSTEM -------------------------
async function handleCreateRaid(interaction) {
  const raidName = interaction.options.getString("name");
  const raidDate = interaction.options.getString("date");
  const raidImage = interaction.options.getString("image") || null;
  const raidId = Date.now().toString();

  const raidData = { id: raidId, name: raidName, date: raidDate, image: raidImage, attendees: { DPS: [], Tank: [], Healer: [] }, locked: false };
  raids.set(raidId, raidData);

  const embed = {
    title: `Рейд: ${raidName}`,
    description: `Дата: ${raidDate}\nЗаписванията са отворени!`,
    color: 0x00AAFF,
    fields: [
      { name: "Tank (0)", value: "—", inline: false },
      { name: "Healer (0)", value: "—", inline: false },
      { name: "DPS (0)", value: "—", inline: false }
    ],
    image: raidImage ? { url: raidImage } : undefined,
    timestamp: new Date(),
    footer: { text: "WoW Discord Raid Bot" }
  };

  const classOptions = wowClasses.map(cls => ({ label: cls, value: cls }));
  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId(`select_class_${raidId}`).setPlaceholder("Избери клас").addOptions(classOptions)
  );

  await interaction.reply({ content: "@everyone", embeds: [embed], components: [row] });
}

// ------------------------- INTERACTION HANDLER -------------------------
client.on(Events.InteractionCreate, async interaction => {
  if (interaction.isCommand()) {
    if (interaction.commandName === "roleinfo") await handleRoleInfo(interaction);
    else if (interaction.commandName === "professions") await handleProfessions(interaction);
    else if (interaction.commandName === "help") await handleHelp(interaction);
    else if (interaction.commandName === "create") await handleCreateRaid(interaction);
  } else if (interaction.isStringSelectMenu()) {
    // RAID CLASS / ROLE / SPEC selection handler
    const parts = interaction.customId.split("_");
    const action = parts[1];
    const raidId = parts[2];
    const raidData = raids.get(raidId);
    if (!raidData) return interaction.reply({ content: "Рейдът не е намерен.", ephemeral: true });

    if (action === "class") {
      const selectedClass = interaction.values[0];
      const roleOptions = categories.filter(cat => validClasses[cat].includes(selectedClass)).map(cat => ({ label: cat, value: cat }));
      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId(`select_role_${raidId}_${selectedClass}`).setPlaceholder("Избери роля").addOptions(roleOptions)
      );
      await interaction.update({ components: [row] });
    } else if (action === "role") {
      const selectedClass = parts[3];
      const selectedRole = interaction.values[0];
      const specOptions = specializations[selectedClass].map(spec => ({ label: spec, value: spec }));
      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId(`select_spec_${raidId}_${selectedClass}_${selectedRole}`).setPlaceholder("Избери специализация").addOptions(specOptions)
      );
      await interaction.update({ components: [row] });
    } else if (action === "spec") {
      const selectedClass = parts[3];
      const selectedRole = parts[4];
      const selectedSpec = interaction.values[0];
      if (raidData.locked) return interaction.reply({ content: "Рейдът е заключен.", ephemeral: true });
      if (raidData.attendees[selectedRole].length >= 25) return interaction.reply({ content: "Ролята е пълна.", ephemeral: true });

      const userId = interaction.user.id;
      if (!raidData.attendees[selectedRole].some(a => a.id === userId)) raidData.attendees[selectedRole].push({ id: userId, class: selectedClass, spec: selectedSpec });

      const embed = {
        title: `Рейд: ${raidData.name}`,
        description: `Дата: ${raidData.date}\nЗаписванията са отворени!`,
        color: 0x00AAFF,
        fields: categories.map(cat => {
          const users = raidData.attendees[cat].map(u => {
            let extra = "";
            if (cat === "DPS") extra = ` (${dpsType[u.spec] || ""})`;
            const emoji = getEmojiByName(interaction.guild, u.class.toLowerCase());
            return `${emoji} <@${u.id}> ${extra}`;
          }).join("\n") || "—";
          return { name: `${cat} (${raidData.attendees[cat].length})`, value: users, inline: false };
        }),
        image: raidData.image ? { url: raidData.image } : undefined,
        timestamp: new Date(),
        footer: { text: "WoW Discord Raid Bot" }
      };

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`raid_start_${raidId}`).setLabel("Start").setStyle(ButtonStyle.Success)
      );
      await interaction.update({ embeds: [embed], components: [row] });
    }
  } else if (interaction.isButton()) {
    const parts = interaction.customId.split("_");
    if (parts[1] === "start") {
      const raidId = parts[2];
      const raidData = raids.get(raidId);
      if (!raidData) return interaction.reply({ content: "Рейдът не е намерен.", ephemeral: true });
      raidData.locked = true;
      await interaction.update({ content: `Рейдът **${raidData.name}** е стартирал!`, components: [], embeds: interaction.message.embeds });
    }
  }
});

// ------------------------- READY -------------------------
client.once("ready", async () => {
  console.log(`✅ Логнат като ${client.user.tag}`);
});

client.login(TOKEN).then(() => console.log("✅ Опит за свързване с Discord...")).catch(err => console.error(err));
