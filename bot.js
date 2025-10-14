const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const wowClasses = ["Druid","Hunter","Mage","Paladin","Priest","Rogue","Shaman","Warlock","Warrior"];
const specializations = {
  Druid:["Feral","Restoration","Balance"],
  Hunter:["Beast Mastery","Marksmanship","Survival"],
  Mage:["Frost","Fire","Arcane"],
  Paladin:["Holy","Protection","Retribution"],
  Priest:["Holy","Shadow","Discipline"],
  Rogue:["Assassination","Combat","Subtlety"],
  Shaman:["Elemental","Enhancement","Restoration"], // Enhancement може да е Tank
  Warlock:["Affliction","Demonology","Destruction"],
  Warrior:["Arms","Fury","Protection"]
};

const roleIcons = { "Tank":"🛡️", "Healer":"💚", "Melee DPS":"⚔️", "Ranged DPS":"🏹" };

let raids = new Map(); // raidId => { name, date, time, maxPlayers, maxTank, maxHealer, image, participants:{userId:{class,spec,role}} }

// ------------------------- HELPERS -------------------------

function getClassEmoji(guild, clsName){
  const emoji = guild.emojis.cache.find(e => e.name.toLowerCase() === clsName.toLowerCase());
  return emoji ? emoji.toString() : "•";
}

function determineRole(cls,spec){
  // Tank
  if((cls==="Shaman" && spec==="Enhancement") || (cls==="Warrior" && spec==="Protection") || (cls==="Paladin" && spec==="Protection") || (cls==="Druid" && spec==="Feral")) return "Tank";
  // Healer
  if(spec==="Restoration" || spec==="Holy" || spec==="Discipline") return "Healer";
  // Melee vs Ranged DPS
  const meleeSpecs = ["Feral","Enhancement","Retribution","Arms","Fury","Combat","Assassination"];
  return meleeSpecs.includes(spec) ? "Melee DPS":"Ranged DPS";
}

// ------------------------- COMMANDS -------------------------

const commands = [
  new SlashCommandBuilder()
    .setName("create")
    .setDescription("Създава нов рейд")
    .addStringOption(opt=>opt.setName("name").setDescription("Raid Name").setRequired(true))
    .addStringOption(opt=>opt.setName("date").setDescription("YYYY-MM-DD").setRequired(true))
    .addStringOption(opt=>opt.setName("time").setDescription("HH:MM").setRequired(true))
    .addIntegerOption(opt=>opt.setName("maxplayers").setDescription("Максимален брой участници").setRequired(true))
    .addIntegerOption(opt=>opt.setName("maxtank").setDescription("Максимален брой танкове").setRequired(true))
    .addIntegerOption(opt=>opt.setName("maxhealer").setDescription("Максимален брой хийлъри").setRequired(true))
    .addStringOption(opt=>opt.setName("image").setDescription("Линк за картинка").setRequired(false))
    .toJSON()
].map(c=>c.toJSON());

// ------------------------- REGISTER COMMANDS -------------------------

const rest = new REST({ version:'10' }).setToken(TOKEN);
(async()=>{try{await rest.put(Routes.applicationGuildCommands(CLIENT_ID,GUILD_ID),{body:commands});console.log("Commands registered");}catch(e){console.error(e);}})();

// ------------------------- RAID EMBED -------------------------

async function updateRaidEmbed(interaction, raidId){
  const raid = raids.get(raidId);
  const guild = await client.guilds.fetch(GUILD_ID);
  await guild.emojis.fetch();

  const roleCount = { "Tank":0, "Healer":0, "Melee DPS":0, "Ranged DPS":0 };
  for(const p of Object.values(raid.participants)) roleCount[p.role] = (roleCount[p.role]||0)+1;

  const stats = `${roleIcons.Tank} Tank - ${roleCount.Tank}    ${roleIcons.Healer} Healer - ${roleCount.Healer}    ${roleIcons["Melee DPS"]} Melee DPS - ${roleCount["Melee DPS"]}    ${roleIcons["Ranged DPS"]} Ranged DPS - ${roleCount["Ranged DPS"]}`;

  const classesWithPlayers = wowClasses.filter(cls => Object.values(raid.participants).some(p=>p.class===cls)).sort();
  const classFields = [];
  for(let i=0;i<classesWithPlayers.length;i+=3){
    const row = classesWithPlayers.slice(i,i+3);
    row.forEach(cls=>{
      const members = Object.entries(raid.participants).filter(([id,p])=>p.class===cls).map(([id,p])=>`${getClassEmoji(guild,cls)} <@${id}>`);
      classFields.push({ name:cls, value:members.join("\n")||"\u200B", inline:true });
    });
  }

  const embed = {
    color:0x0099ff,
    title:`${raid.name} (${raid.date} ${raid.time})`,
    description:"Рейд записване",
    fields:[{name:"Статистика",value:stats,inline:false}, ...classFields],
    image: raid.image?{url:raid.image}:undefined,
    timestamp:new Date(),
    footer:{text:"WoW Discord Bot"}
  };

  if(interaction.message) await interaction.message.edit({ embeds:[embed] });
  else await interaction.reply({ embeds:[embed] });
}

// ------------------------- INTERACTIONS -------------------------

client.on("interactionCreate",async interaction=>{
  if(!interaction.isCommand()&&!interaction.isStringSelectMenu()&&!interaction.isButton()) return;

  // ---- /create ----
  if(interaction.isCommand()&&interaction.commandName==="create"){
    const raidId = Date.now().toString();
    raids.set(raidId,{
      name:interaction.options.getString("name"),
      date:interaction.options.getString("date"),
      time:interaction.options.getString("time"),
      maxPlayers:interaction.options.getInteger("maxplayers"),
      maxTank:interaction.options.getInteger("maxtank"),
      maxHealer:interaction.options.getInteger("maxhealer"),
      image:interaction.options.getString("image"),
      participants:{}
    });

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`raid_select_${raidId}`)
        .setPlaceholder("Избери клас")
        .addOptions(wowClasses.map(cls=>({label:cls,value:cls})))
    );

    await interaction.reply({ content:`Създаден е рейд: ${interaction.options.getString("name")}`, components:[row]});
  }

  // ---- SELECT MENU ----
  if(interaction.isStringSelectMenu()&&interaction.customId.startsWith("raid_select_")){
    const raidId = interaction.customId.split("raid_select_")[1];
    const raid = raids.get(raidId);
    const cls = interaction.values[0];
    const specs = specializations[cls];
    if(specs.length===1){
      const spec = specs[0];
      const role = determineRole(cls,spec);
      raid.participants[interaction.user.id]={class:cls,spec:spec,role:role};
      await updateRaidEmbed(interaction,raidId);
      await interaction.update({ components:[] }); // маха селект менюто
    }else{
      const specRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`raid_spec_${raidId}_${cls}`)
          .setPlaceholder("Избери специализация")
          .addOptions(specs.map(s=>({label:s,value:s})))
      );
      await interaction.update({ components:[specRow] });
    }
  }

  // ---- SPEC SELECT ----
  if(interaction.isStringSelectMenu()&&interaction.customId.startsWith("raid_spec_")){
    const [_,raidId,cls] = interaction.customId.split("_");
    const raid = raids.get(raidId);
    const spec = interaction.values[0];
    const role = determineRole(cls,spec);
    raid.participants[interaction.user.id]={class:cls,spec:spec,role:role};
    await updateRaidEmbed(interaction,raidId);
    await interaction.update({ components:[] });
  }

  // ---- UNSUBSCRIBE BUTTON (ще се добавя ако се наложи) ----
});

// ------------------------- OLD BOT CODE (Класове и Професии) -------------------------
// ...тук поставяш стария код без промени

client.once("ready",()=>{console.log(`Logged in as ${client.user.tag}`);});
client.login(TOKEN);
