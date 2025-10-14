const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const wowClasses = ["Druid","Hunter","Mage","Paladin","Priest","Rogue","Shaman","Warlock","Warrior"];
const categories = ["DPS","Tank","Healer"];

const validClasses = {
  DPS:["Druid","Hunter","Mage","Paladin","Rogue","Shaman","Warlock","Warrior"],
  Tank:["Druid","Paladin","Warrior","Shaman"],
  Healer:["Druid","Paladin","Priest","Shaman"]
};

const professions = [
  "Alchemy","Blacksmithing","Herbalism","Mining","Engineering",
  "Skinning","Leatherworking","Enchanting","Tailoring","Cooking",
  "Fishing","FirstAid","Woodcutting"
];

// специализации за класовете
const classSpecs = {
  Druid: ["Balance","Feral","Restoration","Guardian"],
  Hunter: ["Beast Mastery","Marksmanship","Survival"],
  Mage: ["Arcane","Fire","Frost"],
  Paladin: ["Holy","Protection","Retribution"],
  Priest: ["Discipline","Holy","Shadow"],
  Rogue: ["Assassination","Combat","Subtlety"],
  Shaman: ["Elemental","Enhancement","Restoration","Tank"],
  Warlock: ["Affliction","Demonology","Destruction"],
  Warrior: ["Arms","Fury","Protection"]
};

// роли с емоджита
const roleEmojis = { DPS:"🗡️", Tank:"🛡️", Healer:"💉" };

// ---------- функции ----------
function getEmojiByName(guild, name) {
  const emoji = guild.emojis.cache.find(e => e.name === name.toLowerCase());
  return emoji ? emoji.toString() : "•";
}

function isAdmin(userRoles) {
  const allowed = ["Admin","Moderator","Raid Leader","Officer"];
  return userRoles.some(r => allowed.includes(r.name));
}

// ---------- Команди ----------
const commands = [
  new SlashCommandBuilder()
    .setName("roleinfo")
    .setDescription("Показва WoW класове и роли с брой членове")
    .addStringOption(o => o.setName("role").setDescription("Филтрирай по роля").setRequired(false).addChoices({name:"DPS",value:"DPS"},{name:"Tank",value:"Tank"},{name:"Healer",value:"Healer"}))
    .addStringOption(o => o.setName("class").setDescription("Филтрирай по клас").setRequired(false))
    .toJSON(),
  new SlashCommandBuilder()
    .setName("professions")
    .setDescription("Показва професии и брой членове")
    .addStringOption(o => o.setName("profession").setDescription("Филтрирай по професия").setRequired(false))
    .toJSON(),
  new SlashCommandBuilder()
    .setName("create")
    .setDescription("Създава нов рейд")
    .addStringOption(o => o.setName("title").setDescription("Име на рейда").setRequired(true))
    .addStringOption(o => o.setName("date").setDescription("Дата").setRequired(true))
    .addStringOption(o => o.setName("time").setDescription("Час").setRequired(true))
    .addStringOption(o => o.setName("image").setDescription("Линк към картинка за ембед").setRequired(false))
    .toJSON(),
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Показва помощ")
    .toJSON()
];

const rest = new REST({ version:'10' }).setToken(TOKEN);
(async()=>{
  try{
    console.log("⚡ Регистриране на командите...");
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID,GUILD_ID),{body:commands});
    console.log("✅ Командите са регистрирани!");
  }catch(err){console.error(err);}
})();

// ---------- HANDLERS ----------
async function handleRoleInfo(interaction){
  const guild = await client.guilds.fetch(GUILD_ID);
  await guild.members.fetch();
  await guild.emojis.fetch();

  const selectedRole = interaction.options.getString("role");
  const selectedClass = interaction.options.getString("class");

  const embed={ color:0x0099ff,title:"Информация за роли и класове",description:"",fields:[],timestamp:new Date(),footer:{text:"WoW Discord Bot"} };

  if(selectedClass){
    const classRole=guild.roles.cache.find(r=>r.name.toLowerCase()===selectedClass.toLowerCase());
    if(!classRole){ embed.description="Не е намерен такъв клас."; return interaction.reply({embeds:[embed],flags:1<<6}); }
    embed.color=classRole.color||0x0099ff;

    for(const cat of categories){
      if(!validClasses[cat].includes(selectedClass)) continue;
      if(selectedRole&&selectedRole!==cat) continue;

      const catRole=guild.roles.cache.find(r=>r.name.toLowerCase()===cat.toLowerCase());
      if(!catRole) continue;

      const altRole=guild.roles.cache.find(r=>r.name.toLowerCase()===`${selectedClass.toLowerCase()}-alt`);
      const members=classRole.members.filter(m=>m.roles.cache.has(catRole.id)&&(!altRole||!m.roles.cache.has(altRole.id)));
      if(members.size>0){
        const emoji=getEmojiByName(guild,selectedClass);
        embed.fields.push({name:`${emoji} ${selectedClass} (${cat})`,value:`Брой: ${members.size}`,inline:false});
      }
    }
    if(embed.fields.length===0){embed.description="Няма членове, които отговарят на зададените критерии.";}
    return interaction.reply({embeds:[embed],flags:1<<6});
  }

  const categoriesToShow=selectedRole?[selectedRole]:categories;
  for(const category of categoriesToShow){
    let totalCount=0;
    let categoryValue="";
    for(const cls of wowClasses.sort()){
      if(!validClasses[category].includes(cls)) continue;
      const classRole=guild.roles.cache.find(r=>r.name.toLowerCase()===cls.toLowerCase());
      const categoryRole=guild.roles.cache.find(r=>r.name.toLowerCase()===category.toLowerCase());
      if(!classRole||!categoryRole) continue;
      const altRole=guild.roles.cache.find(r=>r.name.toLowerCase()===`${cls.toLowerCase()}-alt`);
      const members=classRole.members.filter(m=>m.roles.cache.has(categoryRole.id)&&(!altRole||!m.roles.cache.has(altRole.id)));
      if(members.size>0){
        const emoji=getEmojiByName(guild,cls.toLowerCase());
        categoryValue+=`${emoji} ${cls} - ${members.size}\n`;
        totalCount+=members.size;
      }
    }
    if(totalCount>0){
      const categoryRole=guild.roles.cache.find(r=>r.name.toLowerCase()===category.toLowerCase());
      embed.color=categoryRole?.color||embed.color;
      embed.fields.push({name:`${category} (Общо: ${totalCount})`,value:categoryValue,inline:false});
    }
  }
  if(embed.fields.length===0){embed.description="Няма намерени членове по зададените критерии.";}
  return interaction.reply({embeds:[embed],flags:1<<6});
}

async function handleProfessions(interaction){
  const guild = await client.guilds.fetch(GUILD_ID);
  await guild.members.fetch();
  await guild.emojis.fetch();

  const selectedProfession=interaction.options.getString("profession");
  const embed={color:0x0099ff,title:"Информация за професии",description:"",fields:[],timestamp:new Date(),footer:{text:"WoW Discord Bot"}};

  if(selectedProfession){
    const profRole=guild.roles.cache.find(r=>r.name.toLowerCase()===selectedProfession.toLowerCase());
    if(!profRole){ embed.description="Не е намерена такава професия."; return interaction.reply({embeds:[embed],flags:1<<6}); }
    embed.color=profRole.color||embed.color;
    const members=profRole.members;
    const emoji=getEmojiByName(guild,selectedProfession.toLowerCase())||"•";
    embed.fields.push({name:`${emoji} ${selectedProfession}`,value:`Брой: ${members.size}`,inline:false});
    return interaction.reply({embeds:[embed],flags:1<<6});
  }

  let professionsList="";
  for(const prof of professions.sort()){
    const profRole=guild.roles.cache.find(r=>r.name.toLowerCase()===prof.toLowerCase());
    if(!profRole) continue;
    const members=profRole.members;
    if(members.size===0) continue;
    const emoji=getEmojiByName(guild,prof.toLowerCase())||"•";
    professionsList+=`${emoji} ${prof} - ${members.size}\n`;
  }
  if(professionsList===""){embed.description="Няма намерени членове с избрани професии.";}
  else{embed.fields.push({name:"Професии",value:professionsList,inline:false});}
  return interaction.reply({embeds:[embed],flags:1<<6});
}

async function handleHelp(interaction){
  const embed={
    color:0x00ff00,
    title:"Помощ за командите на WoW Discord бота",
    description:"Тук можеш да видиш как се използват командите на бота:",
    fields:[
      {name:"/roleinfo",value:"Показва WoW роли и класове с брой членове.\n- Можеш да филтрираш по роля: DPS, Tank, Healer.\n- Можеш да филтрираш по клас (напр. Warrior, Mage).\nПример: `/roleinfo role:DPS` или `/roleinfo class:Warrior`",inline:false},
      {name:"/professions",value:"Показва професии и брой членове.\n- Можеш да филтрираш по професия (напр. Alchemy, Woodcutting).\nПример: `/professions profession:Alchemy`",inline:false},
      {name:"/create",value:"Създава рейд. Пример: `/create title:\"Zul Gurub\" date:26.10.2025 time:20:00`",inline:false},
      {name:"/help",value:"Показва тази помощ.",inline:false}
    ],
    timestamp:new Date(),
    footer:{text:"WoW Discord Bot"}
  };
  return interaction.reply({embeds:[embed],flags:1<<6});
}

// ---------- INTERACTIONS ----------
client.on("interactionCreate",async interaction=>{
  if(interaction.isCommand()){
    if(interaction.commandName==="roleinfo") await handleRoleInfo(interaction);
    else if(interaction.commandName==="professions") await handleProfessions(interaction);
    else if(interaction.commandName==="help") await handleHelp(interaction);
    else if(interaction.commandName==="create") await handleCreateRaid(interaction);
  }
});

// ---------- RAID SYSTEM ----------
const raids=new Map(); // map: messageId -> raidData

async function handleCreateRaid(interaction){
  const guild=await client.guilds.fetch(GUILD_ID);
  await guild.members.fetch();
  const title=interaction.options.getString("title");
  const date=interaction.options.getString("date");
  const time=interaction.options.getString("time");
  const image=interaction.options.getString("image");

  // празен ембед
  const embed={
    title:`Рейд: ${title}`,
    description:`📅 ${date} 🕒 ${time}\n@everyone`,
    color:0x00ffff,
    fields:[
      {name:"Healers (0)",value:"-",inline:false},
      {name:"Tanks (0)",value:"-",inline:false},
      {name:"DPS (0)",value:"-",inline:false}
    ],
    timestamp:new Date(),
    footer:{text:"WoW Discord Bot"}
  };
  if(image) embed.image={url:image};

  // бутони
  const startBtn=new ButtonBuilder().setCustomId("raid_start").setLabel("Старт").setStyle(ButtonStyle.Success);
  const cancelBtn=new ButtonBuilder().setCustomId("raid_cancel").setLabel("Отмяна").setStyle(ButtonStyle.Danger);
  const row=new ActionRowBuilder().addComponents(startBtn,cancelBtn);

  const msg=await interaction.reply({embeds:[embed],components:[row],fetchReply:true});

  // съхраняване на рейд
  raids.set(msg.id,{title,date,time,image,message:msg,players:{Healer:[],Tank:[],DPS:[]}});

  // слушане на бутони
  const collector=msg.createMessageComponentCollector({componentType:1,time:3600000});
  collector.on("collect",i=>{
    const raid=raids.get(msg.id);
    if(!raid) return;
    if(i.user.bot) return;
    const memberRoles=i.member.roles.cache;
    if(i.customId==="raid_start" && !isAdmin(Array.from(memberRoles.values()))) return i.reply({content:"Нямаш права да стартираш рейда.",ephemeral:true});
    if(i.customId==="raid_cancel" && !isAdmin(Array.from(memberRoles.values()))) return i.reply({content:"Нямаш права да отмениш рейда.",ephemeral:true});
    if(i.customId==="raid_start"){
      i.update({content:"Рейдът започна!",embeds:[raid.message.embeds[0]],components:[]});
    }
    if(i.customId==="raid_cancel"){
      i.update({content:"Рейдът беше отменен.",embeds:[raid.message.embeds[0]],components:[]});
      raids.delete(msg.id);
    }
  });
}

// ---------- READY EVENT & STATUS ----------
client.once("clientReady",async()=>{
  console.log(`✅ Логнат като ${client.user.tag}`);
  const guild=await client.guilds.fetch(GUILD_ID);
  await guild.members.fetch();
  const staticStatuses=[
    "Използвай /help и научи от какво има нужда гилдията!",
    "Използвай /professions за да научиш какви професии",
    "Използвай /roleinfo за да научиш коя роля е нужна"
  ];
  let index=0;
  async function updateDynamicStatus(){
    await guild.members.fetch();
    const roleCounts={DPS:0,Tank:0,Healer:0};
    for(const category of ["DPS","Tank","Healer"]){
      const role=guild.roles.cache.find(r=>r.name.toLowerCase()===category.toLowerCase());
      if(!role) continue;
      const members=role.members.filter(m=>!m.roles.cache.some(r=>r.name.toLowerCase().endsWith("-alt")));
      roleCounts[category]=members.size;
    }
    return `DPS - ${roleCounts.DPS} | Tank - ${roleCounts.Tank} | Healer - ${roleCounts.Healer}`;
  }
  async function setNextStatus(){
    let statusText=index%4===3?await updateDynamicStatus():staticStatuses[index%staticStatuses.length];
    client.user.setPresence({activities:[{name:statusText,type:0}],status:"online"});
    index++;
  }
  await setNextStatus();
  setInterval(setNextStatus,300000);
});

// ---------- LOGIN ----------
client.login(TOKEN).then(()=>console.log("✅ Свързан с Discord")).catch(err=>console.error("❌ Грешка при логване:",err));
