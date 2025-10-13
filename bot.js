const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require("discord.js");
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

const professions = [
  "Alchemy", "Blacksmithing", "Herbalism", "Mining", "Engineering",
  "Skinning", "Leatherworking", "Enchanting", "Tailoring", "Cooking",
  "Fishing", "FirstAid", "Woodcutting"
];

// Емоджи по име
function getEmojiByName(guild, name) {
  const emoji = guild.emojis.cache.find(e => e.name === name.toLowerCase());
  return emoji ? emoji.toString() : "";
}

// Цветове по роли
function getColorByRoles(roles) {
  for (const role of roles) {
    if (role.color && role.color !== 0) return role.color;
  }
  return 0x0099ff;
}

// Команди
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
      return interaction.reply({ embeds: [embed], ephemeral: true });
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
        embed.fields.push({
          name: `${emoji} ${selectedClass} (${cat})`,
          value: `Брой: ${members.size}`,
          inline: false
        });
      }
    }

    if (embed.fields.length === 0) {
      embed.description = "Няма членове, които отговарят на зададените критерии.";
    }
    return interaction.reply({ embeds: [embed] });
  }

  // Няма филтър по клас
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

      embed.fields.push({
        name: `${category} (Общо: ${totalCount})`,
        value: categoryValue,
        inline: false
      });
    }
  }

  if (embed.fields.length === 0) {
    embed.description = "Няма намерени членове по зададените критерии.";
  }

  return interaction.reply({ embeds: [embed] });
}

async function handleProfessions(interaction) {
  const guild = await client.guilds.fetch(GUILD_ID);
  await guild.members.fetch();
  await guild.emojis.fetch();

  const selectedProfession = interaction.options.getString("profession");

  const embed = {
    color: 0x0099ff,
    title: "Информация за професии",
    description: "",
    fields: [],
    timestamp: new Date(),
    footer: { text: "WoW Discord Bot" }
  };

  if (selectedProfession) {
    const profRole = guild.roles.cache.find(r => r.name.toLowerCase() === selectedProfession.toLowerCase());
    if (!profRole) {
      embed.description = "Не е намерена такава професия.";
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    embed.color = profRole.color || embed.color;

    const members = profRole.members;

    const emoji = getEmojiByName(guild, selectedProfession.toLowerCase());
    embed.fields.push({
      name: `${emoji} ${selectedProfession}`,
      value: `Брой: ${members.size}`,
      inline: false
    });

    return interaction.reply({ embeds: [embed] });
  }

  let professionsList = "";

for (const prof of professions.sort()) {
  const profRole = guild.roles.cache.find(r => r.name.toLowerCase() === prof.toLowerCase());
  if (!profRole) continue;

  const members = profRole.members;
  if (members.size === 0) continue;

  const emoji = getEmojiByName(guild, prof.toLowerCase()) || "•";
  professionsList += `${emoji} **${prof}** - ${members.size}\n`;
}

if (professionsList === "") {
  embed.description = "Няма намерени членове с избрани професии.";
} else {
  embed.fields.push({
    name: "Професии",
    value: professionsList,
    inline: false
  });
}

  if (embed.fields.length === 0) {
    embed.description = "Няма намерени членове с избрани професии.";
  }

  return interaction.reply({ embeds: [embed] });
}

async function handleHelp(interaction) {
  const embed = {
    color: 0x00ff00,
    title: "Помощ за командите на WoW Discord бота",
    description: "Тук можеш да видиш как се използват командите на бота:",
    fields: [
      {
        name: "/roleinfo",
        value:
          "Показва WoW роли и класове с брой членове.\n" +
          "- Можеш да филтрираш по роля: DPS, Tank, Healer.\n" +
          "- Можеш да филтрираш по клас (напр. Warrior, Mage).\n" +
          "Пример: `/roleinfo role:DPS` или `/roleinfo class:Warrior`",
        inline: false,
      },
      {
        name: "/professions",
        value:
          "Показва професии и брой членове.\n" +
          "- Можеш да филтрираш по професия (напр. Alchemy, Woodcutting).\n" +
          "Пример: `/professions profession:Alchemy`",
        inline: false,
      },
      {
        name: "/help",
        value: "Показва тази помощ и информация за командите.",
        inline: false,
      },
    ],
    timestamp: new Date(),
    footer: { text: "WoW Discord Bot" },
  };

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

client.on("interactionCreate", async interaction => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName === "roleinfo") {
    await handleRoleInfo(interaction);
  } else if (interaction.commandName === "professions") {
    await handleProfessions(interaction);
  } else if (interaction.commandName === "help") {
    await handleHelp(interaction);
  }
});

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

    for (const category of ["DPS", "Tank", "Healer"]) {
      const role = guild.roles.cache.find(r => r.name.toLowerCase() === category.toLowerCase());
      if (!role) continue;

      const members = role.members.filter(m =>
        !m.roles.cache.some(r => r.name.toLowerCase().endsWith("-alt"))
      );
      roleCounts[category] = members.size;
    }

    return `DPS - ${roleCounts.DPS} | Tank - ${roleCounts.Tank} | Healer - ${roleCounts.Healer}`;
  }

  async function setNextStatus() {
    let statusText;

    if (index % 4 === 3) {
      statusText = await updateDynamicStatus();
    } else {
      statusText = staticStatuses[index % staticStatuses.length];
    }

    client.user.setPresence({
      activities: [{ name: statusText, type: 0 }],
      status: "online"
    });

    index++;
  }

  // Първи статус
  await setNextStatus();

  // Промяна на статуса на всеки 5 минути
  setInterval(setNextStatus, 300000);
});
client.login(TOKEN)
  .then(() => console.log("✅ Опит за свързване с Discord..."))
  .catch(err => console.error("❌ Грешка при логване в Discord:", err));



