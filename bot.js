// bot.js
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

// --- Конфигурация класове и роли ---
const wowClasses = ["Druid","Hunter","Mage","Paladin","Priest","Rogue","Shaman","Warlock","Warrior"];
const roleEmojis = { "Tank":"🛡️", "Healer":"💚", "Melee DPS":"⚔️", "Ranged DPS":"🏹" };
const classEmojis = {
  "Druid":":druid:", "Hunter":":hunter:", "Mage":":mage:", "Paladin":":paladin:", 
  "Priest":":priest:", "Rogue":":rogue:", "Shaman":":shaman:", "Warlock":":warlock:", "Warrior":":warrior:"
};

// --- Демо структура за райд ---
let raid = {
  info: { name:"", date:"", time:"", maxParticipants:0, maxTank:0, maxHealer:0, image:"" },
  participants: [] // {id,class,spec,role}
};

// --- Функция за автоматично определяне на ролята по специализация ---
function getRoleBySpec(cls,spec) {
  const tankSpecs = { "Warrior":["Protection"], "Paladin":["Protection"], "Shaman":["Enhancement"] };
  const healerSpecs = { "Druid":["Restoration"], "Paladin":["Holy"], "Priest":["Holy"], "Shaman":["Restoration"] };
  const rangedSpecs = { "Hunter":["Beast Mastery","Marksmanship","Survival"], "Mage":["All"], "Warlock":["All"], "Priest":["Shadow"] };
  const meleeSpecs = { "Rogue":["All"], "Warrior":["Arms","Fury"], "Paladin":["Retribution"], "Shaman":["Enhancement"] };

  if(tankSpecs[cls]?.includes(spec)) return "Tank";
  if(healerSpecs[cls]?.includes(spec)) return "Healer";
  if(meleeSpecs[cls]?.includes(spec)) return "Melee DPS";
  return "Ranged DPS";
}

// --- Embed Builder ---
function buildRaidEmbed() {
  const embed = new EmbedBuilder()
    .setTitle(`${raid.info.name} - ${raid.info.date} ${raid.info.time}`)
    .setColor(0x00ff00);
  if(raid.info.image && raid.info.image.trim().length>0) embed.setDescription(raid.info.image);

  // Статистика роли
  const rolesCount = { "Tank":0,"Healer":0,"Melee DPS":0,"Ranged DPS":0 };
  raid.participants.forEach(p => rolesCount[p.role]++);
  embed.addFields([{ 
    name:"Roles", value:
      `${roleEmojis["Tank"]} Tank - ${rolesCount["Tank"]}\n`+
      `${roleEmojis["Healer"]} Healer - ${rolesCount["Healer"]}\n`+
      `${roleEmojis["Melee DPS"]} Melee DPS - ${rolesCount["Melee DPS"]}\n`+
      `${roleEmojis["Ranged DPS"]} Ranged DPS - ${rolesCount["Ranged DPS"]}`, inline:true
  }]);

  // Класове с участници, 3 колони
  wowClasses.forEach(cls=>{
    const members = raid.participants.filter(p=>p.class===cls);
    if(members.length>0) {
      const names = members.map(p=>`${classEmojis[cls]} <@${p.id}>`).join("\n");
      embed.addFields([{ name: cls, value:names, inline:true }]);
    }
  });

  return embed;
}

// --- Създаване на селект меню ---
function createSelectMenu(userId) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`select_raid_${userId}`)
      .setPlaceholder("Избери клас")
      .addOptions(wowClasses.map(cls=>({label:cls,value:cls})))
  );
}

// --- Events ---
client.on('clientReady', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async interaction=>{
  if(interaction.isChatInputCommand()){
    if(interaction.commandName==="create"){
      // Записваме info от /create command
      raid.info.name = interaction.options.getString("raidname");
      raid.info.date = interaction.options.getString("date");
      raid.info.time = interaction.options.getString("time");
      raid.info.maxParticipants = interaction.options.getInteger("maxparticipants");
      raid.info.maxTank = interaction.options.getInteger("maxtank");
      raid.info.maxHealer = interaction.options.getInteger("maxhealer");
      raid.info.image = interaction.options.getString("image");
      await interaction.reply({ embeds:[buildRaidEmbed()], components:[createSelectMenu(interaction.user.id)] });
    }
  }

  if(interaction.isStringSelectMenu()){
    const cls = interaction.values[0];
    // TODO: след избор на клас -> специализация -> роля
    const spec = "Default"; // placeholder
    const role = getRoleBySpec(cls,spec);

    // Проверка за дублиране
    if(raid.participants.find(p=>p.id===interaction.user.id)){
      await interaction.reply({ content:"Вече сте записан!", ephemeral:true });
      return;
    }

    raid.participants.push({ id:interaction.user.id, class:cls, spec, role });
    await interaction.update({ embeds:[buildRaidEmbed()], components:[] });
  }
});

client.login("YOUR_TOKEN_HERE");
