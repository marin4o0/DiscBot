const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType, EmbedBuilder } = require("discord.js");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

// ---------------- WoW данни ----------------
const wowClasses = ["Druid","Hunter","Mage","Paladin","Priest","Rogue","Shaman","Warlock","Warrior"];
const classSpecs = {
  Druid: ["Feral","Balance","Restoration"],
  Hunter: ["Beast Mastery","Marksmanship","Survival"],
  Mage: ["Arcane","Fire","Frost"],
  Paladin: ["Holy","Protection","Retribution"],
  Priest: ["Holy","Discipline","Shadow"],
  Rogue: ["Assassination","Combat","Subtlety"],
  Shaman: ["Elemental","Enhancement","Restoration","Tank"], // Custom Tank spec
  Warlock: ["Affliction","Demonology","Destruction"],
  Warrior: ["Arms","Fury","Protection"]
};

// Map специализация -> ролята
const specRoles = {
  Feral: "Melee DPS",
  Balance: "Ranged DPS",
  Restoration: "Healer",
  BeastMastery: "Ranged DPS",
  Marksmanship: "Ranged DPS",
  Survival: "Ranged DPS",
  Arcane: "Ranged DPS",
  Fire: "Ranged DPS",
  Frost: "Ranged DPS",
  Holy: "Healer",
  Protection: "Tank",
  Retribution: "Melee DPS",
  Discipline: "Healer",
  Shadow: "Ranged DPS",
  Assassination: "Melee DPS",
  Combat: "Melee DPS",
  Subtlety: "Melee DPS",
  Elemental: "Ranged DPS",
  Enhancement: "Melee DPS",
  Tank: "Tank",
  Affliction: "Ranged DPS",
  Demonology: "Ranged DPS",
  Destruction: "Ranged DPS",
  Arms: "Melee DPS",
  Fury: "Melee DPS",
  WarriorProtection: "Tank"
};

const raidData = {}; // { messageId: { info, participants: [] } }

// ---------------- Slash Commands ----------------
const commands = [
  new SlashCommandBuilder()
    .setName("create")
    .setDescription("Създава нов рейд")
    .addStringOption(opt => opt.setName("name").setDescription("Raid Name").setRequired(true))
    .addStringOption(opt => opt.setName("date").setDescription("YYYY-MM-DD").setRequired(true))
    .addStringOption(opt => opt.setName("time").setDescription("HH:MM").setRequired(true))
    .addIntegerOption(opt => opt.setName("maxplayers").setDescription("Максимален брой участници").setRequired(true))
    .addIntegerOption(opt => opt.setName("maxtank").setDescription("Максимален брой танкове").setRequired(true))
    .addIntegerOption(opt => opt.setName("maxhealer").setDescription("Максимален брой хийлъри").setRequired(true))
    .addStringOption(opt => opt.setName("image").setDescription("Линк за картинка").setRequired(false))
    .toJSON()
].map(c=>c);

// Регистрация
const rest = new REST({ version: "10" }).setToken(TOKEN);
(async () => {
  try {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log("✅ Командите са регистрирани!");
  } catch (err) {
    console.error(err);
  }
})();

// ---------------- Helper Functions ----------------
function getEmojiByName(guild, name) {
  const e = guild.emojis.cache.find(em => em.name.toLowerCase() === name.toLowerCase());
  return e ? e.toString() : "•";
}

function buildRaidEmbed(raid) {
  const embed = new EmbedBuilder()
    .setTitle(`${raid.info.name} - ${raid.info.date} ${raid.info.time}`)
    .setDescription(raid.info.image || "")
    .setColor(0x00ff00);

  // Статистика роли
  const rolesCount = { "Tank":0,"Healer":0,"Melee DPS":0,"Ranged DPS":0 };
  raid.participants.forEach(p => rolesCount[p.role]++);
  embed.addFields([
    { name: "Roles", value:
      `🛡️Tank - ${rolesCount["Tank"]}\n`+
      `💚Healer - ${rolesCount["Healer"]}\n`+
      `⚔️Melee DPS - ${rolesCount["Melee DPS"]}\n`+
      `🏹Ranged DPS - ${rolesCount["Ranged DPS"]}`, inline: true }
  ]);

  // Класове с участници, 3 колони
  const classFields = [];
  wowClasses.forEach((cls,i)=>{
    const participants = raid.participants.filter(p=>p.class===cls);
    const names = participants.map(p=>`${getEmojiByName(raid.guild,cls)} <@${p.id}>`).join("\n");
    if(names) classFields.push({ name: cls, value: names || "Няма", inline:true });
  });
  embed.addFields(classFields);

  return embed;
}

// ---------------- Interaction ----------------
client.on("interactionCreate", async interaction=>{
  if(interaction.isCommand()){
    if(interaction.commandName==="create"){
      const raidInfo = {
        name: interaction.options.getString("name"),
        date: interaction.options.getString("date"),
        time: interaction.options.getString("time"),
        maxplayers: interaction.options.getInteger("maxplayers"),
        maxtank: interaction.options.getInteger("maxtank"),
        maxhealer: interaction.options.getInteger("maxhealer"),
        image: interaction.options.getString("image"),
        guild: interaction.guild
      };

      const participants = [];

      // Създаване на ембед
      const embed = buildRaidEmbed({ info: raidInfo, participants, guild: interaction.guild });

      // Създаване на селект меню за класове
      const classSelect = new StringSelectMenuBuilder()
        .setCustomId("raid_class")
        .setPlaceholder("Избери клас")
        .addOptions(wowClasses.map(c=>({label:c,value:c})));

      const row = new ActionRowBuilder().addComponents(classSelect);

      const msg = await interaction.reply({ embeds:[embed], components:[row], fetchReply:true });
      raidData[msg.id] = { info: raidInfo, participants, message: msg };
    }
  }
  if(interaction.isStringSelectMenu()){
    if(interaction.customId==="raid_class"){
      const raid = raidData[interaction.message.id];
      const cls = interaction.values[0];
      const specs = classSpecs[cls];

      // Ако само 1 спецификация -> автоматично
      let chosenSpec = specs.length===1 ? specs[0] : specs[0]; // по default първата, може да добавим второ меню

      const role = specRoles[chosenSpec];

      // Проверка дублиране
      if(raid.participants.find(p=>p.id===interaction.user.id)) {
        return interaction.reply({ content:"Вече си записан!", ephemeral:true });
      }

      raid.participants.push({ id: interaction.user.id, class:cls, spec:chosenSpec, role });

      const embed = buildRaidEmbed(raid);
      await interaction.update({ embeds:[embed] });
    }
  }
});

// ---------------- Ready ----------------
client.once("clientReady", async ()=>{
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.login(TOKEN);
