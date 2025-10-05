require('dotenv').config();
const { 
    makeWASocket, 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion, 
    Browsers, 
    makeCacheableSignalKeyStore, 
    DisconnectReason,
    jidDecode,
    makeInMemoryStore,
    downloadContentFromMessage,
    getAggregateVotesInPollMessage,
    proto
} = require("@whiskeysockets/baileys");
const TelegramBot = require('node-telegram-bot-api');
const fs = require("fs");
const path = require("path");
const NodeCache = require('node-cache');
const pino = require('pino');
const moment = require("moment-timezone");
const token = process.env.TELEGRAM_BOT_TOKEN;
let OWNER_ID = process.env.OWNER_ID;

if (!token) {
  console.error('Telegram bot token is not set. Please set the TELEGRAM_BOT_TOKEN environment variable.');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });
const pairingCodes = new NodeCache({ stdTTL: 3600, checkperiod: 600 });
const requestLimits = new NodeCache({ stdTTL: 120, checkperiod: 60 });
let connectedUsers = {};
const connectedUsersFilePath = path.join(__dirname, 'trashscrape', 'connectedUsers.json');

// Ensure directories exist
const trashscrapeDir = path.join(__dirname, 'trashscrape');
const trashBaileysDir = path.join(__dirname, 'trash_baileys');
if (!fs.existsSync(trashscrapeDir)) fs.mkdirSync(trashscrapeDir, { recursive: true });
if (!fs.existsSync(trashBaileysDir)) fs.mkdirSync(trashBaileysDir, { recursive: true });

// Load smsg function safely
let smsg;
try {
    smsg = require("./trashscrape/function").smsg;
} catch (error) {
    console.error('Error loading smsg function:', error);
    smsg = (conn, mek, store) => mek; // Fallback function
}

// Load store safely
let store;
try {
    const createToxxicStore = require('./trashscrape/basestore');
    store = createToxxicStore('./store', {
        logger: pino().child({ level: 'silent', stream: 'store' })
    });
} catch (error) {
    console.error('Error creating store:', error);
    store = makeInMemoryStore({ logger: pino().child({ level: 'silent' }) });
}

// Load connected users from the JSON file
function loadConnectedUsers() {
    try {
        if (fs.existsSync(connectedUsersFilePath)) {
            const data = fs.readFileSync(connectedUsersFilePath, 'utf8');
            connectedUsers = JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading connected users:', error);
        connectedUsers = {};
    }
}

// Save connected users to the JSON file
function saveConnectedUsers() {
    try {
        fs.writeFileSync(connectedUsersFilePath, JSON.stringify(connectedUsers, null, 2));
    } catch (error) {
        console.error('Error saving connected users:', error);
    }
}

let isFirstLog = true;

// Define missing variables and functions
let autobio = 'on';
let autoview = 'on';
let autolike = 'on';
let messageDelay = 1000;
let lastTextTime = 0;

// Helper function
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Mock functions for missing dependencies
async function fetchSettings() {
    return {
        antiedit: 'off',
        anticall: 'off'
    };
}

function Events(client, m) {
    // Event handler placeholder
    console.log('Group participants update:', m);
}

// Store active pairing sessions
const activePairingSessions = new Map();

// Store pairing data with enhanced structure
const pairingData = new Map();

async function startWhatsAppBot(phoneNumber, telegramChatId = null) {
    const sessionPath = path.join(__dirname, 'trash_baileys', `session_${phoneNumber}`);

    // Check if the session directory exists
    if (!fs.existsSync(sessionPath)) {
        console.log(`Session directory for ${phoneNumber} was not found.`);
        return;
    }

    try {
        let { version, isLatest } = await fetchLatestBaileysVersion();
        if (isFirstLog) {
            console.log(`Using Baileys version: ${version} (Latest: ${isLatest})`);
            isFirstLog = false;
        }

        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
        const msgRetryCounterCache = new NodeCache();
        
        const conn = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            browser: Browsers.windows('Firefox'),
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
            },
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: true,
            msgRetryCounterCache,
            defaultQueryTimeoutMs: undefined,
            syncFullHistory: false,
            fireInitQueries: true,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
        });

        store.bind(conn.ev);

        // Bio updater
        if (autobio === 'on') {
            setInterval(() => {
                const date = new Date();
                conn.updateProfileStatus(
                    ` FROST XMD❄️ running🔮📅 𝙳𝙰𝚃𝙴/𝚃𝙸𝙼𝙴 ⌚️  ${date.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' })}  ⏰️ 𝙳𝙰𝚈 ⏰️  ${date.toLocaleString('en-US', { weekday: 'long', timeZone: 'Africa/Nairobi'})}. 𝙵𝚁𝙾𝚂𝚃-𝚇𝙼𝙳 𝚁𝙴𝙿𝚁𝙴𝚂𝙴𝙽𝚃𝚂 𝙲𝙾𝙽𝚂𝚃𝙰𝙽𝙲𝚈 𝙴𝚅𝙴𝙽 𝙸𝙽 𝙲𝙷𝙰𝙾𝚂⚡.`
                );
            }, 10 * 1000);
        }

        store.bind(conn.ev);
  
        conn.ev.on("messages.upsert", async (chatUpdate) => {
            try {
                let mek = chatUpdate.messages[0];
                if (!mek.message) return;
                mek.message = Object.keys(mek.message)[0] === "ephemeralMessage" ? mek.message.ephemeralMessage.message : mek.message;

                if (autoview === 'on' && mek.key && mek.key.remoteJid === "status@broadcast") {
                    conn.readMessages([mek.key]);
                }
                
                if (autoview === 'on' && autolike === 'on' && mek.key && mek.key.remoteJid === "status@broadcast") {
                    const nickk = await conn.decodeJid(conn.user.id);
                    const emojis = ['💙','💚','💜'];
                    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
                    await conn.sendMessage(mek.key.remoteJid, { react: { text: randomEmoji, key: mek.key } }, { statusJidList: [mek.key.participant, nickk] });
                    await sleep(messageDelay);
                    console.log('Reaction sent successfully✅️');
                }

                if (!conn.public && !mek.key.fromMe && chatUpdate.type === "notify") return;
                let m = smsg(conn, mek, store);
                // Load main handler safely
                try {
                    require("./case.js")(conn, m, chatUpdate, store);
                } catch (err) {
                    console.log('Error in main handler:', err);
                }
            } catch (err) {
                console.log('Error in messages.upsert:', err);
            }
        });

        // Add at top with other declarations
        const processedEdits = new Set();
        const EDIT_COOLDOWN = 5000; // 5 seconds cooldown

        conn.ev.on('messages.update', async (messageUpdates) => {
            try {
                const { antiedit: currentAntiedit } = await fetchSettings();
                if (currentAntiedit === 'off') return;

                const now = Date.now();
                
                for (const update of messageUpdates) {
                    const { key, update: updateData } = update;
                    if (!key?.id || !updateData.message) continue;

                    const editId = `${key.id}-${key.remoteJid}`;
                    
                    // Skip if recently processed
                    if (processedEdits.has(editId)) {
                        const [timestamp] = processedEdits.get(editId);
                        if (now - timestamp < EDIT_COOLDOWN) continue;
                    }

                    const chat = key.remoteJid;
                    const isGroup = chat.endsWith('@g.us');
                    const editedMsg = updateData.message.editedMessage?.message || updateData.message.editedMessage;
                    if (!editedMsg) continue;

                    // Get both messages properly
                    const originalMsg = await store.loadMessage(chat, key.id) || {};
                    const sender = key.participant || key.remoteJid;
                    const senderName = await conn.getName(sender);

                    // Enhanced content extractor
                    const getContent = (msg) => {
                        if (!msg) return '[Deleted]';
                        const type = Object.keys(msg)[0];
                        const content = msg[type];
                        
                        switch(type) {
                            case 'conversation': 
                                return content;
                            case 'extendedTextMessage': 
                                return content.text + 
                                      (content.contextInfo?.quotedMessage ? ' (with quoted message)' : '');
                            case 'imageMessage': 
                                return `🖼️ ${content.caption || 'Image'}`;
                            case 'videoMessage': 
                                return `🎥 ${content.caption || 'Video'}`;
                            case 'documentMessage': 
                                return `📄 ${content.fileName || 'Document'}`;
                            default: 
                                return `[${type.replace('Message', '')}]`;
                        }
                    };

                    const originalContent = getContent(originalMsg.message);
                    const editedContent = getContent(editedMsg);

                    // Only proceed if content actually changed
                    if (originalContent === editedContent) {
                        console.log(`[ANTIEDIT] No content change detected for ${editId}`);
                        continue;
                    }

                    const notificationMessage = `*⚠️📌 FROST-XMD ANTIFIEDIT 📌⚠️*\n\n` +
                                               `👤 *Sender:* @${sender.split('@')[0]}\n` +
                                               `📄 *Original Message:* ${originalContent}\n` +
                                               `✏️ *Edited Message:* ${editedContent}\n` +
                                               `🧾 *Chat Type:* ${isGroup ? 'Group' : 'DM'}`;

                    const sendTo = currentAntiedit === 'private' ? conn.user.id : chat;
                    await conn.sendMessage(sendTo, { 
                        text: notificationMessage,
                        mentions: [sender]
                    });

                    // Update tracking with timestamp
                    processedEdits.set(editId, [now, originalContent, editedContent]);
                    console.log(`[ANTIEDIT] Reported edit from ${senderName}`);
                }

                // Cleanup old entries
                for (const [id, data] of processedEdits) {
                    if (now - data[0] > 60000) { // 1 minute retention
                        processedEdits.delete(id);
                    }
                }
            } catch (err) {
                console.error('[ANTIEDIT ERROR]', err);
            }
        });

        // Handle error
        const unhandledRejections = new Map();
        process.on("unhandledRejection", (reason, promise) => {
            unhandledRejections.set(promise, reason);
            console.log("Unhandled Rejection at:", promise, "reason:", reason);
        });
        process.on("rejectionHandled", (promise) => {
            unhandledRejections.delete(promise);
        });
        process.on("uncaughtException", function (err) {
            console.log("Caught exception: ", err);
        });

        // Setting
        conn.decodeJid = (jid) => {
            if (!jid) return jid;
            if (/:\d+@/gi.test(jid)) {
                let decode = jidDecode(jid) || {};
                return (decode.user && decode.server && decode.user + "@" + decode.server) || jid;
            } else return jid;
        };
        
        conn.ev.on("contacts.update", (update) => {
            for (let contact of update) {
                let id = conn.decodeJid(contact.id);
                if (store && store.contacts) store.contacts[id] = { id, name: contact.notify };
            }
        });
        
        conn.ev.on("group-participants.update", async (m) => {
            Events(conn, m);
        });
        
        conn.ev.on('call', async (callData) => {
            const { anticall: dbAnticall } = await fetchSettings();

            if (dbAnticall === 'off') {
                const callId = callData[0]?.id;
                const callerId = callData[0]?.from;

                if (callId && callerId) {
                    await conn.rejectCall(callId, callerId);
                    const currentTime = Date.now();
                    if (currentTime - lastTextTime >= messageDelay) {
                        await conn.sendMessage(callerId, {
                            text: "🚫 Anticall is active. Only text messages are allowed."
                        });
                        lastTextTime = currentTime;
                    }
                }
            } else {
                console.log("✅ Anticall is OFF. Call ignored.");
            }
        });
        
        // Store the connection for pairing code generation
        activePairingSessions.set(phoneNumber, { conn, telegramChatId });
        
        // Check if session credentials are already saved
        if (state.creds.registered) {
            await saveCreds();
            console.log(`Session credentials reloaded successfully for ${phoneNumber}!`);
            
            // Connection update handler for already registered sessions
            conn.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect } = update;
                
                if (connection === 'open') {
                    await handleSuccessfulConnection(conn, phoneNumber, telegramChatId);
                } else if (connection === 'close') {
                    const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                    console.log(`Connection closed for ${phoneNumber}. Reason: ${lastDisconnect?.error?.output?.statusCode}`);
                    
                    if (shouldReconnect) {
                        console.log(`Attempting to restart ${phoneNumber}...`);
                        setTimeout(() => startWhatsAppBot(phoneNumber, telegramChatId), 5000);
                    } else {
                        console.log(`Session logged out for ${phoneNumber}. Manual reconnection required.`);
                        if (telegramChatId) {
                            bot.sendMessage(telegramChatId, `Session logged out for ${phoneNumber}. Use /pair to reconnect.`);
                        }
                    }
                }
            });
        } else {
            // If not registered, generate a pairing code
            if (telegramChatId) {
                setTimeout(async () => {
                    try {
                        let code = await conn.requestPairingCode(phoneNumber);
                        code = code?.match(/.{1,4}/g)?.join("-") || code;
                        
                        // Store pairing data with enhanced information
                        pairingData.set(phoneNumber, {
                            code: code,
                            phoneNumber: phoneNumber,
                            timestamp: Date.now(),
                            telegramChatId: telegramChatId,
                            status: 'pending'
                        });
                        
                        pairingCodes.set(code, { count: 0, phoneNumber });
                        
                        // Create simplified buttons with only copy code and generate new code
                        const pairCodeButtons = {
                            reply_markup: {
                                inline_keyboard: [
                                    [
                                        {
                                            text: "📋 Copy Pair Code",
                                            callback_data: `copy_code_${code}`
                                        }
                                    ],
                                    [
                                        {
                                            text: "🔄 Generate New Code",
                                            callback_data: `regenerate_code_${phoneNumber}`
                                        }
                                    ]
                                ]
                            }
                        };
                        
                        // Create formatted message
                        const pairCodeMessage = `✅ *Pair Code Generated Successfully!*

📱 *Phone Number:* \`${phoneNumber}\`
🔐 *Pair Code:* \`${code}\`

💡 *How to use:*
1. Open WhatsApp on your phone
2. Go to *Linked Devices*
3. Tap *Link a Device*
4. Enter this code: *${code}*

🛠️ *Quick Actions:*`;
                        
                        await bot.sendMessage(telegramChatId, pairCodeMessage, {
                            parse_mode: "Markdown",
                            ...pairCodeButtons
                        });
                        
                        console.log(`Pairing code generated for ${phoneNumber}: ${code}`);
                    } catch (error) {
                        console.error('Error generating pairing code:', error);
                        if (telegramChatId) {
                            await bot.sendMessage(telegramChatId, 
                                `❌ Error generating pairing code for ${phoneNumber}.\n\n` +
                                `Error: ${error.message}\n\n` +
                                `Please try again with /pair ${phoneNumber}`
                            );
                        }
                    }
                }, 3000);
            }
        }
        
        conn.public = true;
        
        conn.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr && telegramChatId) {
                // QR code handling can be added here if needed
            }
            
            if (connection === 'open') {
                await handleSuccessfulConnection(conn, phoneNumber, telegramChatId);
            } else if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log(`Connection closed for ${phoneNumber}. Reason: ${lastDisconnect?.error?.output?.statusCode}`);
                
                if (shouldReconnect) {
                    console.log(`Attempting to restart ${phoneNumber}...`);
                    setTimeout(() => startWhatsAppBot(phoneNumber, telegramChatId), 5000);
                } else {
                    console.log(`Session logged out for ${phoneNumber}. Manual reconnection required.`);
                    if (telegramChatId) {
                        bot.sendMessage(telegramChatId, `Session logged out for ${phoneNumber}. Use /pair to reconnect.`);
                    }
                }
            }
        });

        conn.ev.on('creds.update', saveCreds);
        
        conn.decodeJid = (jid) => {
            if (!jid) return jid;
            if (/:\d+@/gi.test(jid)) {
                let decode = jidDecode(jid) || {};
                return decode.user && decode.server && `${decode.user}@${decode.server}` || jid;
            } else return jid;
        };

        conn.sendText = (jid, text, quoted = '', options) => conn.sendMessage(jid, {
            text: text,
            ...options
        }, {
            quoted,
            ...options
        });
        
        return conn;
    } catch (error) {
        console.error(`Error starting WhatsApp bot for ${phoneNumber}:`, error);
        if (telegramChatId) {
            bot.sendMessage(telegramChatId, `Error starting WhatsApp bot for ${phoneNumber}. Please try again.`);
        }
    }
}

// Handle successful connection
async function handleSuccessfulConnection(conn, phoneNumber, telegramChatId) {
    await conn.ev.creds.update();
    console.log(`Credentials saved successfully for ${phoneNumber}!`);

    // Send success messages to the user on Telegram
    if (telegramChatId) {
        if (!connectedUsers[telegramChatId]) {
            connectedUsers[telegramChatId] = [];
        }
        // Check if phone number is already connected
        const isAlreadyConnected = connectedUsers[telegramChatId].some(user => user.phoneNumber === phoneNumber);
        if (!isAlreadyConnected) {
            connectedUsers[telegramChatId].push({ phoneNumber });
            saveConnectedUsers();
        }
        
        const runtime = process.uptime();
        const hour = Math.floor(runtime / 3600);
        const minute = Math.floor((runtime % 3600) / 60);
        const second = Math.floor(runtime % 60);

        const caption = ` ┏━━『 ★CASEYRHODES-BOTs★ 』━━┓ ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀ 
◈ STATUS : CONNECTED 
◈ USER : ${phoneNumber} 
◈ SOCKET : WHATSAPP 
◈ Dev : Caseyrhodes 
◈ UPTIME : ${hour}h ${minute}m ${second}s 
◈ CREATOR : t.me/Caseyrhodes001
◈ DATE : ${new Date().toLocaleString()} ▄▄▄▄▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀ `;

        const options = {
            caption: caption,
        };

        try {
            await bot.sendPhoto(telegramChatId, 'https://url.bwmxmd.online/Adams.eekmpz78.jpg', options);
        } catch (error) {
            console.error('Error sending photo:', error);
            await bot.sendMessage(telegramChatId, caption);
        }
        
        console.log(`
┏━━『 CASEYRHODES-BoTs★ 』━━┓
▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀
  ◈ STATUS    : CONNECTED
  ◈ USER     : ${phoneNumber}
  ◈ SOCKET     : WHATSAPP
  ◈ Dev     : Caseyrhodes001
▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄`);
    }
}

// Save pairing data to JSON file
function savePairingData() {
    try {
        const pairingDataPath = path.join(__dirname, 'trashscrape', 'pairingData.json');
        const dataToSave = {};
        pairingData.forEach((value, key) => {
            dataToSave[key] = value;
        });
        fs.writeFileSync(pairingDataPath, JSON.stringify(dataToSave, null, 2));
    } catch (error) {
        console.error('Error saving pairing data:', error);
    }
}

// Load pairing data from JSON file
function loadPairingData() {
    try {
        const pairingDataPath = path.join(__dirname, 'trashscrape', 'pairingData.json');
        if (fs.existsSync(pairingDataPath)) {
            const data = fs.readFileSync(pairingDataPath, 'utf8');
            const loadedData = JSON.parse(data);
            pairingData.clear();
            Object.keys(loadedData).forEach(key => {
                pairingData.set(key, loadedData[key]);
            });
        }
    } catch (error) {
        console.error('Error loading pairing data:', error);
    }
}
            
let userIds = [];
//console function 
bot.on('text', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const username = msg.from.username || 'unknown';
  const command = text.split(' ')[0].toLowerCase();
  if (command.startsWith('/')) {
    console.log(`\x1b[32mCommand used: ${command} by @${username} (ID: ${chatId})\x1b[0m`);
  }
});

//function fetch groups 
let groups = [];

bot.on('message', (msg) => {
  if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
    const groupId = msg.chat.id;
    const groupName = msg.chat.title;

    if (!groups.some(group => group.id === groupId)) {
      groups.push({ id: groupId, name: groupName });
    }
  }
});

//load bot users
let users = {};

bot.on('message', (msg) => {
  const userId = msg.from.id;
  if (!users[userId]) {
    users[userId] = msg.from;
  }
});

//load group members 
let groupMembers = {};

bot.on('message', (msg) => {
  if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
    const userId = msg.from.id;
    if (!groupMembers[userId]) {
      groupMembers[userId] = msg.from;
    }
  }
});

///device info
const os = require('os');
const deviceInfo = `📊 Device Information:\n\n` +
                   `💻 Platform: ${os.platform()}\n` +
                   `📈 Architecture: ${os.arch()}\n` +
                   `💾 Total Memory: ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB\n` +
                   `💸 Free Memory: ${(os.freemem() / 1024 / 1024 / 1024).toFixed(2)} GB\n` +
                   `🖥️ CPU Cores: ${os.cpus().length}\n` +
                   `⚡ CPU Model: ${os.cpus()[0].model}`;

// Function to add user ID to the array
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  if (!userIds.includes(chatId)) {
    userIds.push(chatId);
  }
});

// Simplified callback query handler with only copy code and generate new code
bot.on('callback_query', async (callbackQuery) => {
    const msg = callbackQuery;
    const callbackData = msg.data;
    const callbackChatId = msg.message.chat.id;
    const messageId = msg.message.message_id;
    
    try {
        // Handle copy pair code button
        if (callbackData.startsWith('copy_code_')) {
            const pairCode = callbackData.replace('copy_code_', '');
            
            await bot.answerCallbackQuery(msg.id, {
                text: `Code ${pairCode} copied to clipboard!`,
                show_alert: true
            });
            
            await bot.editMessageText(
                `✅ *Code Copied!*\n\n` +
                `🔐 *Pair Code:* \`${pairCode}\`\n\n` +
                `The code has been copied to your clipboard. You can now paste it in WhatsApp.`,
                {
                    chat_id: callbackChatId,
                    message_id: messageId,
                    parse_mode: "Markdown"
                }
            );
        }
        
        // Handle regenerate code
        else if (callbackData.startsWith('regenerate_code_')) {
            const phoneNumber = callbackData.replace('regenerate_code_', '');
            
            await bot.answerCallbackQuery(msg.id, {
                text: `Regenerating code for ${phoneNumber}...`,
                show_alert: false
            });
            
            await bot.sendMessage(callbackChatId, `🔄 Regenerating pairing code for ${phoneNumber}...`);
            
            // Restart the WhatsApp bot to generate new code
            const sessionPath = path.join(__dirname, 'trash_baileys', `session_${phoneNumber}`);
            if (fs.existsSync(sessionPath)) {
                fs.rmSync(sessionPath, { recursive: true, force: true });
            }
            
            // Remove from connected users
            if (connectedUsers[callbackChatId]) {
                connectedUsers[callbackChatId] = connectedUsers[callbackChatId].filter(user => user.phoneNumber !== phoneNumber);
                saveConnectedUsers();
            }
            
            // Remove from pairing data
            pairingData.delete(phoneNumber);
            savePairingData();
            
            // Start new pairing process
            setTimeout(() => {
                startWhatsAppBot(phoneNumber, callbackChatId);
            }, 2000);
        }
        
        // Handle reconnect button
        else if (callbackData.startsWith('reconnect_')) {
            const reconnectPhone = callbackData.replace('reconnect_', '');
            
            await bot.answerCallbackQuery(msg.id, {
                text: `Reconnecting ${reconnectPhone}...`,
                show_alert: false
            });
            
            await bot.sendMessage(callbackChatId, `🔄 Reconnecting ${reconnectPhone}...`);
            startWhatsAppBot(reconnectPhone, callbackChatId);
        }
        
        // Handle delete session button
        else if (callbackData.startsWith('delete_session_')) {
            const deletePhone = callbackData.replace('delete_session_', '');
            
            await bot.answerCallbackQuery(msg.id, {
                text: `Deleting session for ${deletePhone}`,
                show_alert: true
            });
            
            // Add your session deletion logic here
            const sessionToDelete = path.join(__dirname, 'trash_baileys', `session_${deletePhone}`);
            if (fs.existsSync(sessionToDelete)) {
                fs.rmSync(sessionToDelete, { recursive: true });
                await bot.sendMessage(callbackChatId, `🗑️ Session for ${deletePhone} has been deleted.`);
                
                // Remove from connected users
                if (connectedUsers[callbackChatId]) {
                    connectedUsers[callbackChatId] = connectedUsers[callbackChatId].filter(user => user.phoneNumber !== deletePhone);
                    saveConnectedUsers();
                }
                
                // Remove from pairing data
                pairingData.delete(deletePhone);
                savePairingData();
            }
        }
    } catch (error) {
        console.error('Error handling callback query:', error);
        await bot.answerCallbackQuery(msg.id, {
            text: 'Error processing your request',
            show_alert: true
        });
    }
});

// Handle all commands
bot.on('message', async (msg) => {
  const text = msg.text;
  if (!text || !text.startsWith('/')) return;
  
  const chatId = msg.chat.id;
  const command = text.split(' ')[0].toLowerCase();
  
  switch (command) {
    case '/start':
      const opts = {
        reply_markup: {
          inline_keyboard: [
            [{ text: "👨‍💻 Developer", url: "https://t.me/caseyrhodes001" }],
            [{ text: "📢 Channel", url: "https://t.me/caseyrhodestech" }]       
          ]
        }
      };
      try {
        await bot.sendPhoto(msg.chat.id, 'https://files.catbox.moe/brk7xv.jpg', {
          caption: `Hello👋❄️ *${msg.from.first_name}*!\n\n` +
            `(👥) i am a bot created by @caseyrhodes001 to assist you in many ways \n\n` +
            `Commands: \n` +
            `▢/pair \n` +
            `▢/start \n` +
            `▢/uptime \n` +
            `▢/ping \n` +
            `▢/broadcast\n` +
            `▢/promote \n` +
            `▢/demote\n` +
            `▢/getalladmins\n` +
            `▢/getmyid\n` +
            `▢/getmygroups \n` +
            `▢/checkdevice \n` +
            `▢/remove\n` +
            `▢/getdp\n` +
            `▢/getphonenumber \n` +
            `▢/getgroupmembers\n` +
            `▢/botinfo\n` +
            `▢/mute\n` +
            `▢/delpair\n` +
            `▢/listpaired\n\n` +
            `📁Join Group:https://t.me/caseyrhodestech \n\`\`\` 𝐌𝐀𝐃𝐄 𝐁𝐘 𝐂𝐀𝐒𝐄𝐘𝐇𝐎𝐃𝐄𝐒 𝐓𝐄𝐂𝐇🌸\`\`\``,
          parse_mode: "Markdown",
          ...opts
        });
      } catch (error) {
        console.error('Error sending start message:', error);
        await bot.sendMessage(chatId, 'Welcome! Use /help to see available commands.');
      }
      break;

    case '/mypairings':
      if (pairingData.size === 0) {
        await bot.sendMessage(chatId, 'No active pairings found.');
      } else {
        let pairingsList = '📱 *Your Active Pairings:*\n\n';
        pairingData.forEach((data, phoneNumber) => {
          if (data.telegramChatId === chatId) {
            pairingsList += `📞 *Phone:* \`${phoneNumber}\`\n`;
            pairingsList += `🔐 *Code:* \`${data.code}\`\n`;
            pairingsList += `📊 *Status:* ${data.status}\n`;
            pairingsList += `🕐 *Created:* ${new Date(data.timestamp).toLocaleString()}\n`;
            pairingsList += `━━━━━━━━━━━━━━━━━━━━\n\n`;
          }
        });
        
        await bot.sendMessage(chatId, pairingsList, { parse_mode: "Markdown" });
      }
      break;
          
    case '/help':
      const helpMessage = `🤖 *Available Commands:*\n\n` +
                         `🔐 *Pairing Commands:*\n` +
                         `/pair [number] - Connect to WhatsApp\n` +
                         `/delpair [number] - Delete WhatsApp session\n` +
                         `/listpaired - List paired users\n` +
                         `/mypairings - View your active pairings\n\n` +
                         `ℹ️ *Info Commands:*\n` +
                         `/start - Start the bot\n` +
                         `/botinfo - Bot information\n` +
                         `/uptime - Check bot uptime\n` +
                         `/ping - Check bot response time\n\n` +
                         `👥 *Group Commands:*\n` +
                         `/getalladmins - List group admins\n` +
                         `/getmygroups - List bot groups\n` +
                         `/getgroupmembers - List group members\n\n` +
                         `📱 *Utility Commands:*\n` +
                         `/getmyid - Get your Telegram ID\n` +
                         `/getdp - Get profile picture\n` +
                         `/checkdevice - Device information\n` +
                         `/getphonenumber - Share phone number`;
      
      await bot.sendMessage(chatId, helpMessage, { parse_mode: "Markdown" });
      break;

    case '/listpaired':
      if (connectedUsers[chatId] && connectedUsers[chatId].length > 0) {
        let listMessage = '📱 *Your Connected WhatsApp Accounts:*\n\n';
        connectedUsers[chatId].forEach((user, index) => {
          listMessage += `*${index + 1}.* ${user.phoneNumber}\n`;
        });
        await bot.sendMessage(chatId, listMessage, { parse_mode: "Markdown" });
      } else {
        await bot.sendMessage(chatId, 'No WhatsApp accounts are currently connected.');
      }
      break;

    case '/uptime':
      const uptime = process.uptime();
      const hours = Math.floor(uptime / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      const seconds = Math.floor(uptime % 60);
      await bot.sendMessage(chatId, `🕐 Bot Uptime: ${hours}h ${minutes}m ${seconds}s`);
      break;

    case '/ping':
      const start = Date.now();
      const message = await bot.sendMessage(chatId, '🏓 Pinging...');
      const end = Date.now();
      await bot.editMessageText(`🏓 Pong! ${end - start}ms`, {
        chat_id: chatId,
        message_id: message.message_id
      });
      break;

    case '/getmyid':
      await bot.sendMessage(chatId, `🆔 Your Telegram ID: \`${chatId}\``, { parse_mode: "Markdown" });
      break;

    case '/getmygroups':
      if (groups.length === 0) {
        await bot.sendMessage(chatId, 'No groups found.');
      } else {
        let groupsList = '👥 *Bot Groups:*\n\n';
        groups.forEach((group, index) => {
          groupsList += `*${index + 1}.* ${group.name}\n`;
          groupsList += `   ID: \`${group.id}\`\n\n`;
        });
        await bot.sendMessage(chatId, groupsList, { parse_mode: "Markdown" });
      }
      break;

    case '/checkdevice':
      await bot.sendMessage(chatId, deviceInfo);
      break;

    case '/botinfo':
      const botInfo = `🤖 *Bot Information*\n\n` +
                     `📊 Total Users: ${Object.keys(users).length}\n` +
                     `👥 Total Groups: ${groups.length}\n` +
                     `🔄 Active Sessions: ${Object.keys(connectedUsers).reduce((acc, key) => acc + connectedUsers[key].length, 0)}\n` +
                     `💾 Memory Usage: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB\n` +
                     `⚡ Node.js Version: ${process.version}`;
      await bot.sendMessage(chatId, botInfo, { parse_mode: "Markdown" });
      break;

    //Whatsapp connection         
    case '/pair':
      const phoneNumber = msg.text.split(' ')[1];
      if (!phoneNumber) {
        bot.sendMessage(chatId, 'Please provide a phone number to connect. Example: /pair 254xxxx');
        break;
      }
      
      // Validate phone number format
      if (!/^\d+$/.test(phoneNumber)) {
        bot.sendMessage(chatId, 'Please provide a valid phone number containing only digits. Example: /pair 254712345678');
        break;
      }
      
      const sessionPath = path.join(__dirname, 'trash_baileys', `session_${phoneNumber}`);
      if (!fs.existsSync(sessionPath)) {
        fs.mkdirSync(sessionPath, { recursive: true });
        console.log(`Generating pair code for ${phoneNumber} wait......`);
        
        // Send initial message with loading state
        bot.sendMessage(chatId, `🔄 Generating pair code for ${phoneNumber}...`);
        
        startWhatsAppBot(phoneNumber, chatId).catch(err => {
          console.log('Error:', err);
          bot.sendMessage(chatId, 'An error occurred while connecting.');
        });
      } else {
        const isAlreadyConnected = connectedUsers[chatId] && connectedUsers[chatId].some(user => user.phoneNumber === phoneNumber);
        if (isAlreadyConnected) {
          bot.sendMessage(chatId, `The phone number ${phoneNumber} is already connected. Please use /delpair to remove it before connecting again.`);
          break;
        }
        
        // If session exists but not connected, show reconnect option
        const reconnectButton = {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "🔄 Reconnect",
                  callback_data: `reconnect_${phoneNumber}`
                },
                {
                  text: "🗑️ Delete Session",
                  callback_data: `delete_session_${phoneNumber}`
                }
              ]
            ]
          }
        };
        
        bot.sendMessage(chatId, 
          `ℹ️ The session for ${phoneNumber} already exists.\n\nChoose an option:`,
          reconnectButton
        );
      }
      break;
          
    case '/delpair':
      const args = msg.text.split(' ');
      if (args.length < 2) {
        bot.sendMessage(chatId, 'Please provide a phone number to delete the session. Example: /delpair 254xxxx');
        break;
      }
      const phoneNumbers = args[1];
      const sessionPaths = path.join(__dirname, 'trash_baileys', `session_${phoneNumbers}`);
      try {
        if (fs.existsSync(sessionPaths)) {
          fs.rmSync(sessionPaths, { recursive: true, force: true });
          bot.sendMessage(chatId, `Session for ${phoneNumbers} has been deleted. You can now request a new pairing code.`);
          if (connectedUsers && connectedUsers[chatId]) {
            connectedUsers[chatId] = connectedUsers[chatId].filter(user => user.phoneNumber !== phoneNumbers);
            saveConnectedUsers();
          }
          // Remove from pairing data
          pairingData.delete(phoneNumbers);
          savePairingData();
        } else {
          bot.sendMessage(chatId, `No session found for ${phoneNumbers}. It may have already been deleted.`);
        }
      } catch (error) {
        console.error('Error deleting session:', error);
        bot.sendMessage(chatId, 'Failed to delete session. Please try again later.');
      }
      break;    

    default:
      if (command.startsWith('/')) {
        bot.sendMessage(chatId, 'Unknown command. Type /help for available commands.');
      }
  }
});

// Handle contact sharing
bot.on('contact', (msg) => {
  const phoneNumber = msg.contact.phone_number;
  bot.sendMessage(msg.chat.id, `Your phone number is: ${phoneNumber}`);
});

// Load plugins safely
const pluginsPath = path.join(__dirname, "plugins");
if (fs.existsSync(pluginsPath)) {
  fs.readdirSync(pluginsPath).forEach((file) => {
    if (file.endsWith(".js")) {
      try {
        const plugin = require(path.join(pluginsPath, file));
        if (typeof plugin === "function") {
          plugin(bot);
          console.log(`✅ Plugin loaded: ${file}`);
        }
      } catch (error) {
        console.error(`❌ Error loading plugin ${file}:`, error);
      }
    }
  });
} else {
  console.log('Plugins directory not found, skipping plugin loading');
}

// Function to load all session files
async function loadAllSessions() {
    const sessionsDir = path.join(__dirname, 'trash_baileys');
    if (!fs.existsSync(sessionsDir)) {
        fs.mkdirSync(sessionsDir, { recursive: true });
        return;
    }

    const sessionFiles = fs.readdirSync(sessionsDir);
    for (const file of sessionFiles) {
        if (file.startsWith('session_')) {
            const phoneNumber = file.replace('session_', '');
            try {
                await startWhatsAppBot(phoneNumber);
                console.log(`Loaded session for ${phoneNumber}`);
            } catch (error) {
                console.error(`Failed to load session for ${phoneNumber}:`, error);
            }
        }
    }
}

// Ensure all sessions are loaded on startup
loadConnectedUsers();
loadPairingData(); // Load pairing data on startup
loadAllSessions().then(() => {
    console.log('⚙️ Telegram bot started successfully!');
}).catch(err => {
    console.log('Error loading sessions:', err);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('Bot shutting down...');
  saveConnectedUsers();
  savePairingData(); // Save pairing data on shutdown
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Bot shutting down...');
  saveConnectedUsers();
  savePairingData(); // Save pairing data on shutdown
  process.exit(0);
});
