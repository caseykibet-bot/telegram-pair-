require("./settings")
const fs = require('fs');
const path = require("path")
const os = require('os');
const chalk = require("chalk")
const fetch = require("node-fetch")
const mumaker = require('mumaker');
const acrcloud = require("acrcloud"); 
const BASE_URL = 'https://noobs-api.top';
const yts = require('yt-search');
const ytdl = require("ytdl-core");
const { exec } = require('child_process');
const axios = require('axios'); // Added missing axios import
// Add this at the top of your file with other constants
const readMore = String.fromCharCode(8206).repeat(4001);
const { downloadContentFromMessage, proto, generateWAMessage, getContentType, prepareWAMessageMedia, generateWAMessageFromContent, GroupSettingChange, jidDecode, WAGroupMetadata, emitGroupParticipantsUpdate, emitGroupUpdate, generateMessageID, jidNormalizedUser, generateForwardMessageContent, WAGroupInviteMessageGroupMetadata, GroupMetadata, Headers, delay, WA_DEFAULT_EPHEMERAL, WADefault, getAggregateVotesInPollMessage, generateWAMessageContent, areJidsSameUser, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, makeWaconnet, makeInMemoryStore, MediaType, WAMessageStatus, downloadAndSaveMediaMessage, AuthenticationState, initInMemoryKeyStore, MiscMessageGenerationOptions, useSingleFileAuthState, BufferJSON, WAMessageProto, MessageOptions, WAFlag, WANode, WAMetric, ChatModification, MessageTypeProto, WALocationMessage, ReconnectMode, WAContextInfo, ProxyAgent, waChatKey, MimetypeMap, MediaPathMap, WAContactMessage, WAContactsArrayMessage, WATextMessage, WAMessageContent, WAMessage, BaileysError, WA_MESSAGE_STATUS_TYPE, MediaConnInfo, URL_REGEX, WAUrlInfo, WAMediaUpload, mentionedJid, processTime, Browser, MessageType,
Presence, WA_MESSAGE_STUB_TYPES, Mimetype, relayWAMessage, Browsers, DisconnectReason, WAconnet, getStream, WAProto, isBaileys, AnyMessageContent, templateMessage, InteractiveMessage, Header } = require("@whiskeysockets/baileys")
const thumb = fs.readFileSync('./media/thumb.jpg')
const docu = fs.readFileSync('./media/document.jpg')

// ================== ANTIDELETE FUNCTION ==================
async function handleMessageRevocation(trashcore, revocationMessage, antideleteMode) {
  try {
    // Fast validation checks first
    if (!revocationMessage?.message?.protocolMessage?.key?.id) return;
    
    const remoteJid = revocationMessage.key.remoteJid;
    const messageId = revocationMessage.message.protocolMessage.key.id;

    // Load original deleted message with timestamp check
    // Note: You need to implement loadChatData function
    const chatData = []; // Placeholder - implement your chat data loading
    const originalMessage = chatData[0];
    if (!originalMessage) return;

    // Get bot's JID early for faster checks
    const botJid = (await trashcore.user.id).split(":")[0] + "@s.whatsapp.net";

    // Detect who deleted
    const deletedBy = revocationMessage.participant || revocationMessage.key.remoteJid;
    
    // Detect who originally sent
    const sentBy = originalMessage.key.participant || originalMessage.key.remoteJid;

    // Skip if bot deleted or sent the message
    if (deletedBy === botJid || sentBy === botJid) return;

    // Skip if this is a duplicate notification (check timestamp)
    const now = Date.now();
    const messageTimestamp = originalMessage.messageTimestamp * 1000 || now;
    if (now - messageTimestamp > 60000) return; // Skip if message is older than 1 minute

    // Format participants
    const deletedByFormatted = `@${deletedBy.split('@')[0]}`;
    const sentByFormatted = `@${sentBy.split('@')[0]}`;

    // Timezone handling for Africa/Nairobi (UTC+3)
    const localNow = new Date(now + (3 * 60 * 60 * 1000));
    const deletedTime = localNow.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const deletedDate = localNow.toLocaleDateString();

    // Base notification text
    let notificationText = `🚨 *FROST-XMD ANTIDELETE* 🚨\n\n` +
      `👤 ᴅᴇʟᴇᴛᴇᴅ ʙʏ: ${deletedByFormatted}\n` +
      `✉️ sᴇɴᴛ ʙʏ: ${sentByFormatted}\n` +
      `📅 ᴅᴀᴛᴇ: ${deletedDate}\n` +
      `⏰ ᴛɪᴍᴇ: ${deletedTime}\n\n`;

    // Determine where to send recovered message
    let targetJid;
    if (antideleteMode === "private") {
      targetJid = global.owner[0].replace(/[^0-9]/g, '') + "@s.whatsapp.net";
    } else if (antideleteMode === "chat") {
      targetJid = remoteJid;
    } else return;

    // Cache to prevent duplicate notifications
    const cacheKey = `${messageId}_${deletedBy}`;
    if (global.antiDeleteCache?.[cacheKey]) return;
    global.antiDeleteCache = { [cacheKey]: true, ...global.antiDeleteCache };

    // Handle all message types with consistent notifications
    const sendNotification = async (mediaType, content = '') => {
      const mediaPrefix = {
        imageMessage: '🖼️ *Deleted Image*',
        videoMessage: '🎥 *Deleted Video*',
        stickerMessage: '🔖 *Deleted Sticker*',
        documentMessage: '📄 *Deleted Document*',
        audioMessage: '🎧 *Deleted Audio*',
        call: '📞 *Deleted Call Log*',
        conversation: '📝 *Deleted Message*',
        extendedTextMessage: '📝 *Deleted Quoted Message*'
      }[mediaType] || '📌 *Deleted Content*';

      const caption = content ? `\n${content}` : '';
      await trashcore.sendMessage(targetJid, {
        text: `${notificationText}${mediaPrefix}${caption}`,
        mentions: [deletedBy, sentBy]
      });
    };

    // Process all supported message types
    const msgContent = originalMessage.message;
    if (msgContent?.conversation) {
      await sendNotification('conversation', msgContent.conversation);
    }
    else if (msgContent?.extendedTextMessage) {
      await sendNotification('extendedTextMessage', msgContent.extendedTextMessage.text);
    }
    else if (msgContent?.imageMessage) {
      const buffer = await trashcore.downloadMediaMessage(originalMessage);
      const caption = msgContent.imageMessage.caption || "";
      await trashcore.sendMessage(targetJid, {
        image: buffer,
        caption: `${notificationText}🖼️ *Deleted Image*${caption ? `\n${caption}` : ""}`,
        mentions: [deletedBy, sentBy]
      });
    }
    else if (msgContent?.videoMessage) {
      const buffer = await trashcore.downloadMediaMessage(originalMessage);
      const caption = msgContent.videoMessage.caption || "";
      await trashcore.sendMessage(targetJid, {
        video: buffer,
        caption: `${notificationText}🎥 *Deleted Video*${caption ? `\n${caption}` : ""}`,
        mentions: [deletedBy, sentBy]
      });
    }
    else if (msgContent?.stickerMessage) {
      const buffer = await trashcore.downloadMediaMessage(originalMessage);
      await trashcore.sendMessage(targetJid, { sticker: buffer });
      await sendNotification('stickerMessage');
    }
    else if (msgContent?.documentMessage) {
      const buffer = await trashcore.downloadMediaMessage(originalMessage);
      const doc = msgContent.documentMessage;
      await trashcore.sendMessage(targetJid, {
        document: buffer,
        fileName: doc.fileName,
        mimetype: doc.mimetype,
        caption: `${notificationText}📄 *Deleted Document:* ${doc.fileName}`,
        mentions: [deletedBy, sentBy]
      });
    }
    else if (msgContent?.audioMessage) {
      const buffer = await trashcore.downloadMediaMessage(originalMessage);
      const isPTT = msgContent.audioMessage.ptt === true;
      await trashcore.sendMessage(targetJid, {
        audio: buffer,
        ptt: isPTT,
        mimetype: "audio/mpeg"
      });
      await sendNotification('audioMessage');
    }
    else if (msgContent?.call) {
      await sendNotification('call');
    }
    else {
      // Fallback for unsupported types
      await sendNotification('unknown');
    }

    // Clean up cache after 5 minutes
    setTimeout(() => {
      if (global.antiDeleteCache?.[cacheKey]) {
        delete global.antiDeleteCache[cacheKey];
      }
    }, 300000);

  } catch (err) {
    console.error("❌ Error in antidelete:", err);
  }
}

// Helper function for runtime
function runtime(seconds) {
    seconds = Number(seconds);
    var d = Math.floor(seconds / (3600 * 24));
    var h = Math.floor(seconds % (3600 * 24) / 3600);
    var m = Math.floor(seconds % 3600 / 60);
    var s = Math.floor(seconds % 60);
    var dDisplay = d > 0 ? d + (d == 1 ? " day, " : " days, ") : "";
    var hDisplay = h > 0 ? h + (h == 1 ? " hour, " : " hours, ") : "";
    var mDisplay = m > 0 ? m + (m == 1 ? " minute, " : " minutes, ") : "";
    var sDisplay = s > 0 ? s + (s == 1 ? " second" : " seconds") : "";
    return dDisplay + hDisplay + mDisplay + sDisplay;
}

// Helper function for fetchJson
async function fetchJson(url, options = {}) {
    try {
        const response = await fetch(url, options);
        return await response.json();
    } catch (error) {
        throw new Error(`Fetch failed: ${error.message}`);
    }
}

// Helper function for group permissions
async function checkGroupPermissions(m, trashcore) {
    if (!m.isGroup) {
        return { error: "❌ This command can only be used in groups." };
    }
    
    try {
        const groupMetadata = await trashcore.groupMetadata(m.chat);
        const participants = groupMetadata.participants;
        const isAdmin = participants.find(p => p.id === m.sender)?.admin;
        const isBotAdmin = participants.find(p => p.id === trashcore.user.id)?.admin;
        
        return { isAdmin: !!isAdmin, isBotAdmin: !!isBotAdmin, error: null };
    } catch (error) {
        return { error: "❌ Failed to check group permissions." };
    }
}

module.exports = trashcore = async (trashcore, m, chatUpdate, store) => {
    try {
        const body = (
            m.mtype === "conversation" ? m.message.conversation :
            m.mtype === "imageMessage" ? m.message.imageMessage.caption :
            m.mtype === "videoMessage" ? m.message.videoMessage.caption :
            m.mtype === "extendedTextMessage" ? m.message.extendedTextMessage.text :
            m.mtype === "buttonsResponseMessage" ? m.message.buttonsResponseMessage.selectedButtonId :
            m.mtype === "listResponseMessage" ? m.message.listResponseMessage.singleSelectReply.selectedRowId :
            m.mtype === "templateButtonReplyMessage" ? m.message.templateButtonReplyMessage.selectedId :
            m.mtype === "interactiveResponseMessage" ? JSON.parse(m.msg.nativeFlowResponseMessage.paramsJson).id :
            m.mtype === "templateButtonReplyMessage" ? m.msg.selectedId :
            m.mtype === "messageContextInfo" ? m.message.buttonsResponseMessage?.selectedButtonId ||
            m.message.listResponseMessage?.singleSelectReply.selectedRowId || m.text : ""
        ) || "";

        const sender = m.key.fromMe ? trashcore.user.id.split(":")[0] + "@s.whatsapp.net" : m.key.participant || m.key.remoteJid;
        const senderNumber = sender.split('@')[0];
        const budy = (typeof m.text === 'string' ? m.text : '');
        const xprefix = ["", "!", ".", ",", "🐤", "🗿"];

        const prefixRegex = /^[°zZ#$@*+,.?=''():√%!¢£¥€π¤ΠΦ_&><`™©®Δ^βα~¦|/\\©^]/;
        const prefix = /^[°•π÷×¶∆£¢€¥®™+✓_=|~!?@#$%^&.©^]/gi.test(body) ? body.match(/^[°•π÷×¶∆£¢€¥®™+✓_=|~!?@#$%^&.©^]/gi)[0] : "";
        const from = m.key.remoteJid;
        const isGroup = from.endsWith("@g.us");
        const botNumber = await trashcore.decodeJid(trashcore.user.id);
        const isBot = botNumber.includes(senderNumber);
        
        const isCmd = body.startsWith(prefix);
        const command = isCmd ? body.slice(prefix.length).trim().split(' ').shift().toLowerCase() : '';
        const command2 = body.replace(prefix, '').trim().split(/ +/).shift().toLowerCase();
        const args = body.trim().split(/ +/).slice(1);
        const pushname = m.pushName || "No Name";
        const text = q = args.join(" ");
        const quoted = m.quoted ? m.quoted : m;
        const mime = (quoted.msg || quoted).mimetype || '';
        const qmsg = (quoted.msg || quoted);
        const isMedia = /image|video|sticker|audio/.test(mime);
        const groupMetadata = m?.isGroup ? await trashcore.groupMetadata(m.chat).catch(() => ({})) : {};
        const groupName = m?.isGroup ? groupMetadata.subject || '' : '';
        const participants = m?.isGroup ? groupMetadata.participants?.map(p => {
            let admin = null;
            if (p.admin === 'superadmin') admin = 'superadmin';
            else if (p.admin === 'admin') admin = 'admin';
            return {
                id: p.id || null,
                jid: p.jid || null,
                admin,
                full: p
            };
        }) || []: [];
        const groupOwner = m?.isGroup ? participants.find(p => p.admin === 'superadmin')?.jid || '' : '';
        const groupAdmins = participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin').map(p => p.jid || p.id);
        const isBotAdmins = m?.isGroup ? groupAdmins.includes(botNumber) : false;
        const isAdmins = m?.isGroup ? groupAdmins.includes(m.sender) : false;
        const isGroupOwner = m?.isGroup ? groupOwner === m.sender : false;
        const isOwner = [botNumber, ...global.owner]
            .map(v => v.replace(/[^0-9]/g, "") + "@s.whatsapp.net")
            .includes(m.sender);
        const isCreator = isOwner; // Alias for isOwner
        const dev = global.dev || []; // Ensure dev array exists
            
        if (!trashcore.public) {
            if (!m.fromMe && !isOwner) return;
        };

        const { generateWAMessageFromContent, prepareWAMessageMedia, proto } = require('@whiskeysockets/baileys');

        async function reply(text) {
            return trashcore.sendMessage(m.chat, {
                text: text,
                contextInfo: {
                    mentionedJid: [sender],
                    externalAdReply: {
                        title:"FROST XMD❄️🌸",
                        body:"made by Caseyrhodes",
                        thumbnailUrl: "https://files.catbox.moe/d77o4e.jpg",
                        sourceUrl: "https://files.catbox.moe/d77o4e.jpg",
                        renderLargerThumbnail: false,
                    }
                }
            }, { quoted:m });
        }

        // ================== MAIN MESSAGE HANDLER INTEGRATION ==================
        // Presence Update
        const Grace = m.key.remoteJid;
        if (global.wapresence === 'online') { 
            trashcore.sendPresenceUpdate('available', Grace);
        } else if (global.wapresence === 'typing') { 
            trashcore.sendPresenceUpdate('composing', Grace);
        } else if (global.wapresence === 'recording') { 
            trashcore.sendPresenceUpdate('recording', Grace);
        } else {
            trashcore.sendPresenceUpdate('unavailable', Grace);
        }

        // Private Mode Check
        const mode = global.mode || 'public'; // Ensure mode is defined
        const itsMe = m.sender === trashcore.user.id;
        if (command && mode === 'private' && !itsMe && !isOwner && m.sender !== dev[0]) {
            return;
        }

        // AutoRead Feature
        if (global.autoread === 'on' && !m.isGroup) { 
            trashcore.readMessages([m.key]);
        }

        // Antidelete Listener
        if (global.antidelete !== "off") {
            if (m.message?.protocolMessage && m.message.protocolMessage.type === 0) {
                await handleMessageRevocation(trashcore, m, global.antidelete);
            }
        }

        switch (command) {
            // ... [ALL YOUR CASE COMMANDS REMAIN THE SAME - THEY WERE CORRECT]
            // Include all your case commands here exactly as you had them
case "menu": {
    // Add reaction immediately when command is received
    await trashcore.sendMessage(m.chat, {
        react: { text: "🐣", key: m.key }
    });

    let text = `❄️ 𝗙𝗥𝗢𝗦𝗧-𝗫𝗠𝗗 ❄️
*╭───────────────────┈⊷*
*┊•📚 𝗟𝗶𝗯𝗿𝗮𝗿𝘆* : ʙᴀɪʟᴇʏꜱ
*┊•⚡ 𝗣𝗿𝗲𝗳𝗶𝘅* : [ ${prefix} ]
*┊•🔒 𝗦𝘁𝗮𝘁𝘂𝘀* : ${trashcore.public ? 'ᴘᴜʙʟɪᴄ' : 'ꜱᴇʟꜰ'}
*┊•👑 𝗖𝗿𝗲𝗮𝘁𝗼𝗿* : t.me/caseyrhodes001
*┊•🔮 𝗙𝗿𝗲𝗲 𝗯𝗼𝘁* : https://t.me/caseybase_bot
*┊•🧑‍💻 don't stop trying*
*╰───────────────────┈⊷*
${readMore}
╭《 \`𝗕𝗨𝗚 𝗠𝗘𝗡𝗨\` 》────┈⊷
┊ ʜᴀᴄᴋ
┊ ʙᴜɢ
┊ ɴᴇᴡꜱʟᴇᴛᴇʀ 
┊ ᴅᴏᴄᴜᴍᴇɴᴛ
┊ ʙʀᴏᴀᴅᴄᴀꜱᴛ 
┊ ᴘᴀʏᴍᴇɴᴛ
┊ ʟᴏᴄᴀᴛɪᴏɴ 
┊ ɪᴏꜱᴄʀᴀꜱʜ
┊ ᴄᴀʀᴏᴜꜱᴇʟ
╰━━━━━━━━━━━━━━━━━━━┈⊷

╭《 \`𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗 𝗠𝗘𝗡𝗨\` 》─┈⊷
┊ 🎵  ꜱᴏɴɢ 
┊ 🎧  ᴘʟᴀʏ2
┊ 🎬  ᴠɪᴅᴇᴏ
┊ 📱  ᴛɪᴋᴛᴏᴋ
┊ 🌀  ᴛɪᴋᴛᴏᴋ2
┊ 📦  ᴀᴘᴋ
┊ 🍄  sʜᴀᴢᴀᴍ
┊ 🖼️  ɪᴍᴀɢᴇ
┊ 🧑‍💻  ɢᴘᴛ
╰───────────────────┈⊷

╭《 \`𝗦𝗘𝗧𝗧𝗜𝗡𝗚𝗦\` 》──────┈⊷
┊ • Antidelete
┊ • Antiedit  
┊ • Anticall
┊ • Antibot
┊ • Badword
┊ • Antitag
┊ • Antilink
┊ • Antilinkall
┊ • Gptdm
┊ • Autoview
┊ • Autolike
┊ • Autoread
┊ • Autobio
┊ • Mode
┊ • Prefix
┊ • Welcomegoodbye
┊ • Wapresence
╰───────────────────┈⊷
╭《 \`𝗢𝗪𝗡𝗘𝗥 𝗠𝗘𝗡𝗨\` 》───┈⊷
┊ 👁️  ᴀᴜᴛᴏʀᴇᴀᴅ 
┊ 🎭  ᴘʀᴇꜱᴇɴᴄᴇ 
┊ 🛡️  ᴀɴᴛɪᴅᴇʟᴇᴛᴇ 
┊ 📊  ᴀᴜᴛᴏꜱᴛᴀᴛᴜꜱ 
┊ 🚫  ʙʟᴏᴄᴋ
┊ 🎊  ᴄᴀsᴛ
┊ ✅  ᴜɴʙʟᴏᴄᴋ
┊ ❄️  ʙʟᴏᴄᴋʟɪsᴛ
┊ 🔮  ᴛʀᴛ
┊ 🌸  screenshot 
┊ 🍄  ɢɪᴛᴄʟᴏɴᴇ
┊ 🗂️  ʙɪʙʟᴇ
┊ 🔥  ᴇᴠᴀʟ
┊ 🧑‍💻  sʏsᴛᴇᴍ
╰───────────────────┈⊷
╭《 \`𝐓𝐄𝐗𝐓 𝐌𝐀𝐊𝐄𝐑\` 》──┈⊷
┊ • Purple
┊ • Neon
┊ • Noel  
┊ • Metallic
┊ • Devil
┊ • Impressive
┊ • Snow
┊ • Water
┊ • Thunder
┊ • Ice
┊ • Matrix
┊ • Silver
┊ • Light
╰───────────────────┈⊷
╭《 \`𝗚𝗥𝗢𝗨𝗣 𝗠𝗘𝗡𝗨\` 》──┈⊷
┊ ⬆️  ᴘʀᴏᴍᴏᴛᴇ
┊ ⬇️  ᴅᴇᴍᴏᴛᴇ
┊ 🔒  ᴄʟᴏꜱᴇ
┊ 🔓  ᴏᴘᴇɴ
┊ ⏰  ᴅɪꜱ-1
┊ 🏷️  ᴛᴀɢᴀʟʟ
┊ 👋  ʟᴇᴀᴠᴇ
┊ ➕  ᴊᴏɪɴ
┊ ➕  ᴀᴅᴅ
┊ 📇  ᴠᴄꜱ
╰───────────────────┈⊷
╭《 \`𝐋𝐎𝐆𝐎 𝐌𝐄𝐍𝐔\` 》───┈⊷
┊ • Hacker
┊ • Hacker2
┊ • Graffiti
┊ • Cat
┊ • Sand
┊ • Gold
┊ • Arena
┊ • Dragonball
┊ • Naruto
┊ • Child
┊ • Leaves
┊ • 1917
┊ • Typography
╰───────────────────┈⊷
╭《 \`𝗢𝗧𝗛𝗘𝗥 𝗠𝗘𝗡𝗨\` 》──┈⊷
┊ 🔐  ꜱᴇʟꜰ
┊ 🌐  ᴘᴜʙʟɪᴄ  
┊ 🖼️  ꜰᴜʟʟᴘᴘ 
┊ 💾  ʀᴇᴘᴏ
┊ 🌤️  ᴡᴇᴀᴛʜᴇʀ 
┊ ⚡  ᴄᴏᴍᴘɪʟᴇ-ᴊꜱ
┊ 🔧  ꜱᴇᴛᴘʀᴇꜰɪx
┊ 🚀  ꜱᴘᴇᴇᴅᴛᴇꜱᴛ
┊ 🤖  ᴀʟɪᴠᴇ
┊ 🤖  ᴀᴛᴛᴘ
┊ 📥  ᴅᴏᴡɴʟᴏᴀᴅ
┊ 🎮  ᴘʟᴀʏ
┊ 👁️  ᴠᴠ
┊ 📹  ᴛɪᴋᴛᴏᴋ
┊ 👑  ᴏᴡɴᴇʀ 
┊ 🔍  ꜰᴇᴛᴄʜ
┊ 👤  ɢᴇᴛᴘᴘ
┊ 🐙  ɢɪᴛʜᴜʙ
┊ 📡  ᴘɪɴɢ
┊ 💬  ǫᴜᴏᴛᴇ
┊ 🧮  ᴄᴀʟᴄ
┊ 🌐  ᴛʀᴀɴꜱʟᴀᴛᴇ
┊ 📅  ᴊᴀᴅᴡᴀʟ
┊ ℹ️  ɪɴꜰᴏ
╰───────────────────┈⊷
> ✦ 𝗣𝗼𝘄𝗲𝗿𝗲𝗱 𝗯𝘆 𝗖𝗮𝘀𝗲𝘆𝗿𝗵𝗼𝗱𝗲𝘀 🧑‍💻`;

    const thumbnailUrl = 'https://files.catbox.moe/k3wgqy.jpg';
    
    try {
        // Send menu message
        const menuMessage = await trashcore.sendMessage(m.chat, { 
            image: { url: thumbnailUrl },
            caption: text,
            mentions: [m.sender],
            contextInfo: {
                forwardingScore: 1,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '120363420261263259@newsletter',
                    newsletterName: 'ꜰʀᴏꜱᴛ-xᴍᴅ ᴘʀᴇᴍɪᴜᴍ 🌟',
                    serverMessageId: -1
                },
                externalAdReply: {
                    title: `𝐅𝐑𝐎𝐒𝐓-𝐗𝐌𝐃 𝐌𝐄𝐍𝐔 ❄️`,
                    body: `ᴘʀᴇᴍɪᴜᴍ ʙᴏᴛ ꜱᴇʀᴠɪᴄᴇꜱ`,
                    mediaType: 1,
                    thumbnailUrl: "https://files.catbox.moe/dg3jwo.jpg",
                    sourceUrl: "https://wa.me/254112192119",
                    renderLargerThumbnail: false
                }
            }
        }, { 
            quoted: m
        });

        // Add success reaction after menu is sent
        await trashcore.sendMessage(m.chat, {
            react: { text: "✅", key: m.key }
        });

    } catch (error) {
        console.error('Error sending menu:', error);
        
        // Add error reaction
        await trashcore.sendMessage(m.chat, {
            react: { text: "❌", key: m.key }
        });
        
        // Fast fallback - send text only
        await trashcore.sendMessage(m.chat, { 
            text: text
        }, { quoted: m });

        // Add fallback success reaction
        await trashcore.sendMessage(m.chat, {
            react: { text: "📄", key: m.key }
        });
    }
}
break;
case "setpp":
case "setprofile": {
    try {
        // Check if user is owner
        const isOwner = m.sender === config.OWNER_NUMBER + '@s.whatsapp.net';
        if (!isOwner) {
            return m.reply('🔐 *Owner Only*\nThis command is only available for the bot owner.');
        }

        // Check if message is a reply
        if (!m.quoted) {
            return m.reply('🖼️ *Profile Picture Setter*\nPlease reply to an image to set as profile picture.\n\nUsage: .setpp [reply to image]');
        }

        // Check if quoted message contains an image
        const quotedMessage = m.quoted.message;
        const imageMessage = quotedMessage?.imageMessage || quotedMessage?.stickerMessage;
        
        if (!imageMessage) {
            return m.reply('❌ *Invalid Media*\nThe replied message must contain an image or sticker.');
        }

        // Create tmp directory if it doesn't exist
        const tmpDir = path.join(process.cwd(), 'tmp');
        if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true });
        }

        // Download the image
        const stream = await downloadContentFromMessage(imageMessage, 'image');
        let buffer = Buffer.from([]);
        
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        const imagePath = path.join(tmpDir, `profile_${Date.now()}.jpg`);
        
        // Save the image
        fs.writeFileSync(imagePath, buffer);

        // Set the profile picture
        await trashcore.updateProfilePicture(trashcore.user.id, { url: imagePath });

        // Clean up the temporary file
        fs.unlinkSync(imagePath);

        await trashcore.sendMessage(m.chat, {
            text: '✅ *Profile Picture Updated Successfully!*\n\nYour profile picture has been updated successfully.'
        }, { quoted: m });

    } catch (error) {
        console.error('[SETPP] Error:', error);
        m.reply('❌ *Update Failed*\nFailed to update profile picture. Please try again with a different image.');
    }
}
break;
//setting
case "antidelete": {
    if (!isOwner) return m.reply("⛔ Owner only command!");
    
    const modes = ["off", "private", "chat"];
    const currentMode = global.antidelete || "off";
    const currentIndex = modes.indexOf(currentMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    
    global.antidelete = nextMode;
    
    let statusMessage = "";
    switch(nextMode) {
        case "off":
            statusMessage = "❌ *Antidelete Disabled*";
            break;
        case "private":
            statusMessage = "🔒 *Antidelete Enabled (Private)*\nDeleted messages will be sent to owner";
            break;
        case "chat":
            statusMessage = "👥 *Antidelete Enabled (Group)*\nDeleted messages will be shown in the group";
            break;
    }
    
    await trashcore.sendMessage(m.chat, {
        text: `🚨 *FROST-XMD ANTIDELETE*\n\n${statusMessage}\n\nCurrent Mode: *${nextMode.toUpperCase()}*`,
        contextInfo: {
            mentionedJid: [m.sender],
            externalAdReply: {
                showAdAttribution: true,
                renderLargerThumbnail: false,
                title: `FROST-XMD SECURITY`,
                body: `Antidelete System`,
                previewType: "PHOTO",
                thumbnail: { url: 'https://files.catbox.moe/d77o4e.jpg' },
                sourceUrl: null,
                mediaUrl: null,
            }
        }
    }, { quoted: m });
}
break;

case "antidelete status": {
    const currentMode = global.antidelete || "off";
    let statusInfo = "";
    
    switch(currentMode) {
        case "off":
            statusInfo = "❌ *Disabled* - No message tracking";
            break;
        case "private":
            statusInfo = "🔒 *Private Mode* - Sends deleted messages to owner";
            break;
        case "chat":
            statusInfo = "👥 *Group Mode* - Shows deleted messages in chat";
            break;
    }
    
    await m.reply(`🚨 *ANTIDELETE STATUS*\n\nCurrent Mode: *${currentMode.toUpperCase()}*\n${statusInfo}`);
}
break;

// ================== PRESENCE COMMANDS ==================
case "presence": {
    if (!isOwner) return m.reply("⛔ Owner only command!");
    
    const presences = ["online", "typing", "recording", "offline"];
    const currentPresence = global.wapresence || "online";
    const currentIndex = presences.indexOf(currentPresence);
    const nextPresence = presences[(currentIndex + 1) % presences.length];
    
    global.wapresence = nextPresence;
    
    await trashcore.sendPresenceUpdate(nextPresence === "offline" ? "unavailable" : "available", m.chat);
    if (nextPresence === "typing") await trashcore.sendPresenceUpdate('composing', m.chat);
    if (nextPresence === "recording") await trashcore.sendPresenceUpdate('recording', m.chat);
    
    await m.reply(`📱 *Presence Updated*\nNew Status: *${nextPresence.toUpperCase()}*`);
}
break;

case "autoread": {
    if (!isOwner) return m.reply("⛔ Owner only command!");
    
    global.autoread = global.autoread === "on" ? "off" : "on";
    
    await m.reply(`🧑‍💻 *AutoRead ${global.autoread === "on" ? "Enabled" : "Disabled"}*\nMessages will ${global.autoread === "on" ? "automatically" : "not"} be marked as read`);
}
break;

case 'gitclone': 
case 'githubdl': 
case 'gitdl': {
    if (!text) return m.reply("❌ *Where is the GitHub repository link?*\n\n*Example:* `https://github.com/Caseyrhodes001/FROST-XMD`");
    
    if (!text.includes('github.com')) {
        return m.reply("❌ *That doesn't look like a GitHub repository link!*\n\nPlease provide a valid GitHub URL starting with `https://github.com/`");
    }

    try {
        // Add loading reaction
        await trashcore.sendMessage(m.chat, {
            react: { text: "⏳", key: m.key }
        });

        await m.reply("🔍 *Validating GitHub repository...*");

        let regex = /(?:https|git)(?::\/\/|@)github\.com[\/:]([^\/:]+)\/(.+)/i;
        let [, username, repo] = text.match(regex) || [];
        
        if (!username || !repo) {
            return m.reply("❌ *Invalid GitHub repository format!*\n\nPlease provide a valid GitHub repository URL like:\n`https://github.com/username/repository`");
        }

        // Clean repo name
        repo = repo.replace(/.git$/, '');
        
        let apiUrl = `https://api.github.com/repos/${username}/${repo}/zipball`;
        let repoUrl = `https://github.com/${username}/${repo}`;

        await m.reply(`📦 *Downloading repository...*\n\n👤 *User:* ${username}\n📁 *Repo:* ${repo}\n🔗 *URL:* ${repoUrl}`);

        // Get filename from headers
        const response = await fetch(apiUrl, { method: 'HEAD' });
        
        if (!response.ok) {
            return m.reply(`❌ *Repository not found!*\n\nMake sure:\n• The repository exists\n• It's a public repository\n• The URL is correct`);
        }

        const contentDisposition = response.headers.get('content-disposition');
        let filename = 'repository.zip';
        
        if (contentDisposition) {
            const match = contentDisposition.match(/attachment; filename=(.*)/);
            if (match && match[1]) {
                filename = match[1];
            }
        }

        // Ensure .zip extension
        if (!filename.endsWith('.zip')) {
            filename += '.zip';
        }

        // Send the repository as document
        await trashcore.sendMessage(m.chat, {
            document: { 
                url: apiUrl 
            },
            fileName: filename,
            mimetype: 'application/zip',
            caption: `📦 *GitHub Repository Downloaded*\n\n👤 *Author:* ${username}\n📁 *Repository:* ${repo}\n💾 *Filename:* ${filename}\n🔗 *Source:* ${repoUrl}\n\n🛠️ Downloaded by FROST-XMD`
        }, { quoted: m });

        // Success reaction
        await trashcore.sendMessage(m.chat, {
            react: { text: "✅", key: m.key }
        });

    } catch (error) {
        console.error('GitHub clone error:', error);
        
        // Error reaction
        await trashcore.sendMessage(m.chat, {
            react: { text: "❌", key: m.key }
        });
        
        m.reply(`❌ *Failed to download repository!*\n\n*Error:* ${error.message}\n\nPlease check:\n• Repository URL is correct\n• Repository is public\n• Network connection is stable`);
    }
}
break;

// ===================== TRASHCORE CASE COMMANDS =====================
//=====[PLAY COMMAND]================//
case 'play2': {
    if (!text) return m.reply("What song do you want to download?");
    
    try {
        let search = await yts(text);
        let link = search.all[0].url;

        const apis = [
            `https://xploader-api.vercel.app/ytmp3?url=${link}`,
            `https://apis.davidcyriltech.my.id/youtube/mp3?url=${link}`,
            `https://api.ryzendesu.vip/api/downloader/ytmp3?url=${link}`,
            `https://api.dreaded.site/api/ytdl/audio?url=${link}`
        ];

        for (const api of apis) {
            try {
                let data = await fetchJson(api);

                // Checking if the API response is successful
                if (data.status === 200 || data.success) {
                    let videoUrl = data.result?.downloadUrl || data.url;
                    let outputFileName = `${search.all[0].title.replace(/[^a-zA-Z0-9 ]/g, "")}.mp3`;
                    let outputPath = path.join(__dirname, outputFileName);

                    const response = await axios({
                        url: videoUrl,
                        method: "GET",
                        responseType: "stream"
                    });

                    if (response.status !== 200) {
                        m.reply("sorry but the API endpoint didn't respond correctly. Try again later.");
                        continue;
                    }

                    ffmpeg(response.data)
                        .toFormat("mp3")
                        .save(outputPath)
                        .on("end", async () => {
                            await trashcore.sendMessage(
                                m.chat,
                                {
                                    document: { url: outputPath },
                                    mimetype: "audio/mp3",
                                    caption: "𝙳𝙾𝚆𝙽𝙻𝙾𝙰𝙳𝙴𝙳  𝙱𝚈 𝙵𝚁𝙾𝚂𝚃-𝚇𝙼𝙳",
                                    fileName: outputFileName,
                                },
                                { quoted: m }
                            );
                            fs.unlinkSync(outputPath);
                        })
                        .on("error", (err) => {
                            m.reply("Download failed\n" + err.message);
                        });
                    return;
                }
            } catch (e) {
                continue;
            }
        }
        m.reply("𝙁𝙖𝙞𝙡𝙚𝙙 𝙩𝙤 𝙛𝙚𝙩𝙘𝙝 𝙙𝙤𝙬𝙽𝙡𝙤𝙖𝙙 𝙪𝙧𝙡 𝙛𝙧𝙤𝙢 𝘼𝙋𝙄.");
    } catch (error) {
        m.reply("Download failed\n" + error.message);
    }
}
break;
case "video": {
    if (!text) {
        return m.reply('🎬 *Video Downloader*\nPlease provide a video name to download.');
    }

    try {
        const search = await yts(text);
        const video = search.videos[0];

        if (!video) {
            return m.reply('❌ *No Results Found*\nNo videos found for your query. Please try different keywords.');
        }

        // Create fancy video description with emojis and formatting
        const videoInfo = `
🎬 *NOW DOWNLOADING* 🎬

📹 *Title:* ${video.title}
⏱️ *Duration:* ${video.timestamp}
👁️ *Views:* ${video.views}
📅 *Uploaded:* ${video.ago}
🔗 *YouTube ID:* ${video.videoId}

⬇️ *Downloading your video... Please wait* ⬇️
        `.trim();

        // Send video info with thumbnail first
        await trashcore.sendMessage(m.chat, {
            image: { url: video.thumbnail },
            caption: videoInfo
        }, { quoted: m });

        const safeTitle = video.title.replace(/[\\/:*?"<>|]/g, '');
        const fileName = `${safeTitle}.mp4`;
        const apiURL = `${BASE_URL}/dipto/ytDl3?link=${encodeURIComponent(video.videoId)}&format=mp4`;

        const response = await axios.get(apiURL);
        const data = response.data;

        if (!data.downloadLink) {
            return m.reply('❌ *Download Failed*\nFailed to retrieve the MP4 download link. Please try again later.');
        }

        // Send video with enhanced metadata
        await trashcore.sendMessage(m.chat, {
            video: { url: data.downloadLink },
            mimetype: 'video/mp4',
            fileName: fileName,
            caption: `🎬 *${video.title}*\n⏱️ ${video.timestamp} | 👁️ ${video.views}\n\n📥 Downloaded by Frost-XMD`,
            contextInfo: {
                externalAdReply: {
                    title: video.title.substring(0, 40),
                    body: `Duration: ${video.timestamp} | Views: ${video.views}`,
                    mediaType: 2, // 2 for video
                    thumbnailUrl: video.thumbnail, // Small thumbnail URL
                    sourceUrl: `https://youtu.be/${video.videoId}`,
                    renderLargerThumbnail: false // Explicitly disable large thumbnail
                }
            }
        }, { quoted: m });

    } catch (err) {
        console.error('[VIDEO] Error:', err);
        m.reply('❌ *Error Occurred*\nFailed to process your video request. Please try again later.');
    }
}
break;
//=====[PLAY COMMAND]================//
case "play": {
    if (!text) {
        return m.reply('🎵 *Music Player*\nPlease provide a song name to play.');
    }

    try {
        const search = await yts(text);
        const video = search.videos[0];

        if (!video) {
            return m.reply('❌ *No Results Found*\nNo songs found for your query. Please try different keywords.');
        }

        // Create fancy song description with emojis and formatting
        const songInfo = `
🎧 *NOW PLAYING* 🎧

📀 *Title:* ${video.title}
⏱️ *Duration:* ${video.timestamp}
👁️ *Views:* ${video.views}
📅 *Uploaded:* ${video.ago}
🔗 *YouTube ID:* ${video.videoId}

⬇️ *Downloading your audio... Please wait* ⬇️
        `.trim();

        // Send song info with thumbnail first
        await trashcore.sendMessage(m.chat, {
            image: { url: video.thumbnail },
            caption: songInfo
        }, { quoted: m });

        const safeTitle = video.title.replace(/[\\/:*?"<>|]/g, '');
        const fileName = `${safeTitle}.mp3`;
        const apiURL = `${BASE_URL}/dipto/ytDl3?link=${encodeURIComponent(video.videoId)}&format=mp3`;

        const response = await axios.get(apiURL);
        const data = response.data;

        if (!data.downloadLink) {
            return m.reply('❌ *Download Failed*\nFailed to retrieve the MP3 download link. Please try again later.');
        }

        // Send audio with small thumbnail
        await trashcore.sendMessage(m.chat, {
            audio: { url: data.downloadLink },
            mimetype: 'audio/mpeg',
            fileName: fileName,
            ptt: false, // Ensure it's not push-to-talk
            contextInfo: {
                externalAdReply: {
                    title: video.title.substring(0, 40),
                    body: `Duration: ${video.timestamp}`,
                    mediaType: 1, // 1 for image, 2 for video
                    thumbnailUrl: video.thumbnail, // Small thumbnail URL
                    sourceUrl: `https://youtu.be/${video.videoId}`,
                    renderLargerThumbnail: false // Explicitly disable large thumbnail
                }
            }
        }, { quoted: m });

    } catch (err) {
        console.error('[SONG] Error:', err);
        m.reply('❌ *Error Occurred*\nFailed to process your song request. Please try again later.');
    }
}
break;
case 'alive': {
    let frost = `⏰ *Uptime:* ${runtime(process.uptime())}`
    await trashcore.sendMessage(m.chat, {
        text: frost,
        contextInfo: {
            mentionedJid: [m.sender],
            externalAdReply: {
                showAdAttribution: true,
                title: '𝙵𝚁𝙾𝚂𝚃-𝚇𝙼𝙳',
                body: 'https://github.com/Caseyrhodes001/FROST-XMD',
                thumbnailUrl: 'https://files.catbox.moe/d77o4e.jpg',
                sourceUrl: 'https://github.com/Caseyrhodes001/FROST-XMD',
                mediaType: 1,
                renderLargerThumbnail: true
            },
            forwardingScore: 1,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterJid: '120363420261263259@newsletter',
                newsletterName: 'POWERED BY CASEYRHODES TECH',
                serverMessageId: -1
            }
        }
    }, { quoted: m });
}
break;

case 'weather': {
    try {
        if (!text) return m.reply("❌ Please provide a city/town name");

        const response = await fetch(`http://api.openweathermap.org/data/2.5/weather?q=${text}&units=metric&appid=1ad47ec6172f19dfaf89eb3307f74785`);
        const data = await response.json();

        console.log("Weather data:", data);

        const cityName = data.name;
        const temperature = data.main.temp;
        const feelsLike = data.main.feels_like;
        const minTemperature = data.main.temp_min;
        const maxTemperature = data.main.temp_max;
        const description = data.weather[0].description;
        const humidity = data.main.humidity;
        const windSpeed = data.wind.speed;
        const rainVolume = data.rain ? data.rain['1h'] : 0;
        const cloudiness = data.clouds.all;
        const sunrise = new Date(data.sys.sunrise * 1000);
        const sunset = new Date(data.sys.sunset * 1000);

        await m.reply(`❄️ Weather in ${cityName}

🌡️ Temperature: ${temperature}°C
📝 Description: ${description}
❄️ Humidity: ${humidity}%
🌀 Wind Speed: ${windSpeed} m/s
🌧️ Rain Volume (last hour): ${rainVolume} mm
☁️ Cloudiness: ${cloudiness}%
🌄 Sunrise: ${sunrise.toLocaleTimeString()}
🌅 Sunset: ${sunset.toLocaleTimeString()}`);

    } catch (e) { 
        m.reply("❌ Unable to find that location.") 
    }
}
break;

case "compile-js": {
    if (!text && !m.quoted) return m.reply('❌ Quote/tag a Js code to compile.');

    const sourcecode1 = m.quoted ? m.quoted.text ? m.quoted.text : text ? text : m.text : m.text;

    try {
        let resultt1 = await node.runSource(sourcecode1);
        console.log(resultt1);
        
        if (resultt1.stdout) {
            await m.reply(`📝 *Compilation Output:*\n\`\`\`${resultt1.stdout}\`\`\``);
        }
        if (resultt1.stderr) {
            await m.reply(`❌ *Compilation Error:*\n\`\`\`${resultt1.stderr}\`\`\``);
        }
        
    } catch (err) {
        console.error('Compile error:', err);
        m.reply(`❌ *Compilation Failed:*\n\`\`\`${err.message}\`\`\``);
    }
}
break;
//case prank
case "hack": {
    if (!isOwner) return m.reply("⛔ Owner only command!");
    
    try {
        const steps = [
            '⚠️𝗜𝗻𝗶𝘁𝗶𝗹𝗶𝗮𝘇𝗶𝗻𝗴 𝗛𝗮𝗰𝗸𝗶𝗻𝗴 𝗧𝗼𝗼𝗹𝘀⚠️',
            '𝗜𝗻𝗷𝗲𝗰𝘁𝗶𝗻𝗴 𝗠𝗮𝗹𝘄𝗮𝗿𝗲🐛..\n𝗟𝗼𝗮𝗱𝗶𝗻𝗴 𝗗𝗲𝘃𝗶𝗰𝗲 𝗚𝗮𝗹𝗹𝗲𝗿𝘆 𝗙𝗶𝗹𝗲𝘀⚠️',
            '```██ 10%``` ⏳',
            '```████ 20%``` ⏳',
            '```██████ 30%``` ⏳',
            '```████████ 40%``` ⏳',
            '```██████████ 50%``` ⏳',
            '```████████████ 60%``` ⏳',
            '```██████████████ 70%``` ⏳',
            '```████████████████ 80%``` ⏳',
            '```██████████████████ 90%``` ⏳',
            '```████████████████████ 100%``` ✅',
            "```𝗦𝘆𝘀𝘁𝗲𝗺 𝗛𝘆𝗷𝗮𝗰𝗸𝗶𝗻𝗴 𝗼𝗻 𝗽𝗿𝗼𝗰𝗲𝘀𝘀...```\n```𝗖𝗼𝗻𝗻𝗲𝗰𝘁𝗶𝗻𝗴 𝘁𝗼 𝘁𝗵𝗲 𝗦𝗲𝗿𝘃𝗲𝗿 𝘁𝗼 𝗙𝗶𝗻𝗱 𝗘𝗿𝗿𝗼𝗿 404```",
            "```𝗦𝘂𝗰𝗰𝗲𝘀𝗳𝘂𝗹𝗹𝘆 𝗖𝗼𝗻𝗻𝗲𝗰𝘁𝗲𝗱 𝘁𝗼 𝗗𝗲𝘃𝗶𝗰𝗲...\n𝗥𝗲𝗰𝗲𝗶𝘃𝗶𝗻𝗴 𝗗𝗮𝘁𝗮/𝗦𝗲𝗰𝗿𝗲𝘁 𝗣𝗮𝘀𝘀𝘄𝗼𝗿𝗱𝘀...```",
            "```𝗗𝗮𝘁𝗮 𝗧𝗿𝗮𝗻𝘀𝗳𝗲𝗿𝗲𝗱 𝗙𝗿𝗼𝗺 𝗱𝗲𝘃𝗶𝗰𝗲 100% 𝗖𝗼𝗺𝗽𝗹𝗲𝘁𝗲𝗱\n𝗘𝗿𝗮𝘀𝗶𝗻𝗴 𝗮𝗹𝗹 𝗘𝘃𝗶𝗱𝗲𝗻𝗰𝗲, 𝗞𝗶𝗹𝗹𝗶𝗻𝗴 𝗮𝗹𝗹 𝗠𝗮𝗹𝘄𝗮𝗿𝗲𝘀🐛...```",
            "```𝗦𝗘𝗡𝗗𝗜𝗡𝗗 𝗟𝗢𝗚 𝗗𝗢𝗖𝗨𝗠𝗘𝗡𝗧𝗦...```",
            "```𝗦𝘂𝗰𝗰𝗲𝘀𝗳𝘂𝗹𝗹𝘆 𝗦𝗲𝗻𝘁 𝗗𝗮𝘁𝗮 𝗔𝗻𝗱 𝗖𝗼𝗻𝗻𝗲𝗰𝘁𝗶𝗼𝗻 𝗦𝘂𝗰𝗰𝗲𝘀𝗳𝘂𝗹𝗹𝘆 𝗗𝗶𝘀𝗰𝗼𝗻𝗻𝗲𝗰𝘁𝗲𝗱```",
            "```𝗔𝗹𝗹 𝗕𝗮𝗰𝗸𝗹𝗼𝗴𝘀 𝗖𝗹𝗲𝗮𝗿𝗲𝗱 𝗦𝘂𝗰𝗰𝗲𝘀𝗳𝘂𝗹𝗹𝘆💣\n𝗬𝗼𝘂𝗿 𝗦𝘆𝘀𝘁𝗲𝗺 𝗪𝗶𝗹𝗹 𝗕𝗲 𝗗𝗼𝘄𝗻 𝗜𝗻 𝗧𝗵𝗲 𝗡𝗲𝘅𝘁 𝗠𝗶𝗻𝘂𝘁𝗲⚠️```"
        ];

        for (const line of steps) {
            await trashcore.sendMessage(m.chat, { text: line }, { quoted: m });
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

    } catch (error) {
        console.error('Error during hack prank:', error);
        m.reply(`❌ *Error!* Something went wrong. Reason: ${error.message}. Please try again later.`);
    }
}
break;

//==================GROUP CMDS======================================================================================================//	
case "tagall": { 
    if (!m.isGroup) return m.reply("❌ This command can only be used in groups.");
    if (!isBotAdmins) return m.reply("❌ I need to be an admin to perform this action.");
    if (!isAdmins) return m.reply("❌ Only admins can use this command.");
    
    let txt = `👥 Tagged by ${m.pushName}.\n\n💬 Message: ${text ? text : 'No Message!'}\n\n`; 
    
    for (let mem of participants) { 
        txt += `📍 @${mem.id.split('@')[0]}\n`; 
    } 

    await trashcore.sendMessage(m.chat, {
        text: txt,
        mentions: participants.map(p => p.id)
    }, { quoted: m });
}
break;
//=====[TAGALL COMMAND]================//
case "tagall3":
case "totag": {
    if (!m.isGroup) return m.reply("❌ This command can only be used in groups.");
    
    // Check if user is admin
    if (!m.isAdmin && !isOwner) return m.reply("❌ This command is for group admins only.");
    
    if (!m.quoted) return m.reply(`❌ Reply to a message with *${prefix}tagall* to tag everyone.`);

    try {
        const groupMetadata = await trashcore.groupMetadata(m.chat);
        const participants = groupMetadata.participants;
        const mentions = participants.map(p => p.id);

        // Send mention message
        await trashcore.sendMessage(m.chat, {
            text: `📢 *GROUP MENTION* 📢\n\nTagging all ${participants.length} members!\n\n` + 
                  `👥 *Group:* ${groupMetadata.subject}\n` +
                  `🔔 *Mentioned by:* @${m.sender.split('@')[0]}`,
            mentions: [m.sender, ...mentions]
        }, { quoted: m });

        // Forward quoted message with mentions
        await trashcore.sendMessage(m.chat, {
            forward: m.quoted,
            mentions: mentions
        });

    } catch (error) {
        console.error("Tagall error:", error);
        return m.reply("❌ Failed to tag all members.");
    }
}
break;
case "attp": {
    if (!text) {
        return m.reply('🎭 *ATTP Sticker Maker*\nPlease provide text to create animated sticker.\n\nExample: .attp Hello');
    }

    try {
        await trashcore.sendMessage(m.chat, {
            sticker: {
                url: `https://api.lolhuman.xyz/api/attp?apikey=cde5404984da80591a2692b6&text=${encodeURIComponent(text)}`
            }
        }, { quoted: m });

    } catch (err) {
        console.error('[ATTP] Error:', err);
        m.reply('❌ *Sticker Creation Failed*\nFailed to create animated sticker. Please try again later.');
    }
}
break;

case "autolike": {
    if (!isOwner) return m.reply("⛔ Owner only command!");
    
    const current = global.autolike || "off";
    if (!text) return reply(`🫠 Autolike is currently *${current.toUpperCase()}*`);
    if (!["on", "off"].includes(text.toLowerCase())) return reply("❌ Usage: autolike on/off");
    if (text.toLowerCase() === current) return reply(`✅ Autolike is already *${text.toUpperCase()}*`);
    
    global.autolike = text.toLowerCase();
    reply(`✅ Autolike has been turned *${text.toUpperCase()}*`);
}
break;

case "autobio": {
    if (!isOwner) return m.reply("⛔ Owner only command!");
    
    const current = global.autobio || "off";
    if (!text) return reply(`😇 Autobio is currently *${current.toUpperCase()}*`);
    if (!["on", "off"].includes(text.toLowerCase())) return reply("❌ Usage: autobio on/off");
    if (text.toLowerCase() === current) return reply(`✅ Autobio is already *${text.toUpperCase()}*`);
    
    global.autobio = text.toLowerCase();
    reply(`✅ Autobio has been turned *${text.toUpperCase()}*`);
}
break;

case "autoview": {
    if (!isOwner) return m.reply("⛔ Owner only command!");
    
    const current = global.autoview || "off";
    if (!text) return reply(`👀 Auto view status is currently *${current.toUpperCase()}*`);
    if (!["on", "off"].includes(text.toLowerCase())) return reply("❌ Usage: autoview on/off");
    if (text.toLowerCase() === current) return reply(`✅ Auto view status is already *${text.toUpperCase()}*`);
    
    global.autoview = text.toLowerCase();
    reply(`✅ Auto view status updated to *${text.toUpperCase()}*`);
}
break;

case "wapresence": {
    if (!isOwner) return m.reply("⛔ Owner only command!");
    
    const current = global.wapresence || "online";
    if (!text) return reply(`👤 Presence is currently *${current.toUpperCase()}*`);
    if (!["typing", "online", "recording"].includes(text.toLowerCase())) return reply("❌ Usage: wapresence typing/online/recording");
    if (text.toLowerCase() === current) return reply(`✅ Presence is already *${text.toUpperCase()}*`);
    
    global.wapresence = text.toLowerCase();
    reply(`✅ Presence updated to *${text.toUpperCase()}*`);
}
break;

case "anticall": {
    if (!isOwner) return m.reply("⛔ Owner only command!");
    
    const current = global.anticall || "off";
    if (!text) return reply(`🔰 Anticall is currently *${current.toUpperCase()}*`);
    if (!["on", "off"].includes(text.toLowerCase())) return reply("❌ Usage: anticall on/off");
    if (text.toLowerCase() === current) return reply(`✅ Anticall is already *${text.toUpperCase()}*`);
    
    global.anticall = text.toLowerCase();
    reply(`✅ Anticall has been turned *${text.toUpperCase()}*`);
}
break;

case "block": {
    if (!isOwner) return m.reply("⛔ Owner only command!");
    if (!m.quoted && !m.mentionedJid[0] && !text) return m.reply("*🔖 Please tag someone or enter a phone number!*");
    
    let users = m.mentionedJid[0] 
        ? m.mentionedJid[0] 
        : m.quoted 
            ? m.quoted.sender 
            : text.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
    
    if (users == "254112192119@s.whatsapp.net") return m.reply("*😠 I cannot block my Owner!*");
    if (users == trashcore.decodeJid(trashcore.user.id)) return m.reply("*🤦 I cannot block myself!*");
    
    await trashcore.updateBlockStatus(users, 'block');
    m.reply("*✅ Blocked successfully!*");
}
break;

case "unblock": {
    if (!isOwner) return m.reply("⛔ Owner only command!");
    if (!m.quoted && !m.mentionedJid[0] && !text) return m.reply("*🔖 Please tag someone or enter a phone number!*");
    
    let users = m.mentionedJid[0] 
        ? m.mentionedJid[0] 
        : m.quoted 
            ? m.quoted.sender 
            : text.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
    
    await trashcore.updateBlockStatus(users, 'unblock');
    m.reply("*✅ Unblocked successfully!*");
}
break;

case "blocklist": {
    if (!isOwner) return m.reply("⛔ Owner only command!");
    
    const blockedContacts = await trashcore.fetchBlocklist();
    
    if (!blockedContacts || blockedContacts.length === 0) {
        return m.reply("*📭 The block list is currently empty!*");
    }

    let blockedList = "*📋 Blocked Contacts List:*\n\n";
    blockedContacts.forEach((contact, index) => {
        const number = contact.split('@')[0];
        blockedList += `*${index + 1}.* ${number}\n`;
    });

    blockedList += `\n*✅ Total: ${blockedContacts.length} contact(s)*`;
    
    m.reply(blockedList);
}
break;

case 'join': { 
    if (!isOwner) return m.reply("⛔ Owner only command!");
    if (!text) return m.reply("*🔗 Please provide a valid group link!*");
    
    if (!text.includes('https://chat.whatsapp.com/')) {
        return m.reply("*❌ Please provide a valid WhatsApp group link!*");
    }
    
    let result = text.split('https://chat.whatsapp.com/')[1];
    
    try {
        await trashcore.groupAcceptInvite(result);
        m.reply("*✅ Successfully joined the group!*");
    } catch (err) {
        m.reply(`*❌ Failed to join group:* ${err.message}`);
    }
}
break;

case "leave": { 
    if (!isOwner) return m.reply("⛔ Owner only command!");
    if (!m.isGroup) return m.reply("❌ This command can only be used in groups.");
    
    await trashcore.sendMessage(m.chat, { 
        text: '𝗚𝗼𝗼𝗱𝗯𝘆𝗲 𝗲𝘃𝗲𝗿𝘆𝗼𝗻𝗲👋. 𝗙𝗥𝗢𝗦𝗧-𝗫𝗠𝗗 𝗶𝘀 𝗟𝗲𝗮𝘃𝗶𝗻𝗴 𝘁𝗵𝗲 𝗚𝗿𝗼𝘂𝗽 𝗻𝗼𝘄...', 
        mentions: participants.map(a => a.id)
    }, { quoted: m }); 
    
    await trashcore.groupLeave(m.chat); 
} 
break;
////////////more
case "close": 
case "mute": { 
    if (!m.isGroup) return m.reply("❌ This command can only be used in groups.");
    if (!isBotAdmins) return m.reply("❌ I need to be an admin to perform this action.");
    if (!isAdmins) return m.reply("❌ Only admins can use this command.");

    await trashcore.groupSettingUpdate(m.chat, 'announcement'); 
    m.reply('🔒 Group successfully locked!');
} 
break;

case "open": 
case "unmute": { 
    if (!m.isGroup) return m.reply("❌ This command can only be used in groups.");
    if (!isBotAdmins) return m.reply("❌ I need to be an admin to perform this action.");
    if (!isAdmins) return m.reply("❌ Only admins can use this command.");

    await trashcore.groupSettingUpdate(m.chat, 'not_announcement'); 
    m.reply('🔓 Group successfully unlocked!');
}
break;

case "disp-1": { 
    if (!m.isGroup) return m.reply("❌ This command can only be used in groups.");
    if (!isBotAdmins) return m.reply("❌ I need to be an admin to perform this action.");
    if (!isAdmins) return m.reply("❌ Only admins can use this command.");

    await trashcore.groupToggleEphemeral(m.chat, 1*24*3600); 
    m.reply('⏰ Disappearing messages successfully turned on for 24hrs!');
} 
break;

case "promote": { 
    if (!m.isGroup) return m.reply("❌ This command can only be used in groups.");
    if (!isBotAdmins) return m.reply("❌ I need to be an admin to perform this action.");
    if (!isAdmins) return m.reply("❌ Only admins can use this command.");
    
    if (!m.quoted && !m.mentionedJid.length) return m.reply(`❌ Tag someone or reply to their message with the command!`);
    
    let users = m.mentionedJid[0] ? m.mentionedJid : m.quoted ? [m.quoted.sender] : [text.replace(/[^0-9]/g, '')+'@s.whatsapp.net'];

    await trashcore.groupParticipantsUpdate(m.chat, users, 'promote'); 
    m.reply('🦄 Successfully promoted!');
} 
break;

case "demote": { 
    if (!m.isGroup) return m.reply("❌ This command can only be used in groups.");
    if (!isBotAdmins) return m.reply("❌ I need to be an admin to perform this action.");
    if (!isAdmins) return m.reply("❌ Only admins can use this command.");
    
    if (!m.quoted && !m.mentionedJid.length) return m.reply(`❌ Tag someone or reply to their message with the command!`);
    
    let users = m.mentionedJid[0] ? m.mentionedJid : m.quoted ? [m.quoted.sender] : [text.replace(/[^0-9]/g, '')+'@s.whatsapp.net'];

    await trashcore.groupParticipantsUpdate(m.chat, users, 'demote'); 
    m.reply('😲 Successfully demoted!');
} 
break;

//=====[TAGALL2 COMMAND - Alternative without reply]================//
case "tagall2": {
    if (!m.isGroup) return m.reply("❌ This command can only be used in groups.");
    
    if (!m.isAdmin && !isOwner) return m.reply("❌ This command is for group admins only.");

    try {
        const groupMetadata = await trashcore.groupMetadata(m.chat);
        const participants = groupMetadata.participants;
        const mentions = participants.map(p => p.id);

        const mentionText = `📢 *MENTION ALL* 📢\n\n` +
                           `👥 Total Members: ${participants.length}\n` +
                           `🏷️ Mentioned by: @${m.sender.split('@')[0]}\n\n` +
                           `🔔 *All Members:*\n` +
                           participants.map((p, i) => `${i+1}. @${p.id.split('@')[0]}`).join('\n');

        await trashcore.sendMessage(m.chat, {
            text: mentionText,
            mentions: [m.sender, ...mentions]
        }, { quoted: m });

    } catch (error) {
        console.error("Tagall2 error:", error);
        return m.reply("❌ Failed to tag all members.");
    }
}
break;
case "bible": {
    if (!text) {
        return reply(`❌ *Please provide a Bible reference.*\n\n*Example:* ${prefix}bible John 3:16\n*Other examples:*\n• ${prefix}bible Genesis 1:1\n• ${prefix}bible Psalm 23:1-3\n• ${prefix}bible Matthew 5:3-12`);
    }
    
    try {
        // Add loading reaction
        await trashcore.sendMessage(m.chat, {
            react: { text: "⏳", key: m.key }
        });

        await m.reply("📖 *Searching Bible verse...*");

        const reference = encodeURIComponent(text.trim());
        const apiUrl = `https://bible-api.com/${reference}`;
        const response = await axios.get(apiUrl);

        if (response.status === 200 && response.data.text) {
            const { reference: ref, text: verseText, translation_name } = response.data;
		
            const bibleMessage = `📖 *BIBLE VERSE*\n\n` +
                `*Reference:* ${ref}\n` +
                `*Translation:* ${translation_name || 'NIV'}\n\n` +
                `"${verseText}"\n\n` +
                `_Requested by ${pushname}_`;

            await reply(bibleMessage);

            // Success reaction
            await trashcore.sendMessage(m.chat, {
                react: { text: "✅", key: m.key }
            });

        } else {
            await trashcore.sendMessage(m.chat, {
                react: { text: "❌", key: m.key }
            });
            reply("❌ *Verse not found.*\n\nPlease check:\n• Spelling of book name\n• Chapter and verse numbers\n• Reference format (e.g., John 3:16)");
        }
    } catch (error) {
        console.error('Bible API error:', error);
        
        // Error reaction
        await trashcore.sendMessage(m.chat, {
            react: { text: "❌", key: m.key }
        });
        
        reply(`❌ *Failed to fetch Bible verse!*\n\n*Error:* ${error.message}\n\nPlease check:\n• Internet connection\n• Valid Bible reference\n• Try again later`);
    }
}
break;
case "fetch": {
    const fetch = require('node-fetch');
    const cheerio = require('cheerio');

    if (!text) return m.reply("🔍 Provide a valid website URL to inspect!\n\nI'll crawl the website and fetch its HTML, CSS, JavaScript, and embedded media files.");
    
    if (!/^https?:\/\//i.test(text)) {
        return m.reply("❌ Please provide a valid URL starting with http:// or https://");
    }

    try {
        // Add loading reaction
        await trashcore.sendMessage(m.chat, {
            react: { text: "⏳", key: m.key }
        });

        await m.reply("🌐 *Starting website inspection...*");

        const response = await fetch(text, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 30000
        });
        
        if (!response.ok) {
            return m.reply(`❌ Failed to fetch website. Status: ${response.status} ${response.statusText}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // Extract website information
        const title = $('title').text() || 'No Title';
        const description = $('meta[name="description"]').attr('content') || 'No Description';
        const keywords = $('meta[name="keywords"]').attr('content') || 'No Keywords';

        // Collect media files
        const mediaFiles = [];
        $('img[src], video[src], audio[src], source[src]').each((i, element) => {
            let src = $(element).attr('src');
            if (src) {
                const fullUrl = new URL(src, text).href;
                mediaFiles.push(`• ${$(element).prop('tagName')}: ${fullUrl}`);
            }
        });

        // Collect CSS files
        const cssFiles = [];
        $('link[rel="stylesheet"]').each((i, element) => {
            let href = $(element).attr('href');
            if (href) {
                const fullUrl = new URL(href, text).href;
                cssFiles.push(fullUrl);
            }
        });

        // Collect JavaScript files
        const jsFiles = [];
        $('script[src]').each((i, element) => {
            let src = $(element).attr('src');
            if (src) {
                const fullUrl = new URL(src, text).href;
                jsFiles.push(fullUrl);
            }
        });

        // Collect meta information
        const metaTags = [];
        $('meta').each((i, element) => {
            const name = $(element).attr('name') || $(element).attr('property');
            const content = $(element).attr('content');
            if (name && content) {
                metaTags.push(`• ${name}: ${content}`);
            }
        });

        // Send website overview
        const overview = `🌐 *WEBSITE INSPECTION REPORT*

📝 *Title:* ${title}
📄 *Description:* ${description.substring(0, 100)}${description.length > 100 ? '...' : ''}
🏷️ *Keywords:* ${keywords.substring(0, 50)}${keywords.length > 50 ? '...' : ''}

📊 *Statistics:*
• 📄 HTML Size: ${(html.length / 1024).toFixed(2)} KB
• 🖼️ Media Files: ${mediaFiles.length}
• 🎨 CSS Files: ${cssFiles.length}
• ⚡ JS Files: ${jsFiles.length}
• 🔖 Meta Tags: ${metaTags.length}

🔗 *Inspected URL:* ${text}`;

        await m.reply(overview);

        // Send media files list (limited to avoid flooding)
        if (mediaFiles.length > 0) {
            const mediaList = mediaFiles.slice(0, 10).join('\n');
            await m.reply(`🖼️ *Media Files Found* (${mediaFiles.length} total):\n\n${mediaList}${mediaFiles.length > 10 ? `\n\n... and ${mediaFiles.length - 10} more files` : ''}`);
        }

        // Send CSS files list
        if (cssFiles.length > 0) {
            const cssList = cssFiles.slice(0, 5).join('\n• ');
            await m.reply(`🎨 *CSS Files Found* (${cssFiles.length}):\n\n• ${cssList}${cssFiles.length > 5 ? `\n\n... and ${cssFiles.length - 5} more` : ''}`);
        }

        // Send JS files list
        if (jsFiles.length > 0) {
            const jsList = jsFiles.slice(0, 5).join('\n• ');
            await m.reply(`⚡ *JavaScript Files Found* (${jsFiles.length}):\n\n• ${jsList}${jsFiles.length > 5 ? `\n\n... and ${jsFiles.length - 5} more` : ''}`);
        }

        // Send success reaction
        await trashcore.sendMessage(m.chat, {
            react: { text: "✅", key: m.key }
        });

        await m.reply("✅ *Website inspection completed!*\n\nUse `.fetch` command to download specific files.");

    } catch (error) {
        console.error('Website inspection error:', error);
        
        // Send error reaction
        await trashcore.sendMessage(m.chat, {
            react: { text: "❌", key: m.key }
        });
        
        m.reply(`❌ *Inspection failed!*\n\nError: ${error.message}\n\nMake sure the website is accessible and the URL is correct.`);
    }
}
break;

case "img": 
case "ai-img": 
case "image": 
case "images": {
    const gis = require('g-i-s');
    
    if (!text) return m.reply("❌ Provide a search term for images");

    try {
        // Use the 'text' as the search term for images
        gis(text, async (error, results) => {
            if (error) {
                return m.reply("❌ An error occurred while searching for images.\n" + error);
            }

            // Check if results are found
            if (results.length === 0) {
                return m.reply("❌ No images found for your search.");
            }

            // Limit the number of images to send (e.g., 5)
            const numberOfImages = Math.min(results.length, 5);
            const imageUrls = results.slice(0, numberOfImages).map(result => result.url);

            // Send the images
            const messages = imageUrls.map(url => ({
                image: { url },
                caption: `🖼️ ${text}\n\n📸 Downloaded by ${botname}`
            }));

            for (const message of messages) {
                await trashcore.sendMessage(m.chat, message, { quoted: m });
                // Add delay between sends to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        });
    } catch (e) {
        console.error('Image search error:', e);
        m.reply("❌ An error occurred while processing your request.\n" + e.message);
    }
}
break;
//case ping 
case "ping":
case "speed":
case "pong": {
    try {
        const start = Date.now();

        const speedLatencyQuotes = [
            "Speed matters in the digital world!",
            "Efficiency is doing better what is already being done.",
            "In the race against time, every millisecond counts.",
            "Performance isn't accidental, it's designed.",
            "The faster the response, the smoother the experience."
        ];

        const stableEmojis = ['🟢', '✅', '🧠', '📶', '🛰️'];
        const moderateEmojis = ['🟡', '🌀', '⚠️', '🔁', '📡'];
        const slowEmojis = ['🔴', '🐌', '❗', '🚨', '💤'];

        const randomQuote = speedLatencyQuotes[Math.floor(Math.random() * speedLatencyQuotes.length)];

        const end = Date.now();
        const latencyMs = end - start;

        let stabilityEmoji = '';
        let stabilityText = '';
        let reactionEmoji = '⚡';

        if (latencyMs > 1000) {
            stabilityText = "Slow 🔴";
            stabilityEmoji = slowEmojis[Math.floor(Math.random() * slowEmojis.length)];
            reactionEmoji = '🐢';
        } else if (latencyMs > 500) {
            stabilityText = "Moderate 🟡";
            stabilityEmoji = moderateEmojis[Math.floor(Math.random() * moderateEmojis.length)];
            reactionEmoji = '🔄';
        } else {
            stabilityText = "Stable 🟢";
            stabilityEmoji = stableEmojis[Math.floor(Math.random() * stableEmojis.length)];
            reactionEmoji = '⚡';
        }

        const stylishText = `
> *𝐅𝐑𝐎𝐒𝐓-𝐗𝐌𝐃❄️: ${latencyMs}ms ${reactionEmoji}*
    `.trim();

        // Verified contact context
        const verifiedContact = {
            key: {
                fromMe: false,
                participant: `0@s.whatsapp.net`,
                remoteJid: "status@broadcast"
            },
            message: {
                contactMessage: {
                    displayName: "CASEYRHODES VERIFIED ✅",
                    vcard: "BEGIN:VCARD\nVERSION:3.0\nFN: Caseyrhodes VERIFIED ✅\nORG:CASEYRHODES-TECH BOT;\nTEL;type=CELL;type=VOICE;waid=13135550002:+13135550002\nEND:VCARD"
                }
            }
        };
        
        const whatsappChannelLink = 'https://whatsapp.com/channel/0029VasHgfG4tRrwjAUyTs10';

        await trashcore.sendMessage(m.chat, {
            text: stylishText,
            contextInfo: {
                mentionedJid: [m.sender],
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '120363420261263259@newsletter',
                    newsletterName: "𝐂𝐀𝐒𝐄𝐘𝐑𝐇𝐎𝐃𝐄𝐒 𝐓𝐄𝐂𝐇",
                    serverMessageId: 143
                },
                externalAdReply: {
                    title: "𝐟𝐫𝐨𝐬𝐭 | 𝐩𝐢𝐧𝐠 𝐫𝐞𝐬𝐩𝐨𝐧𝐬𝐞🚀",
                    body: "Speed • Stability • Sync",
                    thumbnailUrl: 'https://files.catbox.moe/d77o4e.jpg',
                    sourceUrl: whatsappChannelLink,
                    mediaType: 1,
                    renderLargerThumbnail: false,
                }
            }
        }, { quoted: verifiedContact });

    } catch (e) {
        console.error("Error in ping command:", e);
        m.reply(`An error occurred: ${e.message}`);
    }
}
break
case "eval": {
    if (!isOwner) return m.reply("⛔ Owner only command!");
    
    if (!text) return m.reply("❌ Provide a valid JavaScript code to evaluate");
    
    try {
        // Add loading reaction
        await trashcore.sendMessage(m.chat, {
            react: { text: "⏳", key: m.key }
        });

        let evaled = await eval(text);
        if (typeof evaled !== 'string') evaled = require('util').inspect(evaled);
        
        // Truncate if too long
        const result = evaled.length > 2000 ? evaled.substring(0, 2000) + '...' : evaled;
        
        await reply(`✅ *Evaluation Result:*\n\n\`\`\`${result}\`\`\``);

        // Success reaction
        await trashcore.sendMessage(m.chat, {
            react: { text: "✅", key: m.key }
        });

    } catch (err) {
        // Error reaction
        await trashcore.sendMessage(m.chat, {
            react: { text: "❌", key: m.key }
        });
        
        await reply(`❌ *Evaluation Error:*\n\n\`\`\`${String(err)}\`\`\``);
    }
}
break;

//========================================================================================================================//		      
case "add": {
    if (!isBotAdmins) return m.reply("❌ I need to be an admin to perform this action.");
    if (!isAdmins) return m.reply("❌ Only admins can use this command.");
    if (!m.isGroup) return m.reply("❌ This command can only be used in groups.");
    
    if (!text || isNaN(text.replace(/[^0-9]/g, ''))) {
        return m.reply("❌ Please provide a valid phone number to add.\n\n*Example:* .add 254712345678\n*Format:* Country code + number (no spaces or symbols)");
    }
    
    try {
        // Clean the phone number
        const cleanNumber = text.replace(/[^0-9]/g, '');
        const userToAdd = `${cleanNumber}@s.whatsapp.net`;
        
        // Add loading reaction
        await trashcore.sendMessage(m.chat, {
            react: { text: "⏳", key: m.key }
        });

        await m.reply(`👤 *Adding user...*\n\n📱 Number: ${cleanNumber}`);
        
        // Add the user to the group
        await trashcore.groupParticipantsUpdate(m.chat, [userToAdd], "add");
        
        // Success message
        await reply(`✅ *User Added Successfully!*\n\n📱 *Number:* ${cleanNumber}\n👥 *Group:* ${groupName || 'This Group'}`);

        // Success reaction
        await trashcore.sendMessage(m.chat, {
            react: { text: "✅", key: m.key }
        });

    } catch (e) {
        console.error('Error adding user:', e);
        
        // Error reaction
        await trashcore.sendMessage(m.chat, {
            react: { text: "❌", key: m.key }
        });
        
        let errorMessage = "❌ *Failed to add user!*\n\n";
        
        if (e.message.includes("not registered")) {
            errorMessage += "This phone number is not registered on WhatsApp.";
        } else if (e.message.includes("already in group")) {
            errorMessage += "This user is already in the group.";
        } else if (e.message.includes("invite")) {
            errorMessage += "Cannot add user. The group may require an invite link.";
        } else {
            errorMessage += "Please make sure:\n• Number is correct\n• User has WhatsApp\n• Group allows adding members";
        }
        
        m.reply(errorMessage);
    }
}
break;
////shzam 
case "whatsong": 
case "shazam": {
    let acr = new acrcloud({
        'host': "identify-eu-west-1.acrcloud.com",
        'access_key': '2631ab98e77b49509e3edcf493757300',
        'access_secret': "KKbVWlTNCL3JjxjrWnywMdvQGanyhKRN0fpQxyUo"
    });
    
    if (!m.quoted) {
        return m.reply('🎵 *Music Identification*\nPlease tag a short video or audio message to identify the song.');
    }

    let d = m.quoted ? m.quoted : m;
    let mimes = (d.msg || d).mimetype || d.mediaType || '';
    
    if (/video|audio/.test(mimes)) {
        let buffer = await d.download();
        await m.reply("🔍 *Analyzing the media... Please wait*");
        
        let { status, metadata } = await acr.identify(buffer);
        
        if (status.code !== 0x0) {
            return m.reply('❌ *Identification Failed*\nCould not identify the song. Please try with a clearer audio/video sample.');
        }
        
        let { title, artists, album, genres, release_date } = metadata.music[0x0];
        
        // Create formatted response with emojis
        let txt = `🎵 *SONG IDENTIFIED* 🎵\n\n`;
        txt += `📀 *Title:* ${title}\n`;
        if (artists) txt += `🎤 *Artists:* ${artists.map(artist => artist.name).join(", ")}\n`;
        if (album) txt += `💿 *Album:* ${album.name}\n`;
        if (genres) txt += `🎼 *Genres:* ${genres.map(genre => genre.name).join(", ")}\n`;
        txt += `📅 *Release Date:* ${release_date}`;

        await trashcore.sendMessage(m.chat, {
            text: txt.trim()
        }, { quoted: m });
    } else {
        return m.reply('❌ *Invalid Media*\nPlease tag a valid audio or video message.');
    }
}
break;

//========================================================================================================================//		      
case "system": {
    try {
        // Add loading reaction
        await trashcore.sendMessage(m.chat, {
            react: { text: "⏳", key: m.key }
        });

        await m.reply("🖥️ *Fetching system information...*");

        const systemInfo = `❄️ *FROST-XMD SYSTEM INFO* ❄️

🤖 *Bot Name:* FROST-XMD
⚡ *Speed:* ${(Date.now() - m.timestamp).toFixed(4)} Ms
🕐 *Runtime:* ${runtime(process.uptime())}
🌐 *Platform:* ${os.platform()} ${os.arch()}
💾 *Memory:* ${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB
👑 *Developer:* Caseyrhodes Tech
📚 *Library:* Baileys
🔧 *Node.js:* ${process.version}`;

        await trashcore.sendMessage(m.chat, { 
            image: { url: 'https://files.catbox.moe/d77o4e.jpg' }, 
            caption: systemInfo
        }, { quoted: m });

        // Success reaction
        await trashcore.sendMessage(m.chat, {
            react: { text: "✅", key: m.key }
        });

    } catch (error) {
        console.error('System command error:', error);
        
        // Error reaction
        await trashcore.sendMessage(m.chat, {
            react: { text: "❌", key: m.key }
        });
        
        m.reply("❌ *Failed to fetch system information*");
    }
}
break;
case 'gpt': {
    if (!text) return m.reply("🤖 Hello there, what's going on?");
    try {
        const data = await fetchJson(`https://api.dreaded.site/api/aichat?query=${encodeURIComponent(text)}`);
        
        if (data && data.result) {
            const res = data.result;
            await m.reply(`🤖 *FROST AI:*\n\n${res}`);
        } else {
            m.reply("❌ An error occurred while processing your request!");
        }
    } catch (error) {
        console.error('GPT Error:', error);
        m.reply('❌ An error occurred while communicating with the AI\n' + error.message);
    }
}
break;

case 'trt': 
case 'translate': {
    try {
        // Check if the message is quoted
        if (!m.quoted) {
            return m.reply("❌ Please quote a message to translate.");
        }
        // Extract the language code from the text
        const langCode = text.trim();
        // Check if a valid language code is provided
        if (!langCode) {
            return m.reply("❌ Please provide a valid language code.\n\n*Example:* .translate en\n*Supported:* en, es, fr, de, etc.");
        }
        // Get the quoted message
        const quotedMessage = m.quoted.text;
        // Translate the quoted message
        const translation = await translatte(quotedMessage, { to: langCode });
        // Send the translated message
        m.reply(`🌐 *Translation:*\n\n${translation.text}\n\n📝 *Original:* ${quotedMessage}`);
    } catch (e) {
        console.error("Translate Error:", e);
        m.reply("❌ An error occurred while translating the text. Please try again later.");
    }
}
break;

case 'cast': {
    if (!isOwner) return m.reply("⛔ Owner only command!");
    if (!m.isGroup) return m.reply("❌ This command can only be used in groups.");
    if (!text) return m.reply("❌ Provide a text to broadcast!");
    
    let members = participants.filter(v => v.id.endsWith('.net')).map(v => v.id);
    
    m.reply(`📢 Broadcasting message to ${members.length} members...\n\n⚠️ Use this command sparingly to avoid WhatsApp restrictions!`);
    
    let successCount = 0;
    let failCount = 0;
    
    for (let member of members) {
        try {
            await trashcore.sendMessage(member, { text: text });
            successCount++;
            // Add small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
            failCount++;
            console.error(`Failed to send to ${member}:`, error);
        }
    }
    
    m.reply(`✅ Broadcasting completed!\n\n📤 Successful: ${successCount}\n❌ Failed: ${failCount}\n👥 Total: ${members.length}`);
}
break;

case 'sc':
case 'script':
case 'repo': {
    try {
        const res = await fetch('https://api.github.com/repos/Caseyrhodes001/FROST-XMD');
        const data = await res.json();

        // Adjust time to Kenya timezone (UTC+3)
        const now = new Date();
        const kenyaTime = new Date(now.getTime() + 3 * 60 * 60 * 1000); // UTC + 3

        const hours = kenyaTime.getHours().toString().padStart(2, '0');
        const minutes = kenyaTime.getMinutes().toString().padStart(2, '0');
        const currentTime = `${hours}:${minutes}`;

        const caption = `
❄️ *FROST-XMD GITHUB REPO*  
${data.description || '_No description provided_'}

🔗 *Deploy Here:*  
*https://t.me/@caseybase_bot*

⭐ *Stars:* ${data.stargazers_count}  
🍴 *Forks:* ${data.forks_count}
👀 *Watchers:* ${data.watchers_count}
📝 *Language:* ${data.language}

🕒 *Time:* ${currentTime} 

> 🚀 𝙲𝙾𝙳𝙴𝙳 𝙱𝚈 𝙲𝙰𝚂𝙴𝚈𝚁𝙷𝙾𝙳𝙴𝚂 𝚃𝙴𝙲𝙷
        `.trim();

        await trashcore.sendMessage(m.chat, { 
            text: caption,
            contextInfo: {
                mentionedJid: [m.sender],
                externalAdReply: {
                    showAdAttribution: true,
                    renderLargerThumbnail: false,
                    title: `FROST-XMD REPOSITORY`,
                    body: `GitHub Source Code`,
                    thumbnail: { url: 'https://files.catbox.moe/d77o4e.jpg' },
                    sourceUrl: "https://github.com/Caseyrhodes001/FROST-XMD",
                    mediaUrl: null,
                }
            }
        }, { quoted: m });
    } catch (error) {
        console.error('Error fetching repo:', error);
        m.reply('❌ Failed to fetch repository information.');
    }
}
break;

case "owner": {
    try {
        console.log('📥 Owner command triggered');

        const newsletterJid = '120363420261263259@newsletter';
        const newsletterName = 'FROST ❄️';
        const profilePictureUrl = 'https://files.catbox.moe/d77o4e.jpg';

        const captionText = `
╭───〔 👑 *BOT OWNER* 〕───⬣
┃ 👤 *Name:* Caseyrhodes Tech 
┃ 📞 *Contact:* wa.me/254112192119
┃ 🌐 *GitHub:* https://github.com/caseyweb
╰──────────────⬣`.trim();

        // Send image with owner info
        await trashcore.sendMessage(
            m.chat,
            {
                image: { url: profilePictureUrl },
                caption: captionText,
                contextInfo: {
                    forwardingScore: 999,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterName,
                        newsletterJid,
                    },
                },
            },
            { quoted: m }
        );

        // Send audio if available
        try {
            await trashcore.sendMessage(
                m.chat,
                {
                    audio: { url: 'https://files.catbox.moe/53phs2.mp3' }, // Replace with your audio URL
                    mimetype: 'audio/mp4',
                    ptt: false,
                },
                { quoted: m }
            );
        } catch (audioError) {
            console.warn('⚠️ Audio file not available:', audioError.message);
        }

        // Add reaction
        await trashcore.sendMessage(m.chat, {
            react: {
                text: '👑',
                key: m.key,
            }
        });

    } catch (err) {
        console.error('❌ Error in owner command:', err);
        reply('❌ *Could not send owner info. Try again later.*');
        
        await trashcore.sendMessage(m.chat, {
            react: {
                text: '❌',
                key: m.key,
            }
        });
    }
}
break;

// ================== TEXT EFFECT COMMANDS ==================
case 'metallic': {
    if (!text) return m.reply(`🎨 *Usage:* ${prefix}metallic YourText\n*Example:* ${prefix}metallic FROST`);
    try {
        await trashcore.sendMessage(m.chat, { react: { text: "⏳", key: m.key } });
        
        let result = await mumaker.ephoto("https://en.ephoto360.com/impressive-decorative-3d-metal-text-effect-798.html", text);
        await m.reply("✨ *Creating metallic text effect...*");
        
        await trashcore.sendMessage(m.chat, {
            image: { url: result.image },
            caption: `🔩 *Metallic Text Effect*\n\n🛠️ Generated by FROST-XMD`
        }, { quoted: m });
        
        await trashcore.sendMessage(m.chat, { react: { text: "✅", key: m.key } });
    } catch (error) {
        await trashcore.sendMessage(m.chat, { react: { text: "❌", key: m.key } });
        m.reply(`❌ Failed to create metallic effect: ${error.message}`);
    }
}
break;

case 'ice': {
    if (!text) return m.reply(`❄️ *Usage:* ${prefix}ice YourText\n*Example:* ${prefix}ice FROST`);
    try {
        await trashcore.sendMessage(m.chat, { react: { text: "⏳", key: m.key } });
        
        let result = await mumaker.ephoto("https://en.ephoto360.com/ice-text-effect-online-101.html", text);
        await m.reply("🧊 *Creating ice text effect...*");
        
        await trashcore.sendMessage(m.chat, {
            image: { url: result.image },
            caption: `❄️ *Ice Text Effect*\n\n🛠️ Generated by FROST-XMD`
        }, { quoted: m });
        
        await trashcore.sendMessage(m.chat, { react: { text: "✅", key: m.key } });
    } catch (error) {
        await trashcore.sendMessage(m.chat, { react: { text: "❌", key: m.key } });
        m.reply(`❌ Failed to create ice effect: ${error.message}`);
    }
}
break;

case 'snow': {
    if (!text) return m.reply(`🌨️ *Usage:* ${prefix}snow YourText\n*Example:* ${prefix}snow FROST`);
    try {
        await trashcore.sendMessage(m.chat, { react: { text: "⏳", key: m.key } });
        
        let result = await mumaker.ephoto("https://en.ephoto360.com/create-a-snow-3d-text-effect-free-online-621.html", text);
        await m.reply("🌨️ *Creating snow text effect...*");
        
        await trashcore.sendMessage(m.chat, {
            image: { url: result.image },
            caption: `🌨️ *Snow Text Effect*\n\n🛠️ Generated by FROST-XMD`
        }, { quoted: m });
        
        await trashcore.sendMessage(m.chat, { react: { text: "✅", key: m.key } });
    } catch (error) {
        await trashcore.sendMessage(m.chat, { react: { text: "❌", key: m.key } });
        m.reply(`❌ Failed to create snow effect: ${error.message}`);
    }
}
break;

case 'impressive': {
    if (!text) return m.reply(`🎨 *Usage:* ${prefix}impressive YourText\n*Example:* ${prefix}impressive FROST`);
    try {
        await trashcore.sendMessage(m.chat, { react: { text: "⏳", key: m.key } });
        
        let result = await mumaker.ephoto("https://en.ephoto360.com/create-3d-colorful-paint-text-effect-online-801.html", text);
        await m.reply("🖌️ *Creating impressive text effect...*");
        
        await trashcore.sendMessage(m.chat, {
            image: { url: result.image },
            caption: `🎨 *Impressive Text Effect*\n\n🛠️ Generated by FROST-XMD`
        }, { quoted: m });
        
        await trashcore.sendMessage(m.chat, { react: { text: "✅", key: m.key } });
    } catch (error) {
        await trashcore.sendMessage(m.chat, { react: { text: "❌", key: m.key } });
        m.reply(`❌ Failed to create impressive effect: ${error.message}`);
    }
}
break;

case 'noel': {
    if (!text) return m.reply(`🎄 *Usage:* ${prefix}noel YourText\n*Example:* ${prefix}noel FROST`);
    try {
        await trashcore.sendMessage(m.chat, { react: { text: "⏳", key: m.key } });
        
        let result = await mumaker.ephoto("https://en.ephoto360.com/noel-text-effect-online-99.html", text);
        await m.reply("🎄 *Creating Christmas text effect...*");
        
        await trashcore.sendMessage(m.chat, {
            image: { url: result.image },
            caption: `🎄 *Christmas Text Effect*\n\n🛠️ Generated by FROST-XMD`
        }, { quoted: m });
        
        await trashcore.sendMessage(m.chat, { react: { text: "✅", key: m.key } });
    } catch (error) {
        await trashcore.sendMessage(m.chat, { react: { text: "❌", key: m.key } });
        m.reply(`❌ Failed to create Christmas effect: ${error.message}`);
    }
}
break;

case 'water': {
    if (!text) return m.reply(`💧 *Usage:* ${prefix}water YourText\n*Example:* ${prefix}water FROST`);
    try {
        await trashcore.sendMessage(m.chat, { react: { text: "⏳", key: m.key } });
        
        let result = await mumaker.ephoto("https://en.ephoto360.com/create-water-effect-text-online-295.html", text);
        await m.reply("💧 *Creating water text effect...*");
        
        await trashcore.sendMessage(m.chat, {
            image: { url: result.image },
            caption: `💧 *Water Text Effect*\n\n🛠️ Generated by FROST-XMD`
        }, { quoted: m });
        
        await trashcore.sendMessage(m.chat, { react: { text: "✅", key: m.key } });
    } catch (error) {
        await trashcore.sendMessage(m.chat, { react: { text: "❌", key: m.key } });
        m.reply(`❌ Failed to create water effect: ${error.message}`);
    }
}
break;

case 'matrix': {
    if (!text) return m.reply(`💚 *Usage:* ${prefix}matrix YourText\n*Example:* ${prefix}matrix FROST`);
    try {
        await trashcore.sendMessage(m.chat, { react: { text: "⏳", key: m.key } });
        
        let result = await mumaker.ephoto("https://en.ephoto360.com/matrix-text-effect-154.html", text);
        await m.reply("💚 *Creating matrix text effect...*");
        
        await trashcore.sendMessage(m.chat, {
            image: { url: result.image },
            caption: `💚 *Matrix Text Effect*\n\n🛠️ Generated by FROST-XMD`
        }, { quoted: m });
        
        await trashcore.sendMessage(m.chat, { react: { text: "✅", key: m.key } });
    } catch (error) {
        await trashcore.sendMessage(m.chat, { react: { text: "❌", key: m.key } });
        m.reply(`❌ Failed to create matrix effect: ${error.message}`);
    }
}
break;

case 'light': {
    if (!text) return m.reply(`💡 *Usage:* ${prefix}light YourText\n*Example:* ${prefix}light FROST`);
    try {
        await trashcore.sendMessage(m.chat, { react: { text: "⏳", key: m.key } });
        
        let result = await mumaker.ephoto("https://en.ephoto360.com/light-text-effect-futuristic-technology-style-648.html", text);
        await m.reply("💡 *Creating light text effect...*");
        
        await trashcore.sendMessage(m.chat, {
            image: { url: result.image },
            caption: `💡 *Light Text Effect*\n\n🛠️ Generated by FROST-XMD`
        }, { quoted: m });
        
        await trashcore.sendMessage(m.chat, { react: { text: "✅", key: m.key } });
    } catch (error) {
        await trashcore.sendMessage(m.chat, { react: { text: "❌", key: m.key } });
        m.reply(`❌ Failed to create light effect: ${error.message}`);
    }
}
break;

case 'neon': {
    if (!text) return m.reply(`🌈 *Usage:* ${prefix}neon YourText\n*Example:* ${prefix}neon FROST`);
    try {
        await trashcore.sendMessage(m.chat, { react: { text: "⏳", key: m.key } });
        
        let result = await mumaker.ephoto("https://en.ephoto360.com/create-colorful-neon-light-text-effects-online-797.html", text);
        await m.reply("🌈 *Creating neon text effect...*");
        
        await trashcore.sendMessage(m.chat, {
            image: { url: result.image },
            caption: `🌈 *Neon Text Effect*\n\n🛠️ Generated by FROST-XMD`
        }, { quoted: m });
        
        await trashcore.sendMessage(m.chat, { react: { text: "✅", key: m.key } });
    } catch (error) {
        await trashcore.sendMessage(m.chat, { react: { text: "❌", key: m.key } });
        m.reply(`❌ Failed to create neon effect: ${error.message}`);
    }
}
break;

case 'silver': 
case 'silva': {
    if (!text) return m.reply(`⚪ *Usage:* ${prefix}silver YourText\n*Example:* ${prefix}silver FROST`);
    try {
        await trashcore.sendMessage(m.chat, { react: { text: "⏳", key: m.key } });
        
        let result = await mumaker.ephoto("https://en.ephoto360.com/create-glossy-silver-3d-text-effect-online-802.html", text);
        await m.reply("⚪ *Creating silver text effect...*");
        
        await trashcore.sendMessage(m.chat, {
            image: { url: result.image },
            caption: `⚪ *Silver Text Effect*\n\n🛠️ Generated by FROST-XMD`
        }, { quoted: m });
        
        await trashcore.sendMessage(m.chat, { react: { text: "✅", key: m.key } });
    } catch (error) {
        await trashcore.sendMessage(m.chat, { react: { text: "❌", key: m.key } });
        m.reply(`❌ Failed to create silver effect: ${error.message}`);
    }
}
break;

case 'devil': {
    if (!text) return m.reply(`😈 *Usage:* ${prefix}devil YourText\n*Example:* ${prefix}devil FROST`);
    try {
        await trashcore.sendMessage(m.chat, { react: { text: "⏳", key: m.key } });
        
        let result = await mumaker.ephoto("https://en.ephoto360.com/neon-devil-wings-text-effect-online-683.html", text);
        await m.reply("😈 *Creating devil text effect...*");
        
        await trashcore.sendMessage(m.chat, {
            image: { url: result.image },
            caption: `😈 *Devil Text Effect*\n\n🛠️ Generated by FROST-XMD`
        }, { quoted: m });
        
        await trashcore.sendMessage(m.chat, { react: { text: "✅", key: m.key } });
    } catch (error) {
        await trashcore.sendMessage(m.chat, { react: { text: "❌", key: m.key } });
        m.reply(`❌ Failed to create devil effect: ${error.message}`);
    }
}
break;

case 'typography': {
    if (!text) return m.reply(`🆎 *Usage:* ${prefix}typography YourText\n*Example:* ${prefix}typography FROST`);
    try {
        await trashcore.sendMessage(m.chat, { react: { text: "⏳", key: m.key } });
        
        let result = await mumaker.ephoto("https://en.ephoto360.com/create-typography-text-effect-on-pavement-online-774.html", text);
        await m.reply("🆎 *Creating typography effect...*");
        
        await trashcore.sendMessage(m.chat, {
            image: { url: result.image },
            caption: `🆎 *Typography Text Effect*\n\n🛠️ Generated by FROST-XMD`
        }, { quoted: m });
        
        await trashcore.sendMessage(m.chat, { react: { text: "✅", key: m.key } });
    } catch (error) {
        await trashcore.sendMessage(m.chat, { react: { text: "❌", key: m.key } });
        m.reply(`❌ Failed to create typography effect: ${error.message}`);
    }
}
break;

case 'purple': {
    if (!text) return m.reply(`💜 *Usage:* ${prefix}purple YourText\n*Example:* ${prefix}purple FROST`);
    try {
        await trashcore.sendMessage(m.chat, { react: { text: "⏳", key: m.key } });
        
        let result = await mumaker.ephoto("https://en.ephoto360.com/purple-text-effect-online-100.html", text);
        await m.reply("💜 *Creating purple text effect...*");
        
        await trashcore.sendMessage(m.chat, {
            image: { url: result.image },
            caption: `💜 *Purple Text Effect*\n\n🛠️ Generated by FROST-XMD`
        }, { quoted: m });
        
        await trashcore.sendMessage(m.chat, { react: { text: "✅", key: m.key } });
    } catch (error) {
        await trashcore.sendMessage(m.chat, { react: { text: "❌", key: m.key } });
        m.reply(`❌ Failed to create purple effect: ${error.message}`);
    }
}
break;

case 'thunder': {
    if (!text) return m.reply(`⚡ *Usage:* ${prefix}thunder YourText\n*Example:* ${prefix}thunder FROST`);
    try {
        await trashcore.sendMessage(m.chat, { react: { text: "⏳", key: m.key } });
        
        let result = await mumaker.ephoto("https://en.ephoto360.com/thunder-text-effect-online-97.html", text);
        await m.reply("⚡ *Creating thunder text effect...*");
        
        await trashcore.sendMessage(m.chat, {
            image: { url: result.image },
            caption: `⚡ *Thunder Text Effect*\n\n🛠️ Generated by FROST-XMD`
        }, { quoted: m });
        
        await trashcore.sendMessage(m.chat, { react: { text: "✅", key: m.key } });
    } catch (error) {
        await trashcore.sendMessage(m.chat, { react: { text: "❌", key: m.key } });
        m.reply(`❌ Failed to create thunder effect: ${error.message}`);
    }
}
break;

case 'leaves': {
    if (!text) return m.reply(`🍃 *Usage:* ${prefix}leaves YourText\n*Example:* ${prefix}leaves FROST`);
    try {
        await trashcore.sendMessage(m.chat, { react: { text: "⏳", key: m.key } });
        
        let result = await mumaker.ephoto("https://en.ephoto360.com/green-brush-text-effect-typography-maker-online-153.html", text);
        await m.reply("🍃 *Creating leaves text effect...*");
        
        await trashcore.sendMessage(m.chat, {
            image: { url: result.image },
            caption: `🍃 *Leaves Text Effect*\n\n🛠️ Generated by FROST-XMD`
        }, { quoted: m });
        
        await trashcore.sendMessage(m.chat, { react: { text: "✅", key: m.key } });
    } catch (error) {
        await trashcore.sendMessage(m.chat, { react: { text: "❌", key: m.key } });
        m.reply(`❌ Failed to create leaves effect: ${error.message}`);
    }
}
break;

case '1917': {
    if (!text) return m.reply(`🎭 *Usage:* ${prefix}1917 YourText\n*Example:* ${prefix}1917 FROST`);
    try {
        await trashcore.sendMessage(m.chat, { react: { text: "⏳", key: m.key } });
        
        let result = await mumaker.ephoto("https://en.ephoto360.com/1917-style-text-effect-523.html", text);
        await m.reply("🎭 *Creating 1917 style effect...*");
        
        await trashcore.sendMessage(m.chat, {
            image: { url: result.image },
            caption: `🎭 *1917 Style Text Effect*\n\n🛠️ Generated by FROST-XMD`
        }, { quoted: m });
        
        await trashcore.sendMessage(m.chat, { react: { text: "✅", key: m.key } });
    } catch (error) {
        await trashcore.sendMessage(m.chat, { react: { text: "❌", key: m.key } });
        m.reply(`❌ Failed to create 1917 effect: ${error.message}`);
    }
}
break;

case 'arena': {
    if (!text) return m.reply(`🎮 *Usage:* ${prefix}arena YourText\n*Example:* ${prefix}arena FROST`);
    try {
        await trashcore.sendMessage(m.chat, { react: { text: "⏳", key: m.key } });
        
        let result = await mumaker.ephoto("https://en.ephoto360.com/create-cover-arena-of-valor-by-mastering-360.html", text);
        await m.reply("🎮 *Creating arena text effect...*");
        
        await trashcore.sendMessage(m.chat, {
            image: { url: result.image },
            caption: `🎮 *Arena Text Effect*\n\n🛠️ Generated by FROST-XMD`
        }, { quoted: m });
        
        await trashcore.sendMessage(m.chat, { react: { text: "✅", key: m.key } });
    } catch (error) {
        await trashcore.sendMessage(m.chat, { react: { text: "❌", key: m.key } });
        m.reply(`❌ Failed to create arena effect: ${error.message}`);
    }
}
break;

case 'hacker': {
    if (!text) return m.reply(`💻 *Usage:* ${prefix}hacker YourText\n*Example:* ${prefix}hacker FROST`);
    try {
        await trashcore.sendMessage(m.chat, { react: { text: "⏳", key: m.key } });
        
        let result = await mumaker.ephoto("https://en.ephoto360.com/create-anonymous-hacker-avatars-cyan-neon-677.html", text);
        await m.reply("💻 *Creating hacker text effect...*");
        
        await trashcore.sendMessage(m.chat, {
            image: { url: result.image },
            caption: `💻 *Hacker Text Effect*\n\n🛠️ Generated by FROST-XMD`
        }, { quoted: m });
        
        await trashcore.sendMessage(m.chat, { react: { text: "✅", key: m.key } });
    } catch (error) {
        await trashcore.sendMessage(m.chat, { react: { text: "❌", key: m.key } });
        m.reply(`❌ Failed to create hacker effect: ${error.message}`);
    }
}
break;

case 'sand': {
    if (!text) return m.reply(`🏖️ *Usage:* ${prefix}sand YourText\n*Example:* ${prefix}sand FROST`);
    try {
        await trashcore.sendMessage(m.chat, { react: { text: "⏳", key: m.key } });
        
        let result = await mumaker.ephoto("https://en.ephoto360.com/write-names-and-messages-on-the-sand-online-582.html", text);
        await m.reply("🏖️ *Creating sand text effect...*");
        
        await trashcore.sendMessage(m.chat, {
            image: { url: result.image },
            caption: `🏖️ *Sand Text Effect*\n\n🛠️ Generated by FROST-XMD`
        }, { quoted: m });
        
        await trashcore.sendMessage(m.chat, { react: { text: "✅", key: m.key } });
    } catch (error) {
        await trashcore.sendMessage(m.chat, { react: { text: "❌", key: m.key } });
        m.reply(`❌ Failed to create sand effect: ${error.message}`);
    }
}
break;

case 'dragonball': {
    if (!text) return m.reply(`🐉 *Usage:* ${prefix}dragonball YourText\n*Example:* ${prefix}dragonball FROST`);
    try {
        await trashcore.sendMessage(m.chat, { react: { text: "⏳", key: m.key } });
        
        let result = await mumaker.ephoto("https://en.ephoto360.com/create-dragon-ball-style-text-effects-online-809.html", text);
        await m.reply("🐉 *Creating Dragon Ball text effect...*");
        
        await trashcore.sendMessage(m.chat, {
            image: { url: result.image },
            caption: `🐉 *Dragon Ball Text Effect*\n\n🛠️ Generated by FROST-XMD`
        }, { quoted: m });
        
        await trashcore.sendMessage(m.chat, { react: { text: "✅", key: m.key } });
    } catch (error) {
        await trashcore.sendMessage(m.chat, { react: { text: "❌", key: m.key } });
        m.reply(`❌ Failed to create Dragon Ball effect: ${error.message}`);
    }
}
break;

case 'naruto': {
    if (!text) return m.reply(`🌀 *Usage:* ${prefix}naruto YourText\n*Example:* ${prefix}naruto FROST`);
    try {
        await trashcore.sendMessage(m.chat, { react: { text: "⏳", key: m.key } });
        
        let result = await mumaker.ephoto("https://en.ephoto360.com/naruto-shippuden-logo-style-text-effect-online-808.html", text);
        await m.reply("🌀 *Creating Naruto text effect...*");
        
        await trashcore.sendMessage(m.chat, {
            image: { url: result.image },
            caption: `🌀 *Naruto Text Effect*\n\n🛠️ Generated by FROST-XMD`
        }, { quoted: m });
        
        await trashcore.sendMessage(m.chat, { react: { text: "✅", key: m.key } });
    } catch (error) {
        await trashcore.sendMessage(m.chat, { react: { text: "❌", key: m.key } });
        m.reply(`❌ Failed to create Naruto effect: ${error.message}`);
    }
}
break;

case 'graffiti': {
    if (!text) return m.reply(`🎨 *Usage:* ${prefix}graffiti YourText\n*Example:* ${prefix}graffiti FROST`);
    try {
        await trashcore.sendMessage(m.chat, { react: { text: "⏳", key: m.key } });
        
        let result = await mumaker.ephoto("https://en.ephoto360.com/create-a-cartoon-style-graffiti-text-effect-online-668.html", text);
        await m.reply("🎨 *Creating graffiti text effect...*");
        
        await trashcore.sendMessage(m.chat, {
            image: { url: result.image },
            caption: `🎨 *Graffiti Text Effect*\n\n🛠️ Generated by FROST-XMD`
        }, { quoted: m });
        
        await trashcore.sendMessage(m.chat, { react: { text: "✅", key: m.key } });
    } catch (error) {
        await trashcore.sendMessage(m.chat, { react: { text: "❌", key: m.key } });
        m.reply(`❌ Failed to create graffiti effect: ${error.message}`);
    }
}
break;

case 'cat': {
    if (!text) return m.reply(`🐱 *Usage:* ${prefix}cat YourText\n*Example:* ${prefix}cat FROST`);
    try {
        await trashcore.sendMessage(m.chat, { react: { text: "⏳", key: m.key } });
        
        let result = await mumaker.ephoto("https://en.ephoto360.com/handwritten-text-on-foggy-glass-online-680.html", text);
        await m.reply("🐱 *Creating cat text effect...*");
        
        await trashcore.sendMessage(m.chat, {
            image: { url: result.image },
            caption: `🐱 *Cat Text Effect*\n\n🛠️ Generated by FROST-XMD`
        }, { quoted: m });
        
        await trashcore.sendMessage(m.chat, { react: { text: "✅", key: m.key } });
    } catch (error) {
        await trashcore.sendMessage(m.chat, { react: { text: "❌", key: m.key } });
        m.reply(`❌ Failed to create cat effect: ${error.message}`);
    }
}
break;

case 'gold': {
    if (!text) return m.reply(`💰 *Usage:* ${prefix}gold YourText\n*Example:* ${prefix}gold FROST`);
    try {
        await trashcore.sendMessage(m.chat, { react: { text: "⏳", key: m.key } });
        
        let result = await mumaker.ephoto("https://en.ephoto360.com/modern-gold-4-213.html", text);
        await m.reply("💰 *Creating gold text effect...*");
        
        await trashcore.sendMessage(m.chat, {
            image: { url: result.image },
            caption: `💰 *Gold Text Effect*\n\n🛠️ Generated by FROST-XMD`
        }, { quoted: m });
        
        await trashcore.sendMessage(m.chat, { react: { text: "✅", key: m.key } });
    } catch (error) {
        await trashcore.sendMessage(m.chat, { react: { text: "❌", key: m.key } });
        m.reply(`❌ Failed to create gold effect: ${error.message}`);
    }
}
break;

case 'child': {
    if (!text) return m.reply(`👶 *Usage:* ${prefix}child YourText\n*Example:* ${prefix}child FROST`);
    try {
        await trashcore.sendMessage(m.chat, { react: { text: "⏳", key: m.key } });
        
        let result = await mumaker.ephoto("https://en.ephoto360.com/write-text-on-wet-glass-online-589.html", text);
        await m.reply("👶 *Creating child text effect...*");
        
        await trashcore.sendMessage(m.chat, {
            image: { url: result.image },
            caption: `👶 *Child Text Effect*\n\n🛠️ Generated by FROST-XMD`
        }, { quoted: m });
        
        await trashcore.sendMessage(m.chat, { react: { text: "✅", key: m.key } });
    } catch (error) {
        await trashcore.sendMessage(m.chat, { react: { text: "❌", key: m.key } });
        m.reply(`❌ Failed to create child effect: ${error.message}`);
    }
}
break;

case "vcf": 
case "group-vcf": {
    if (!m.isGroup) return m.reply("❌ This command can only be used in groups.");

    const fs = require("fs");
    let gcdata = await trashcore.groupMetadata(m.chat)
    let gcmem = participants.map(a => a.id)

    let vcard = ''
    let noPort = 0

    for (let a of gcdata.participants) {
        vcard += `BEGIN:VCARD\nVERSION:3.0\nFN:[${noPort++}] +${a.id.split("@")[0]}\nTEL;type=CELL;type=VOICE;waid=${a.id.split("@")[0]}:+${a.id.split("@")[0]}\nEND:VCARD\n`
    }

    let cont = './contacts.vcf'

    await m.reply('⏳ 𝗔 𝗺𝗼𝗺𝗲𝗻𝘁, 𝗙𝗿𝗼𝘀𝘁 𝗶𝘀 𝗖𝗼𝗺𝗽𝗶𝗹𝗶𝗻𝗴 '+gcdata.participants.length+' 𝗖𝗼𝗻𝘁𝗮𝗰𝘁𝘀 𝗶𝗻𝘁𝗼 𝗮 𝗩𝗰𝗳...');
    await fs.writeFileSync(cont, vcard.trim())
    await trashcore.sendMessage(m.chat, {
        document: fs.readFileSync(cont), 
        mimetype: 'text/vcard', 
        fileName: 'Group contacts.vcf', 
        caption: '📇 VCF for '+gcdata.subject+'\n👥 '+gcdata.participants.length+' contacts\n\n📱 Generated by FROST-XMD'
    }, {quoted: m})
    fs.unlinkSync(cont)
}
break;

//fech cosa 
case "tiktok": 
case "tikdl": {
    if (!text) {
        return m.reply('Please provide a TikTok video link.');
    }
    
    if (!text.includes("tiktok.com")) {
        return m.reply("That is not a TikTok link.");
    }
    
    await trashcore.sendMessage(m.chat, {
        react: { text: '✅️', key: m.key }
    });

    try {
        const response = await axios.get(`https://api.bk9.dev/download/tiktok?url=${encodeURIComponent(text)}`);

        if (response.data.status && response.data.BK9) {
            const videoUrl = response.data.BK9.BK9;
            const description = response.data.BK9.desc;
            const commentCount = response.data.BK9.comment_count;
            const likesCount = response.data.BK9.likes_count;
            const uid = response.data.BK9.uid;
            const nickname = response.data.BK9.nickname;
            const musicTitle = response.data.BK9.music_info.title;

            await trashcore.sendMessage(m.chat, {
                text: `Data fetched successfully✅ wait a moment. . .`,
            }, { quoted: m });

            await trashcore.sendMessage(m.chat, {
                video: { url: videoUrl },
                caption: "𝙳𝙾𝚆𝙽𝙻𝙾𝙰𝙳𝙴𝙳  𝙱𝚈 𝙵𝚁𝙾𝚂𝚃-𝚇𝙼𝙳",
                gifPlayback: false
            }, { quoted: m });

        } else {
            reply('Failed to retrieve video from the provided link.');
        }

    } catch (e) {
        reply(`An error occurred during download: ${e.message}`);
    }
}
break;
//case apk 
case "apk":
case "app": {
    if (!text) return reply("Where is the app name?");
    
    try {
        let kyuu = await fetchJson(`https://bk9.fun/search/apk?q=${text}`);
        let tylor = await fetchJson(`https://bk9.fun/download/apk?id=${kyuu.BK9[0].id}`);
        
        await trashcore.sendMessage(
            m.chat,
            {
                document: { url: tylor.BK9.dllink },
                fileName: tylor.BK9.name,
                mimetype: "application/vnd.android.package-archive",
                contextInfo: {
                    externalAdReply: {
                        title: `FROST-XMD`,
                        body: `${tylor.BK9.name}`,
                        thumbnailUrl: `${tylor.BK9.icon}`,
                        sourceUrl: `${tylor.BK9.dllink}`,
                        mediaType: 2,
                        showAdAttribution: true,
                        renderLargerThumbnail: false
                    }
                }
            }, { quoted: m }
        );
    } catch (error) {
        console.error('Error in apk command:', error);
        reply('❌ Failed to fetch APK. Please try again with a different app name.');
    }
}
break;
//case vv 
case "vv":
case "vv2":
case "vv3": {
    if (!m.quoted) {
        return m.reply('🔓 *View Once Unlocker*\nPlease reply to a view once message to recover it.');
    }

    // Extract ViewOnce
    let msg = m.quoted.message;
    if (msg.viewOnceMessageV2) msg = msg.viewOnceMessageV2.message;
    else if (msg.viewOnceMessage) msg = msg.viewOnceMessage.message;

    if (!msg) {
        return m.reply('❌ *Invalid Media*\nThis is not a view once message.');
    }

    // Permission Checks
    const isOwner = m.sender === config.OWNER_NUMBER + '@s.whatsapp.net';
    const isBot = m.sender === trashcore.user.id.split(':')[0] + '@s.whatsapp.net';

    if (['vv2', 'vv3'].includes(m.body.toLowerCase().split(' ')[0].replace(config.PREFIX, '')) && !isOwner && !isBot) {
        return m.reply('🔐 *Owner Only*\nOnly the owner or bot can use this command.');
    }

    if (m.body.toLowerCase().split(' ')[0].replace(config.PREFIX, '') === 'vv' && !isOwner && !isBot) {
        return m.reply('🚫 *Restricted Access*\nOnly the owner or bot can use this command to send media.');
    }

    try {
        const messageType = Object.keys(msg)[0];
        let buffer;
        
        if (messageType === 'audioMessage') {
            buffer = await downloadMediaMessage(m.quoted, 'buffer', {}, { type: 'audio' });
        } else {
            buffer = await downloadMediaMessage(m.quoted, 'buffer');
        }

        if (!buffer) {
            return m.reply('⚠️ *Download Failed*\nFailed to retrieve media from view once message.');
        }

        const mimetype = msg.audioMessage?.mimetype || 'audio/ogg';
        const caption = `🧠 *VIEW ONCE RECOVERY*\n\n📨 *Forwarded by Frost-XMD*\n🔐 *Unlocked media recovered from view once.*\n\n⚡ Frost-XMD - Tech\n━━━━━━━━━━━━━━━`;

        // Recipient logic
        let recipient;
        const command = m.body.toLowerCase().split(' ')[0].replace(config.PREFIX, '');
        
        if (command === 'vv') {
            recipient = m.chat;
        } else if (command === 'vv2') {
            recipient = trashcore.user.id.split(':')[0] + '@s.whatsapp.net';
        } else if (command === 'vv3') {
            recipient = config.OWNER_NUMBER + '@s.whatsapp.net';
        }

        // Forward Style Context
        const forwardContext = {
            forwardingScore: 5,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterName: 'Frost-XMD',
                newsletterJid: '120363420342566562@newsletter'
            }
        };

        // Send media based on type
        if (messageType === 'imageMessage') {
            await trashcore.sendMessage(recipient, {
                image: buffer,
                caption: caption,
                contextInfo: forwardContext
            }, { quoted: m });
        } else if (messageType === 'videoMessage') {
            await trashcore.sendMessage(recipient, {
                video: buffer,
                caption: caption,
                mimetype: 'video/mp4',
                contextInfo: forwardContext
            }, { quoted: m });
        } else if (messageType === 'audioMessage') {
            await trashcore.sendMessage(recipient, {
                audio: buffer,
                mimetype: mimetype,
                ptt: true,
                contextInfo: forwardContext
            }, { quoted: m });
        } else {
            return m.reply('⚠️ *Unsupported Media*\nThis media type is not supported for view once recovery.');
        }

    } catch (error) {
        console.error('[VIEW ONCE] Error:', error);
        m.reply('❌ *Processing Failed*\nFailed to process view once message. Please try again.');
    }
}
break;
case "viewonce":
case "vo": {
    if (!m.quoted) {
        return m.reply('🔓 *View Once Unlocker*\nPlease reply to a view once image or video to recover it.');
    }

    try {
        const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
        
        // Extract quoted message
        const quoted = m.quoted.message;
        const quotedImage = quoted?.imageMessage;
        const quotedVideo = quoted?.videoMessage;

        if (quotedImage && quotedImage.viewOnce) {
            // Download and send the image
            const stream = await downloadContentFromMessage(quotedImage, 'image');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }
            
            await trashcore.sendMessage(m.chat, {
                image: buffer,
                fileName: 'recovered-image.jpg',
                caption: `🔓 *VIEW ONCE IMAGE RECOVERED*\n\n📨 *Recovered by Frost-XMD*\n🔐 *Originally sent as view once*\n\n${quotedImage.caption || ''}`
            }, { quoted: m });

        } else if (quotedVideo && quotedVideo.viewOnce) {
            // Download and send the video
            const stream = await downloadContentFromMessage(quotedVideo, 'video');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }
            
            await trashcore.sendMessage(m.chat, {
                video: buffer,
                fileName: 'recovered-video.mp4',
                caption: `🔓 *VIEW ONCE VIDEO RECOVERED*\n\n📨 *Recovered by Frost-XMD*\n🔐 *Originally sent as view once*\n\n${quotedVideo.caption || ''}`
            }, { quoted: m });

        } else {
            return m.reply('❌ *Invalid Media*\nPlease reply to a view once image or video message.\n\nSupported types:\n• View once images\n• View once videos');
        }

    } catch (error) {
        console.error('[VIEW ONCE] Error:', error);
        m.reply('❌ *Recovery Failed*\nFailed to recover the view once media. Please try again.');
    }
}
break;

 case "self": {
    if (!isOwner) return m.reply("you must be the owner first")
    reply("succes change status to self")
    trashcore.public = false
    
    // Send simple text message
    await trashcore.sendMessage(m.chat, { 
        text: `🤖 *Bot Mode Changed to Self*\n\nBot is now in self mode`,
        contextInfo: {
            mentionedJid: [m.sender]
        }
    }, { quoted: m });
}
break;

case "tiktok2":
case "tiktoks":
case "tiks": {
    if (!q) {
        return reply("🌸 What do you want to search on TikTok?\n\n*Usage Example:*\n.tiktok <query>");
    }

    try {
        await reply(`🔎 Searching TikTok for: *${q}*`);
        
        const response = await fetch(`https://api.diioffc.web.id/api/search/tiktok?query=${encodeURIComponent(q)}`);
        const data = await response.json();

        if (!data || !data.status || !data.result || data.result.length === 0) {
            return reply("❌ No results found for your query. Please try with a different keyword.");
        }

        // Get 3 random results (optimal balance)
        const results = data.result.slice(0, 3).sort(() => Math.random() - 0.3);
        let successCount = 0;
        
        for (const video of results) {
            try {
                const message = `🌸 *TikTok Video Result* ${successCount + 1}/${results.length}:\n\n`
                    + `*• Title*: ${video.title || 'No Title'}\n`
                    + `*• Author*: ${video.author?.name || 'Unknown'} (@${video.author?.username || 'unknown'})\n`
                    + `*• Duration*: ${video.duration || 0}s\n`
                    + `*• Plays*: ${video.stats?.play || 0}\n`
                    + `*• Likes*: ${video.stats?.like || 0}\n\n`
                    + `> Powered by CaseyRhodes Tech`;

                if (video.media?.no_watermark) {
                    await trashcore.sendMessage(m.chat, {
                        video: { url: video.media.no_watermark }, 
                        caption: message
                    }, { quoted: m });
                    successCount++;
                    
                    // Add 1.5 second delay between sends
                    if (successCount < results.length) {
                        await new Promise(resolve => setTimeout(resolve, 1500));
                    }
                }
            } catch (videoError) {
                console.error("Error sending video:", videoError);
                continue;
            }
        }

        if (successCount > 0) {
            reply(`✅ Successfully sent ${successCount} TikTok video(s) for "${q}"!`);
        } else {
            reply("❌ Failed to retrieve any videos. The API might be down. Please try again later.");
        }

    } catch (error) {
        console.error("Error in TikTok command:", error);
        reply("❌ An error occurred while searching TikTok. Please try again later.");
    }
}
break;
case "screenshot": 
case "ss": {
    try {
        if (!text) return m.reply("❌ Please provide a website URL to screenshot.\n\n*Example:* .ss https://google.com");
        
        // Add loading reaction
        await trashcore.sendMessage(m.chat, {
            react: { text: "⏳", key: m.key }
        });

        await m.reply("📸 *Taking screenshot...*");

        const imageUrl = `https://image.thum.io/get/fullpage/${encodeURIComponent(text)}`;
        const caption = `📸 *Website Screenshot*\n\n🔗 *URL:* ${text}\n🤖 *Generated by ${botname}*`;

        await trashcore.sendMessage(m.chat, { 
            image: { url: imageUrl }, 
            caption: caption
        }, { quoted: m });

        // Success reaction
        await trashcore.sendMessage(m.chat, {
            react: { text: "✅", key: m.key }
        });

    } catch (error) {
        console.error('Screenshot error:', error);
        
        // Error reaction
        await trashcore.sendMessage(m.chat, {
            react: { text: "❌", key: m.key }
        });
        
        m.reply(`❌ *Failed to take screenshot!*\n\n*Error:* ${error.message}\n\nPlease check:\n• URL is valid (include http:// or https://)\n• Website is accessible\n• Try a different URL`);
    }
}
break;

//case gpp
case 'getpp':
case 'pp':
case 'profilepic': {
    try {
        let targetUser = m.sender;
        
        // Check if user mentioned someone or replied to a message
        if (m.mentionedJid && m.mentionedJid.length > 0) {
            targetUser = m.mentionedJid[0];
        } else if (m.quoted) {
            targetUser = m.quoted.sender;
        }
        
        const ppUrl = await trashcore.profilePictureUrl(targetUser, 'image').catch(() => null);
        
        if (ppUrl) {
            await trashcore.sendMessage(m.chat, {
                image: { url: ppUrl },
                caption: `Profile picture of @${targetUser.split('@')[0]}`,
                mentions: [targetUser],
                buttons: [
                    { buttonId: 'menu', buttonText: { displayText: '📋 Menu' }, type: 1 },
                    { buttonId: 'alive', buttonText: { displayText: '🤖 Status' }, type: 1 }
                ],
                footer: "ᴄᴀsᴇʏʀʜᴏᴅᴇs ᴀɪ"
            }, { quoted: m });
        } else {
            await trashcore.sendMessage(m.chat, {
                text: `@${targetUser.split('@')[0]} doesn't have a profile picture.`,
                mentions: [targetUser],
                buttons: [
                    { buttonId: 'menu', buttonText: { displayText: '📋 Menu' }, type: 1 },
                    { buttonId: 'alive', buttonText: { displayText: '🤖 Status' }, type: 1 }
                ],
                footer: "ᴄᴀsᴇʏʀʜᴏᴅᴇs ᴀɪ"
            }, { quoted: m });
        }
    } catch (error) {
        console.error("Error in profilepic command:", error);
        await trashcore.sendMessage(m.chat, {
            text: "Error fetching profile picture.",
            buttons: [
                { buttonId: 'menu', buttonText: { displayText: '📋 Menu' }, type: 1 }
            ]
        }, { quoted: m });
    }
}
break;

case "public": {
    if (!isOwner) return m.reply("you must be the owner first")
    reply("succes change status to public")
    trashcore.public = true
    
    // Send single message with externalAdReply
    await trashcore.sendMessage(m.chat, { 
        image: { url: 'https://files.catbox.moe/d77o4e.jpg' },
        caption: `🌐 *Bot Mode Changed to Public*\n\nBot is now in public mode. Everyone can use commands.`,
        contextInfo: {
            mentionedJid: [m.sender],
            externalAdReply: {
                showAdAttribution: true,
                renderLargerThumbnail: false,
                title: `FROST-XMD STATUS`,
                body: `Mode: Public | Everyone Access`,
                previewType: "PHOTO",
                thumbnail: { url: 'https://files.catbox.moe/d77o4e.jpg' },
                sourceUrl: null,
                mediaUrl: null,
            }
        }
    }, { quoted: m });
}
break;
                   
        case 'setprefix':
                if (!isOwner) return reply ("you must be an owner first to execute this command")
                if (!text) return reply(`Example : ${prefix + command} desired prefix`)
                global.xprefix = text
                reply(`Prefix successfully changed to ${text}`)
                break                                 
      //     case            mute
                case 'mute':
case 'lock': {
  try {
    const { isAdmin, isBotAdmin, error } = await checkGroupPermissions(m, trashcore);
    if (error) return m.reply(error);
    if (!isAdmin) return m.reply("⛔ Only admins can use this command.");
    if (!isBotAdmin) return m.reply("⚠️ I need to be an admin to perform this action.");

    await trashcore.groupSettingUpdate(m.chat, 'announcement');
    m.reply("🔇 Group has been muted. Only admins can send messages.");
  } catch (error) {
    console.error('Mute error:', error);
    m.reply("⚠️ Failed to mute group.");
  }
}
break;
//group unmute 
case 'unmute':
case 'unlock': {
  try {
    const { isAdmin, isBotAdmin, error } = await checkGroupPermissions(m, trashcore);
    if (error) return m.reply(error);
    if (!isAdmin) return m.reply("⛔ Only admins can use this command.");
    if (!isBotAdmin) return m.reply("⚠️ I need to be an admin to perform this action.");

    await trashcore.groupSettingUpdate(m.chat, 'not_announcement');
    m.reply("🔊 Group has been unmuted. Everyone can now send messages.");
  } catch (error) {
    console.error('Unmute error:', error);
    m.reply("⚠️ Failed to unmute group.");
  }
}
break;

                
            
default:
        }
    } catch (err) {
        console.log(require("util").format(err));
    }
}

let file = require.resolve(__filename)
require('fs').watchFile(file, () => {
  require('fs').unwatchFile(file)
  console.log('\x1b[0;32m'+__filename+' \x1b[1;32mupdated!\x1b[0m')
  delete require.cache[file]
  require(file)
})
