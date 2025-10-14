const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

// -------------------- DATA --------------------
const wowClasses = ["Druid", "Hunter", "Mage", "Paladin", "Priest", "Rogue", "Shaman", "Warlock", "Warrior"];
const categories = ["DPS", "Tank", "Healer"];

const validClasses = {
  DPS: ["Druid","Hunter","Mage","Paladin","Rogue","Shaman","Warlock","Warrior"],
  Tank: ["Druid","Paladin","Warrior","Shaman"],
  Healer: ["Druid","Paladin","Priest","Shaman"]
};

const professions = [
  "Alchemy","Blacksmithing","Herbalism","Mining","Engineering",
  "Skinning","Leatherworking","Enchanting","Tailoring","Cooking",
  "Fishing","FirstAid","Woodcutting"
];

const classSpecs = {
  Druid: { Tank:["Guardian"], Healer:["Restoration"], DPS:["Balance","Feral"] },
  Hunter: { DPS:["Beast Mastery","Marksmanship","Survival"] },
  Mage: { DPS:["Arcane","Fire","Frost"] },
  Paladin: { Tank:["Protection"], Healer:["Holy"], DPS:["Retribution"] },
  Priest: { Healer:["Holy","Discipline"], DPS:["Shadow"] },
  Rogue: { DPS:["Assassination","Combat","Subtlety"] },
  Shaman: { Healer:["Restoration"], DPS:["Enhancement","Elemental"], Tank:["Enhancement"] },
  Warlock: { DPS:["Affliction","Demonology","Destruction"] },
  Warrior: { Tank:["Protection"], DPS:["Arms","Fury"] }
};

const dpsType = {
  Balance:"Ranged", Feral:"Melee",
  "Beast Mastery":"Ranged", Marksmanship:"Ranged", Survival:"Melee",
  Arcane:"Ranged", Fire:"Ranged", Frost:"Ranged",
  Retribution:"Melee",
  Shadow:"Ranged",
  Assassination:"Melee", Combat:"Melee", Subtlety:"Melee",
  Enhancement:"Melee", Elemental:"Ranged",
  Affliction:"Ranged", Demonology:"Ranged", Destruction:"Ranged",
  Arms:"Melee", Fury:"Melee",
  Guardian:"Tank", Protection:"Tank", Holy:"Healer", Restoration:"Healer"
};

const activeRaids = new Map();

// -------------------- UTIL --------------------
function getEmojiByName(guild,name){
  const emoji = guild.emojis.cache.find(e=>e.name===name.toLowerCase());
  return emoji ? emoji.toString() : "•";
}

// -------------------- COMMANDS --------------------
const commands = [
  new SlashCommandBuilder()
    .setName("roleinfo")
    .setDescription("Показва WoW класове и роли с брой членове")
    .addStringOption(opt=>opt.setName("role").setDescription("Филтрирай по роля").setRequired(false).addChoices(
      {name:"DPS",value:"DPS"},{name:"Tank",value:"Tank"},{name:"Healer",value:"Healer"}))
    .addStringOption(opt=>opt.setName("class").setDescription("Филтрирай по клас").setRequired(false))
    .toJSON(),
  new SlashCommandBuilder()
    .setName("professions")
    .setDescription("Показва професии и брой членове")
    .addStringOption(opt=>opt.setName("profession").setDescription("Филтрирай по професия").setRequired(false))
    .toJSON(),
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Показва информация за всички команди")
    .toJSON(),
  new SlashCommandBuilder()
    .setName("create")
    .setDescription("Създава нов рейд")
    .addStringOption(opt=>opt.setName("name").setDescription("Име на рейда").setRequired(true))
    .addStringOption(opt=>opt.setName("datetime").setDescription("Дата и час (DD.MM.YYYY HH:MM)").setRequired(true))
    .addStringOption(opt=>opt.setName("image").setDescription("Линк към снимка за ембед").setRequired(false))
    .toJSON()
];

const rest = new REST({ version:'10' }).setToken(TOKEN);
(async()=>{ try{ console.log("⚡ Регистриране на командите..."); await rest.put(Routes.applicationGuildCommands(CLIENT_ID,GUILD_ID),{body:commands}); console.log("✅ Командите са регистрирани!");}catch(err){console.error(err);}})();

// -------------------- HANDLERS --------------------
async function handleRoleInfo(interaction){ /*... стария код от финалния bot.js ...*/ }
async function handleProfessions(interaction){ /*... стария код от финалния bot.js ...*/ }
async function handleHelp(interaction){ /*... стария код от финалния bot.js ...*/ }

async function handleCreate(interaction){
  const name = interaction.options.getString("name");
  const datetime = interaction.options.getString("datetime");
  const image = interaction.options.getString("image") || null;
  const raidId = Date.now().toString();
  
  activeRaids.set(raidId,{
    name, datetime, image,
    members:{Tank:[],Healer:[],DPS:[]}
  });

  const embed = {
    color:0xffa500,
    title:`Рейд: ${name}`,
    description:`Дата и час: ${datetime}`,
    fields:[
      {name:"Tank (0)",value:"Няма записани",inline:true},
      {name:"Healer (0)",value:"Няма записани",inline:true},
      {name:"DPS (0)",value:"Няма записани",inline:true}
    ],
    image:image ? {url:image}:null,
    timestamp:new Date(),
    footer:{text:"WoW Raid Bot"}
  };

  const classMenu = new StringSelectMenuBuilder()
    .setCustomId(`raid_class_${raidId}`)
    .setPlaceholder("Избери клас")
    .addOptions(wowClasses.map(c=>({label:c,value:c})));

  const row = new ActionRowBuilder().addComponents(classMenu);

  await interaction.reply({content:`@everyone Нов рейд е създаден!`, embeds:[embed], components:[row]});
}

// -------------------- SELECT MENU --------------------
client.on("interactionCreate",async interaction=>{
  if(interaction.isCommand()){
    if(interaction.commandName==="roleinfo") await handleRoleInfo(interaction);
    else if(interaction.commandName==="professions") await handleProfessions(interaction);
    else if(interaction.commandName==="help") await handleHelp(interaction);
    else if(interaction.commandName==="create") await handleCreate(interaction);
  }
  else if(interaction.isStringSelectMenu()){
    const [type, , raidId, cls, role] = interaction.customId.split("_");
    const raid = activeRaids.get(raidId);
    if(!raid) return interaction.reply({content:"Рейдът не е намерен.",ephemeral:true});

    if(type==="raid" && interaction.customId.startsWith("raid_class")){
      const selectedClass = interaction.values[0];
      // Определяме възможни роли
      const roles = Object.keys(classSpecs[selectedClass]).filter(r=>classSpecs[selectedClass][r].length>0);
      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`raid_role_${raidId}_${selectedClass}`)
          .setPlaceholder("Избери роля")
          .addOptions(roles.map(r=>({label:r,value:r})))
      );
      await interaction.update({content:`Избери роля за ${selectedClass}`,components:[row],embeds:[]});
    }
    else if(interaction.customId.startsWith("raid_role_")){
      const selectedClass = interaction.customId.split("_")[3];
      const selectedRole = interaction.values[0];
      const specs = classSpecs[selectedClass][selectedRole] || [];

      if(specs.length===0){
        raid.members[selectedRole].push({name:interaction.user.username,class:selectedClass,spec:null});
        updateRaidEmbed(interaction,raidId);
      } else{
        const row = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`raid_spec_${raidId}_${selectedClass}_${selectedRole}`)
            .setPlaceholder("Избери специализация")
            .addOptions(specs.map(s=>({label:s,value:s})))
        );
        await interaction.update({content:`Избери специализация за ${selectedClass} (${selectedRole})`,components:[row],embeds:[]});
      }
    }
    else if(interaction.customId.startsWith("raid_spec_")){
      const parts = interaction.customId.split("_");
      const selectedClass = parts[3];
      const selectedRole = parts[4];
      const spec = interaction.values[0];
      raid.members[selectedRole].push({name:interaction.user.username,class:selectedClass,spec});
      updateRaidEmbed(interaction,raidId);
    }
  }
});

// -------------------- UPDATE RAID EMBED --------------------
function updateRaidEmbed(interaction,raidId){
  const raid = activeRaids.get(raidId);
  if(!raid) return;
  const embed = {
    color:0xffa500,
    title:`Рейд: ${raid.name}`,
    fields:[
      {name:`Tank (${raid.members.Tank.length})`,value:raid.members.Tank.length?raid.members.Tank.map((m,i)=>`${i+1}. ${m.name} (${m.class})`).join("\n"):"Няма записани",inline:true},
      {name:`Healer (${raid.members.Healer.length})`,value:raid.members.Healer.length?raid.members.Healer.map((m,i)=>`${i+1}. ${m.name} (${m.class})`).join("\n"):"Няма записани",inline:true},
      {name:`DPS (${raid.members.DPS.length})`,value:raid.members.DPS.length?raid.members.DPS.map((m,i)=>`${i+1}. ${m.name} (${m.class}${m.spec?` - ${dpsType[m.spec]}`:""})`).join("\n"):"Няма записани",inline:true}
    ],
    timestamp:new Date(),
    footer:{text:"WoW Raid Bot"}
  };
  interaction.update({embeds:[embed],components:[new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`raid_class_${raidId}`)
      .setPlaceholder("Избери клас")
      .addOptions(wowClasses.map(c=>({label:c,value:c})))
  )]});
}

// -------------------- READY & STATUS --------------------
client.once("clientReady",async()=>{
  console.log(`✅ Логнат като ${client.user.tag}`);
});

client.login(TOKEN)
  .then(()=>console.log("✅ Опит за свързване с Discord..."))
  .catch(err=>console.error("❌ Грешка при логване в Discord:",err));
