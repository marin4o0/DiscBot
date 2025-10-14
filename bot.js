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

const classSpecs = {
  Druid: [{name:"Feral", type:"Melee"}, {name:"Balance", type:"Ranged"}, {name:"Restoration", type:"Healer"}],
  Hunter: [{name:"Beast Mastery", type:"Ranged"}, {name:"Marksmanship", type:"Ranged"}, {name:"Survival", type:"Melee"}],
  Mage: [{name:"Arcane", type:"Ranged"}, {name:"Fire", type:"Ranged"}, {name:"Frost", type:"Ranged"}],
  Paladin: [{name:"Holy", type:"Healer"}, {name:"Protection", type:"Tank"}, {name:"Retribution", type:"Melee"}],
  Priest: [{name:"Discipline", type:"Healer"}, {name:"Holy", type:"Healer"}, {name:"Shadow", type:"Ranged"}],
  Rogue: [{name:"Assassination", type:"Melee"}, {name:"Combat", type:"Melee"}, {name:"Subtlety", type:"Melee"}],
  Shaman: [{name:"Elemental", type:"Ranged"}, {name:"Enhancement", type:"Melee"}, {name:"Restoration", type:"Healer"}],
  Warlock: [{name:"Affliction", type:"Ranged"}, {name:"Demonology", type:"Ranged"}, {name:"Destruction", type:"Ranged"}],
  Warrior: [{name:"Arms", type:"Melee"}, {name:"Fury", type:"Melee"}, {name:"Protection", type:"Tank"}]
};

const categories = ["Tank", "Healer", "Melee DPS", "Ranged DPS"];
const validRoles = {
  Tank: ["Druid","Paladin","Warrior","Shaman"],
  Healer: ["Druid","Paladin","Priest","Shaman"],
  "Melee DPS": ["Druid","Rogue","Shaman","Paladin","Warrior"],
  "Ranged DPS": ["Hunter","Mage","Priest","Warlock","Druid","Shaman"]
};

// Перманентен списък с желания: 
// - лимит за рейд 10-25, лимит танкове/хийлъри
// - класови икони и ролеви икони
// - автоматично определяне на DPS тип
// - ембед с имена и бройка, форматиран в колони
// - само @mention и иконка пред името
// - Node.js v22 съвместимост

const raids = {}; // key = channelId, value = raid object

// ---------------- COMMANDS ----------------
const commands = [
  new SlashCommandBuilder()
    .setName("roleinfo")
    .setDescription("Показва WoW класове и роли с брой членове")
    .addStringOption(opt => opt.setName("role").setDescription("Филтрирай по роля").setRequired(false).addChoices(
      {name:"DPS", value:"DPS"},
      {name:"Tank", value:"Tank"},
      {name:"Healer", value:"Healer"}
    ))
    .addStringOption(opt => opt.setName("class").setDescription("Филтрирай по клас").setRequired(false))
    .toJSON(),

  new SlashCommandBuilder()
    .setName("professions")
    .setDescription("Показва професии и брой членове")
    .addStringOption(opt => opt.setName("profession").setDescription("Филтрирай по професия").setRequired(false))
    .toJSON(),

  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Показва информация за всички команди")
    .toJSON(),

  new SlashCommandBuilder()
    .setName("create")
    .setDescription("Създава нов рейд")
    .addStringOption(opt => opt.setName("name").setDescription("Име на рейда").setRequired(true))
    .addStringOption(opt => opt.setName("date").setDescription("Дата на рейда").setRequired(true))
    .addStringOption(opt => opt.setName("time").setDescription("Час на рейда").setRequired(true))
    .addIntegerOption(opt => opt.setName("max").setDescription("Максимален брой участници").setRequired(true))
    .addIntegerOption(opt => opt.setName("tanklimit").setDescription("Максимум танкове").setRequired(false))
    .addIntegerOption(opt => opt.setName("healerlimit").setDescription("Максимум хийлъри").setRequired(false))
    .toJSON()
];

const rest = new REST({version:"10"}).setToken(TOKEN);
(async () => {
  try {
    console.log("⚡ Регистриране на командите...");
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID,GUILD_ID), { body: commands });
    console.log("✅ Командите са регистрирани!");
  } catch(err) { console.error(err); }
})();

// ---------------- UTILS ----------------
function getEmojiByName(guild,name){
  const emoji = guild.emojis.cache.find(e => e.name === name.toLowerCase());
  return emoji ? emoji.toString() : "•";
}

function formatRaidEmbed(raid){
  const embed = new EmbedBuilder()
    .setTitle(`${raid.name} - ${raid.date} ${raid.time}`)
    .setDescription(`@everyone`)
    .setColor(0x00FF00)
    .setTimestamp();

  // Първи ред роли
  let roleLine = "";
  for(const cat of categories){
    roleLine += `${getEmojiByName(raid.guild, cat)} ${cat} - ${raid[cat].length}  `;
  }
  embed.addFields({name:"Роли", value:roleLine, inline:false});

  // Класове 3x3
  let classRows = [];
  for(let i=0;i<wowClasses.length;i+=3){
    const row = wowClasses.slice(i,i+3).map(cls=>{
      const em = getEmojiByName(raid.guild, cls);
      return `${em} ${cls}`;
    }).join(" | ");
    classRows.push(row);
  }
  embed.addFields({name:"Класове", value:classRows.join("\n"), inline:false});

  // Имена под класове
  for(const cls of wowClasses){
    const members = raid.members.filter(m => m.class===cls);
    if(members.length>0){
      const em = getEmojiByName(raid.guild, cls);
      const names = members.map(m => `<@${m.id}>`).join("\n");
      embed.addFields({name:`${em} ${cls}`, value:names, inline:true});
    }
  }

  return embed;
}

// ---------------- INTERACTIONS ----------------
client.on("interactionCreate", async interaction=>{
  if(interaction.isCommand()){
    if(interaction.commandName==="help"){
      const embed = new EmbedBuilder()
        .setTitle("Помощ за командите на WoW Discord бота")
        .setDescription("Използвай командите на бота")
        .addFields(
          {name:"/roleinfo", value:"Показва WoW роли и класове", inline:false},
          {name:"/professions", value:"Показва професии и брой членове", inline:false},
          {name:"/create", value:"Създава нов рейд", inline:false},
          {name:"/help", value:"Показва тази помощ", inline:false}
        )
        .setTimestamp()
        .setColor(0x00FF00);
      return interaction.reply({embeds:[embed], ephemeral:true});
    }
    else if(interaction.commandName==="create"){
      const name = interaction.options.getString("name");
      const date = interaction.options.getString("date");
      const time = interaction.options.getString("time");
      const max = interaction.options.getInteger("max");
      const tanklimit = interaction.options.getInteger("tanklimit") || 10;
      const healerlimit = interaction.options.getInteger("healerlimit") || 10;

      raids[interaction.channelId] = {
        name,date,time,max,tanklimit,healerlimit,
        members:[],
        Tank:[],Healer:[], "Melee DPS":[], "Ranged DPS":[],
        guild: await client.guilds.fetch(GUILD_ID)
      };

      // Създаване на селект меню
      const select = new StringSelectMenuBuilder()
        .setCustomId("raid_select")
        .setPlaceholder("Избери клас/роля/спеца")
        .addOptions(wowClasses.map(cls=>{
          return {label:cls,value:cls};
        }));

      const row = new ActionRowBuilder().addComponents(select);

      const embed = formatRaidEmbed(raids[interaction.channelId]);
      await interaction.reply({embeds:[embed], components:[row]});
    }
  }
  else if(interaction.isStringSelectMenu()){
    const raid = raids[interaction.channelId];
    if(!raid) return interaction.reply({content:"Няма активен рейд", ephemeral:true});
    const userId = interaction.user.id;
    const cls = interaction.values[0];

    // Проверка дали вече е записан
    if(raid.members.find(m=>m.id===userId)){
      return interaction.reply({content:"Вече си записан!", ephemeral:true});
    }

    // Определяне на специализация автоматично, първата налична
    const specObj = classSpecs[cls][0];
    const roleType = specObj.type==="Melee" || specObj.type==="Ranged"? specObj.type+" DPS": specObj.type;

    // Лимити
    if(roleType==="Tank" && raid.Tank.length>=raid.tanklimit) return interaction.reply({content:"Танковете са пълни", ephemeral:true});
    if(roleType==="Healer" && raid.Healer.length>=raid.healerlimit) return interaction.reply({content:"Хийлърите са пълни", ephemeral:true});
    if(raid.members.length>=raid.max) return interaction.reply({content:"Рейдът е пълен", ephemeral:true});

    // Добавяне
    raid.members.push({id:userId,class:cls,spec:specObj.name,role:roleType});
    raid[roleType].push(userId);

    const embed = formatRaidEmbed(raid);
    await interaction.update({embeds:[embed]});
  }
});

// ---------------- READY ----------------
client.on("clientReady", async ()=>{
  console.log(`✅ Логнат като ${client.user.tag}`);

  const guild = await client.guilds.fetch(GUILD_ID);
  await guild.members.fetch();

  const staticStatuses = [
    "Използвай /help и научи какво има нужда гилдията!",
    "Използвай /professions за да научиш какви професии",
    "Използвай /roleinfo за да научиш коя роля е нужна"
  ];

  let index=0;
  async function setNextStatus(){
    let statusText;
    if(index%4===3){
      // динамично брой роли
      const roleCounts = {Tank:0,Healer:0,"Melee DPS":0,"Ranged DPS":0};
      for(const cat of Object.keys(roleCounts)){
        const role = guild.roles.cache.find(r=>r.name.toLowerCase()===cat.toLowerCase());
        if(!role) continue;
        const members = role.members.filter(m=>!m.roles.cache.some(r=>r.name.toLowerCase().endsWith("-alt")));
        roleCounts[cat]=members.size;
      }
      statusText=`Tank:${roleCounts.Tank} | Healer:${roleCounts.Healer} | Melee DPS:${roleCounts["Melee DPS"]} | Ranged DPS:${roleCounts["Ranged DPS"]}`;
    }
    else statusText=staticStatuses[index%staticStatuses.length];
    client.user.setPresence({activities:[{name:statusText,type:0}],status:"online"});
    index++;
  }
  await setNextStatus();
  setInterval(setNextStatus,300000);
});

// ---------------- LOGIN ----------------
client.login(TOKEN)
  .then(()=>console.log("✅ Опит за свързване с Discord..."))
  .catch(err=>console.error("❌ Грешка при логване в Discord:",err));
