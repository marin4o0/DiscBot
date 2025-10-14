const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

// -------------------- Конфигурации --------------------

const wowClasses = [
  "Druid", "Hunter", "Mage", "Paladin", "Priest", "Rogue", "Shaman", "Warlock", "Warrior"
];

const specializations = {
  Druid: ["Feral", "Balance", "Restoration"],
  Hunter: ["Beast Mastery", "Marksmanship", "Survival"],
  Mage: ["Frost", "Fire", "Arcane"],
  Paladin: ["Holy", "Protection", "Retribution"],
  Priest: ["Discipline", "Holy", "Shadow"],
  Rogue: ["Assassination", "Combat", "Subtlety"],
  Shaman: ["Enhancement", "Elemental", "Restoration"],
  Warlock: ["Affliction", "Demonology", "Destruction"],
  Warrior: ["Arms", "Fury", "Protection"]
};

const rolesForRaid = ["Tank", "Healer", "Melee DPS", "Ranged DPS"];

const raidLimits = {
  total: 25,
  min: 10,
  Tank: 2,
  Healer: 4
};

let activeRaids = {}; // key: messageId, value: raid data

// -------------------- Помощни функции --------------------

function getEmojiByName(guild, name) {
  const emoji = guild.emojis.cache.find(e => e.name.toLowerCase() === name.toLowerCase());
  return emoji ? emoji.toString() : "•";
}

function formatRaidEmbed(raid) {
  const embed = {
    color: 0x0099ff,
    title: `${raid.name} - ${raid.date} ${raid.time}`,
    description: "",
    fields: [],
    timestamp: new Date(),
    footer: { text: "WoW Raid Bot" }
  };

  // Първи ред: роли
  const roleCounts = {};
  for (const r of rolesForRaid) roleCounts[r] = 0;
  for (const player of raid.players) {
    roleCounts[player.role]++;
  }

  embed.fields.push({
    name: rolesForRaid.map(r => `${getEmojiByName(raid.guild, r)} ${r} - ${roleCounts[r]}`).join(" | "),
    value: "\u200B",
    inline: false
  });

  // Класове по 3 на ред
  const classPlayers = {};
  for (const cls of wowClasses) classPlayers[cls] = [];
  for (const player of raid.players) {
    classPlayers[player.class].push(player);
  }

  const classRows = [];
  let row = [];
  for (const cls of wowClasses) {
    if (classPlayers[cls].length > 0) {
      const emoji = getEmojiByName(raid.guild, cls);
      row.push(`${emoji} ${cls}`);
      if (row.length === 3) {
        classRows.push(row.join(" | "));
        row = [];
      }
    }
  }
  if (row.length > 0) classRows.push(row.join(" | "));

  for (const r of classRows) embed.fields.push({ name: r, value: "\u200B", inline: false });

  // Играчите под класовете
  for (const cls of wowClasses) {
    const players = classPlayers[cls];
    if (players.length > 0) {
      const names = players.map((p, i) => `${i + 1}. <@${p.id}>`).join("\n");
      embed.fields.push({ name: `${cls} Players`, value: names, inline: false });
    }
  }

  return embed;
}

// -------------------- Команди --------------------

const commands = [
  new SlashCommandBuilder()
    .setName("create")
    .setDescription("Създава нов рейд")
    .addStringOption(opt => opt.setName("raidname").setDescription("Име на рейда").setRequired(true))
    .addStringOption(opt => opt.setName("date").setDescription("Дата (dd.mm.yyyy)").setRequired(true))
    .addStringOption(opt => opt.setName("time").setDescription("Час (hh:mm)").setRequired(true))
    .toJSON(),
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Помощ за командите")
    .toJSON()
];

const rest = new REST({ version: "10" }).setToken(TOKEN);
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

// -------------------- Interaction --------------------

client.on("interactionCreate", async interaction => {
  if (interaction.isCommand()) {
    if (interaction.commandName === "create") {
      const raidName = interaction.options.getString("raidname");
      const date = interaction.options.getString("date");
      const time = interaction.options.getString("time");

      const raid = {
        guild: interaction.guild,
        name: raidName,
        date,
        time,
        players: []
      };

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("raid-signup")
        .setPlaceholder("Избери клас и специализация")
        .addOptions(
          Object.entries(specializations).flatMap(([cls, specs]) => specs.map(spec => ({
            label: `${cls} - ${spec}`,
            value: `${cls}:${spec}`
          })))
        );

      const row = new ActionRowBuilder().addComponents(selectMenu);

      const msg = await interaction.reply({ content: "@everyone Рейдът е създаден!", components: [row], fetchReply: true });
      activeRaids[msg.id] = raid;

    } else if (interaction.commandName === "help") {
      await interaction.reply({
        content: "/create raidname дата време - създава рейд",
        ephemeral: true
      });
    }
  }

  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === "raid-signup") {
      const [cls, spec] = interaction.values[0].split(":");
      const raid = activeRaids[interaction.message.id];
      if (!raid) return;

      const playerExists = raid.players.find(p => p.id === interaction.user.id);
      if (playerExists) {
        await interaction.reply({ content: "Вече си записан за този рейд!", ephemeral: true });
        return;
      }

      // Определяне на ролята
      let role = "Melee DPS";
      if (["Priest", "Druid", "Paladin", "Shaman"].includes(cls) && spec === "Restoration" || spec === "Holy" || spec === "Discipline") role = "Healer";
      if (["Warrior", "Paladin", "Druid", "Shaman"].includes(cls) && spec === "Protection") role = "Tank";
      if (["Hunter", "Mage", "Warlock", "Rogue"].includes(cls)) role = "Ranged DPS";

      // Проверка лимити
      if (raid.players.length >= raidLimits.total) {
        await interaction.reply({ content: "Рейдът е пълен!", ephemeral: true });
        return;
      }
      if (role === "Tank" && raid.players.filter(p => p.role === "Tank").length >= raidLimits.Tank) {
        await interaction.reply({ content: "Достигнат е лимитът за танкове!", ephemeral: true });
        return;
      }
      if (role === "Healer" && raid.players.filter(p => p.role === "Healer").length >= raidLimits.Healer) {
        await interaction.reply({ content: "Достигнат е лимитът за хиълъри!", ephemeral: true });
        return;
      }

      raid.players.push({ id: interaction.user.id, class: cls, spec, role });
      const embed = formatRaidEmbed(raid);
      await interaction.update({ embeds: [embed] });
    }
  }
});

// -------------------- Login --------------------

client.once("clientReady", () => {
  console.log(`✅ Логнат като ${client.user.tag}`);
});

client.login(TOKEN)
  .then(() => console.log("✅ Опит за свързване с Discord..."))
  .catch(err => console.error("❌ Грешка при логване в Discord:", err));
