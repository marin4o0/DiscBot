// bot.js — финален комбиниран код (discord.js v14)
const { 
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder
} = require("discord.js");

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error("Missing TOKEN, CLIENT_ID or GUILD_ID environment variables.");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildEmojisAndStickers]
});

// -------------------- Data: classes, specs, dps type --------------------
const wowClasses = ["Druid","Hunter","Mage","Paladin","Priest","Rogue","Shaman","Warlock","Warrior"];

const classSpecs = {
  Druid: { Tank:["Guardian"], Healer:["Restoration"], DPS:["Balance","Feral"] },
  Hunter: { DPS:["Beast Mastery","Marksmanship","Survival"] },
  Mage: { DPS:["Arcane","Fire","Frost"] },
  Paladin: { Tank:["Protection"], Healer:["Holy"], DPS:["Retribution"] },
  Priest: { Healer:["Holy","Discipline"], DPS:["Shadow"] },
  Rogue: { DPS:["Assassination","Combat","Subtlety"] },
  Shaman: { Tank:["Enhancement"], Healer:["Restoration"], DPS:["Enhancement","Elemental"] },
  Warlock: { DPS:["Affliction","Demonology","Destruction"] },
  Warrior: { Tank:["Protection"], DPS:["Arms","Fury"] }
};

const specToType = {
  Balance:"Ranged", Feral:"Melee", Guardian:"Tank", Restoration:"Healer",
  "Beast Mastery":"Ranged", Marksmanship:"Ranged", Survival:"Melee",
  Arcane:"Ranged", Fire:"Ranged", Frost:"Ranged",
  Holy:"Healer", Protection:"Tank", Retribution:"Melee",
  Discipline:"Healer", Shadow:"Ranged",
  Assassination:"Melee", Combat:"Melee", Subtlety:"Melee",
  Elemental:"Ranged", Enhancement:"Melee",
  Affliction:"Ranged", Demonology:"Ranged", Destruction:"Ranged",
  Arms:"Melee", Fury:"Melee"
};

// -------------------- Helpers --------------------
function emojiFor(guild, name) {
  if (!guild || !name) return "•";
  const e = guild.emojis.cache.find(x => x.name && x.name.toLowerCase() === name.toLowerCase());
  return e ? e.toString() : "•";
}
function mention(id) { return `<@${id}>`; }
function isRegistered(raid, userId) { return raid.members.some(m => m.id === userId); }
function countRole(raid, role) { return raid.members.filter(m => m.role === role).length; }

// Build embed with required formatting (3 cols then 2 cols)
function buildRaidEmbed(raid, guild) {
  const embed = new EmbedBuilder()
    .setTitle(`Рейд: ${raid.name}`)
    .setDescription(`📅 ${raid.datetime}`)
    .setColor(0x00aaff)
    .setTimestamp(new Date());

  if (raid.image) embed.setImage(raid.image);

  const tanks = raid.members.filter(m => m.role === "Tank");
  const healers = raid.members.filter(m => m.role === "Healer");
  const dps = raid.members.filter(m => m.role === "DPS");
  const melee = dps.filter(m => m.dpsType === "Melee");
  const ranged = dps.filter(m => m.dpsType === "Ranged");

  const list = arr => arr.length ? arr.map((p,i)=>`${i+1}. ${mention(p.id)} (${p.class}${p.spec ? ` • ${p.spec}` : ""})`).join("\n") : "-";

  // Row 1: Tank | DPS | Healer
  embed.addFields(
    { name: `🛡️ Tank (${tanks.length}/${raid.limits.tankMax})`, value: list(tanks), inline: true },
    { name: `⚔️ DPS (${dps.length}/${raid.max})`, value: `${list(melee)}\n${list(ranged)}`, inline: true },
    { name: `⚕️ Healer (${healers.length}/${raid.limits.healMax})`, value: list(healers), inline: true }
  );

  // Row 2: Melee DPS | Ranged DPS
  embed.addFields(
    { name: `🔪 Melee DPS (${melee.length})`, value: list(melee), inline: true },
    { name: `🎯 Ranged DPS (${ranged.length})`, value: list(ranged), inline: true }
  );

  const total = raid.members.length;
  const status = raid.locked ? "🔒 Заключен (достигнат лимит)" : (total < raid.min ? `❗ Под минимума (${raid.min})` : `🔓 Отворен`);
  embed.addFields({ name: "Статус", value: `Общо: ${total}/${raid.max}\n${status}`, inline: false });

  // footer show icons legend (attempt to include class icons inline - optional)
  return embed;
}

// -------------------- Commands registration --------------------
const commands = [
  new SlashCommandBuilder()
    .setName("create")
    .setDescription("Създава нов рейд")
    .addStringOption(o => o.setName("name").setDescription("Име на рейда").setRequired(true))
    .addStringOption(o => o.setName("datetime").setDescription("Дата и час (DD.MM.YYYY HH:MM)").setRequired(true))
    .addStringOption(o => o.setName("image").setDescription("Линк към картинка (по избор)").setRequired(false))
    .addIntegerOption(o => o.setName("min").setDescription("Минимален брой участници (по избор)").setRequired(false))
    .addIntegerOption(o => o.setName("max").setDescription("Максимален брой участници (10-25)").setRequired(false))
    .addIntegerOption(o => o.setName("tankmax").setDescription("Максимум танкове (по избор)").setRequired(false))
    .addIntegerOption(o => o.setName("healmax").setDescription("Максимум хилъри (по избор)").setRequired(false)),
  new SlashCommandBuilder().setName("roleinfo").setDescription("Показва WoW роли / класове (запазено)"),
  new SlashCommandBuilder().setName("professions").setDescription("Показва професии (запазено)"),
  new SlashCommandBuilder().setName("help").setDescription("Показва помощ")
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);
(async () => {
  try {
    console.log("⚡ Registering commands...");
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log("✅ Commands registered");
  } catch (err) {
    console.error("Commands registration error:", err);
  }
})();

// -------------------- Active raids map --------------------
// keyed by messageId; supports many simultaneous raids (requirement was up to 2 but we support many)
const activeRaids = new Map();

// Defaults if not specified
const DEFAULTS = { min: 10, max: 25, tankMax: 3, healMax: 5 };

// -------------------- Interaction handling --------------------
client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isCommand()) {
      if (interaction.commandName === "create") {
        // read options (optional limits)
        const name = interaction.options.getString("name");
        const datetime = interaction.options.getString("datetime");
        const image = interaction.options.getString("image") || null;
        const min = interaction.options.getInteger("min") || DEFAULTS.min;
        const max = interaction.options.getInteger("max") || DEFAULTS.max;
        const tankMax = interaction.options.getInteger("tankmax") || DEFAULTS.tankMax;
        const healMax = interaction.options.getInteger("healmax") || DEFAULTS.healMax;

        // enforce max bounds
        const safeMin = Math.max(1, min);
        const safeMax = Math.min(25, Math.max(max, safeMin)); // keep <=25
        const raidObj = {
          name,
          datetime,
          image,
          min: safeMin,
          max: safeMax,
          limits: { tankMax, healMax },
          members: [],
          locked: false,
          channelId: interaction.channelId
        };

        // create initial embed
        const initEmbed = new EmbedBuilder()
          .setTitle(`Рейд: ${name}`)
          .setDescription(`📅 ${datetime}\nЗаписване: отворено`)
          .setColor(0x00aaff)
          .setFooter({ text: `Min:${safeMin} • Max:${safeMax} • TankMax:${tankMax} • HealerMax:${healMax}` })
          .setTimestamp();

        if (image) initEmbed.setImage(image);

        // build class menu options (labels + descriptions)
        const classOptions = wowClasses.map(c => ({
          label: c,
          value: c,
          description: classSpecs[c] ? Object.keys(classSpecs[c]).map(r => `${r}:${(classSpecs[c][r]||[]).join(",")}`).join(" | ") : ""
        }));

        const classMenu = new StringSelectMenuBuilder()
          .setCustomId(`raid_temp_class`) // we'll edit to message-specific id after send
          .setPlaceholder("Избери клас")
          .addOptions(classOptions);

        const row = new ActionRowBuilder().addComponents(classMenu);

        // create mention content: @everyone + try to mention common roles
        let mentionContent = `@everyone`;
        try {
          const guild = await client.guilds.fetch(GUILD_ID);
          const g = await guild.fetch();
          const roleNames = ["Admin","Moderator","Officer","Raid Leader"];
          const found = [];
          if (g && g.roles && g.roles.cache) {
            for (const rn of roleNames) {
              const r = g.roles.cache.find(role => role.name.toLowerCase() === rn.toLowerCase());
              if (r) found.push(`<@&${r.id}>`);
            }
          }
          if (found.length) mentionContent += " " + found.join(" ");
        } catch (err) {
          // ignore silently
        }

        // send initial message
        const sent = await interaction.reply({ content: mentionContent, embeds: [initEmbed], components: [row], fetchReply: true });

        // message id key
        const msgId = sent.id;

        // change menu customId to be message-specific (so menus don't collide between raids)
        const classMenuSpecific = new StringSelectMenuBuilder()
          .setCustomId(`raid_${msgId}_class`)
          .setPlaceholder("Избери клас")
          .addOptions(classOptions);
        const rowSpecific = new ActionRowBuilder().addComponents(classMenuSpecific);
        await sent.edit({ components: [rowSpecific] });

        // store raid under message id
        activeRaids.set(msgId, { ...raidObj, max: safeMax, min: safeMin, messageId: msgId });

        return;
      }

      if (interaction.commandName === "help") {
        const help = new EmbedBuilder()
          .setTitle("WoW Raid Bot — Помощ")
          .setColor(0x00ff88)
          .setDescription("Команди:\n• /create name datetime [image] [min] [max] [tankmax] [healmax] — създава рейд\n\nСлед като е създаден, използвай селект менюто в съобщението на бота: клас → роля → специализация. Ембедът автоматично се обновява и показва броя и имената.")
          .setTimestamp();
        return interaction.reply({ embeds: [help], ephemeral: true });
      }

      // roleinfo/professions placeholders (you can paste your full implementations here)
      if (interaction.commandName === "roleinfo") {
        return interaction.reply({ content: "roleinfo: запазено (може да се добави стария код тук)", ephemeral: true });
      }
      if (interaction.commandName === "professions") {
        return interaction.reply({ content: "professions: запазено (може да се добави стария код тук)", ephemeral: true });
      }
    }

    // ---------- Select Menu handling ----------
    if (interaction.isStringSelectMenu()) {
      const cid = interaction.customId;
      if (!cid.startsWith("raid_")) return; // ignore unrelated

      const parts = cid.split("_"); // e.g. ['raid', messageId, 'class'|'role'|'spec', ...]
      const messageId = parts[1];
      const step = parts[2];
      const raid = activeRaids.get(messageId);
      if (!raid) return interaction.reply({ content: "Рейдът вече не е активен.", ephemeral: true });

      // if locked -> deny
      if (raid.locked) return interaction.reply({ content: "Рейдът е заключен — записването е затворено.", ephemeral: true });

      // class selection
      if (step === "class") {
        const chosenClass = interaction.values[0];
        // build roles allowed for that class
        const roleOptions = [];
        const specObj = classSpecs[chosenClass] || {};
        if (specObj.Tank && specObj.Tank.length) roleOptions.push({ label: "Tank", value: "Tank" });
        if (specObj.Healer && specObj.Healer.length) roleOptions.push({ label: "Healer", value: "Healer" });
        if (specObj.DPS && specObj.DPS.length) roleOptions.push({ label: "DPS", value: "DPS" });
        if (roleOptions.length === 0) roleOptions.push({ label: "DPS", value: "DPS" });

        const roleMenu = new StringSelectMenuBuilder()
          .setCustomId(`raid_${messageId}_role_${chosenClass}`)
          .setPlaceholder("Избери роля")
          .addOptions(roleOptions);

        const row = new ActionRowBuilder().addComponents(roleMenu);
        return interaction.update({ content: `Избери роля за **${chosenClass}**:`, components: [row], embeds: [] });
      }

      // role selection
      if (step === "role") {
        // format: raid_<messageId>_role_<class>
        const chosenClass = parts.slice(3).join("_");
        const chosenRole = interaction.values[0];

        // check overall max
        if (raid.members.length >= raid.max) {
          raid.locked = true;
          await disableRaidComponents(messageId);
          return interaction.reply({ content: `Рейдът е достигнал максимума от ${raid.max}.`, ephemeral: true });
        }

        // check role-specific limits
        if (chosenRole === "Tank" && countRole(raid, "Tank") >= raid.limits.tankMax) {
          return interaction.reply({ content: `Лимитът за танкове е ${raid.limits.tankMax}.`, ephemeral: true });
        }
        if (chosenRole === "Healer" && countRole(raid, "Healer") >= raid.limits.healMax) {
          return interaction.reply({ content: `Лимитът за хилъри е ${raid.limits.healMax}.`, ephemeral: true });
        }

        const specsFor = (classSpecs[chosenClass] && classSpecs[chosenClass][chosenRole]) || [];

        if (!specsFor || specsFor.length === 0) {
          // direct add
          if (isRegistered(raid, interaction.user.id)) {
            return interaction.reply({ content: `Вече си записан за този рейд.`, ephemeral: true });
          }
          // infer dpsType if DPS
          let dpsType = null;
          if (chosenRole === "DPS") {
            dpsType = ["Hunter","Mage","Warlock"].includes(chosenClass) ? "Ranged" : "Melee";
          }
          raid.members.push({ id: interaction.user.id, username: interaction.user.username, class: chosenClass, role: chosenRole, spec: null, dpsType });
          await updateRaidMessage(interaction, messageId);
          return interaction.reply({ content: `✔️ Записан като ${chosenRole} (${chosenClass}).`, ephemeral: true });
        } else {
          // show spec menu
          const specMenu = new StringSelectMenuBuilder()
            .setCustomId(`raid_${messageId}_spec_${chosenClass}_${chosenRole}`)
            .setPlaceholder("Избери специализация")
            .addOptions(specsFor.map(s => ({ label: s, value: s, description: specToType[s] ? specToType[s] : "" })));
          const row = new ActionRowBuilder().addComponents(specMenu);
          return interaction.update({ content: `Избери специализация за **${chosenClass}** (${chosenRole}):`, components: [row], embeds: [] });
        }
      }

      // spec selection
      if (step === "spec") {
        // format: raid_<messageId>_spec_<class>_<role>
        const chosenClass = parts[3];
        const chosenRole = parts[4];
        const chosenSpec = interaction.values[0];

        if (isRegistered(raid, interaction.user.id)) {
          return interaction.reply({ content: `Вече си записан за този рейд.`, ephemeral: true });
        }

        // check overall & role limits
        if (raid.members.length >= raid.max) {
          raid.locked = true;
          await disableRaidComponents(messageId);
          return interaction.reply({ content: `Рейдът е достигнал максимума от ${raid.max}.`, ephemeral: true });
        }
        if (chosenRole === "Tank" && countRole(raid, "Tank") >= raid.limits.tankMax) {
          return interaction.reply({ content: `Лимитът за танкове е ${raid.limits.tankMax}.`, ephemeral: true });
        }
        if (chosenRole === "Healer" && countRole(raid, "Healer") >= raid.limits.healMax) {
          return interaction.reply({ content: `Лимитът за хилъри е ${raid.limits.healMax}.`, ephemeral: true });
        }

        const type = specToType[chosenSpec] || (chosenRole === "DPS" ? "Melee" : (chosenRole === "Healer" ? "Healer" : "Tank"));
        raid.members.push({ id: interaction.user.id, username: interaction.user.username, class: chosenClass, role: chosenRole, spec: chosenSpec, dpsType: type });

        // if reached max -> lock
        if (raid.members.length >= raid.max) {
          raid.locked = true;
          await disableRaidComponents(messageId);
        }

        await updateRaidMessage(interaction, messageId);
        return interaction.reply({ content: `✔️ Записан: ${chosenClass} — ${chosenSpec} (${type})`, ephemeral: true });
      }
    }
  } catch (err) {
    console.error("Interaction error:", err);
    try { if (interaction && !interaction.replied) await interaction.reply({ content: "Възникна грешка.", ephemeral: true }); } catch(e) {}
  }
});

// Disable components when raid locked
async function disableRaidComponents(messageId) {
  const raid = activeRaids.get(messageId);
  if (!raid) return;
  try {
    const ch = await client.channels.fetch(raid.channelId);
    if (!ch) return;
    const msg = await ch.messages.fetch(messageId);
    if (!msg) return;
    const disabled = new StringSelectMenuBuilder().setCustomId(`raid_${messageId}_closed`).setPlaceholder("Записването е затворено").setDisabled(true).addOptions([{ label: "Locked", value: "locked" }]);
    await msg.edit({ components: [new ActionRowBuilder().addComponents(disabled)] });
  } catch (err) {
    console.warn("disableRaidComponents:", err.message || err);
  }
}

// Update raid message embed
async function updateRaidMessage(interactionOrNull, messageId) {
  const raid = activeRaids.get(messageId);
  if (!raid) return;
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    // build embed
    const embed = buildRaidEmbed(raid, guild);
    // fetch message
    const ch = await client.channels.fetch(raid.channelId);
    if (!ch) return;
    const msg = await ch.messages.fetch(messageId);
    if (!msg) return;
    // components: if not locked keep class menu
    let components = [];
    if (!raid.locked) {
      const classMenu = new StringSelectMenuBuilder().setCustomId(`raid_${messageId}_class`).setPlaceholder("Избери клас").addOptions(wowClasses.map(c => ({ label: c, value: c })));
      components = [new ActionRowBuilder().addComponents(classMenu)];
    } else {
      const disabled = new StringSelectMenuBuilder().setCustomId(`raid_${messageId}_closed`).setPlaceholder("Записването е затворено").setDisabled(true).addOptions([{ label: "Locked", value: "locked" }]);
      components = [new ActionRowBuilder().addComponents(disabled)];
    }
    await msg.edit({ embeds: [embed], components });
  } catch (err) {
    console.warn("updateRaidMessage:", err.message || err);
  }
}

// -------------------- Presence/statuses (restore old dynamic behaviour) --------------------
client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  // dynamic status rotation (every 5 minutes)
  const staticStatuses = [
    "Използвай /help и научи от какво има нужда гилдията!",
    "Използвай /professions за да научиш какви професии",
    "Използвай /roleinfo за да научиш коя роля е нужна"
  ];
  let idx = 0;

  async function updateDynamic() {
    try {
      const guild = await client.guilds.fetch(GUILD_ID);
      await guild.members.fetch();
      const counts = { DPS: 0, Tank: 0, Healer: 0 };
      for (const cat of ["DPS","Tank","Healer"]) {
        const role = guild.roles.cache.find(r => r.name.toLowerCase() === cat.toLowerCase());
        if (!role) continue;
        const members = role.members.filter(m => !m.roles.cache.some(rr => rr.name && rr.name.toLowerCase().endsWith("-alt")));
        counts[cat] = members.size;
      }
      return `DPS - ${counts.DPS} | Tank - ${counts.Tank} | Healer - ${counts.Healer}`;
    } catch (err) {
      return staticStatuses[idx % staticStatuses.length];
    }
  }

  async function setNext() {
    let text;
    if (idx % 4 === 3) text = await updateDynamic();
    else text = staticStatuses[idx % staticStatuses.length];
    try {
      await client.user.setPresence({ activities: [{ name: text, type: 0 }], status: "online" });
    } catch (e) { /* ignore */ }
    idx++;
  }

  // first set
  await setNext();
  setInterval(setNext, 300000);
});

// -------------------- Login --------------------
client.login(TOKEN)
  .then(() => console.log("✅ Bot started"))
  .catch(err => console.error("❌ Login error:", err));
