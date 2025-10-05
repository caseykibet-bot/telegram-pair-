module.exports = (bot) => {
  bot.onText(/\/mute/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    // Check if the user is an administrator
    bot.getChatAdministrators(chatId).then((admins) => {
      const isAdmin = admins.some((admin) => admin.user.id === userId);
      if (isAdmin) {
        // Get the user to mute from the command arguments
        const args = msg.text.split(' ');
        if (args.length < 2) {
          bot.sendMessage(chatId, 'Please specify the user ID or username to mute.');
          return;
        }

        const muteUserId = args[1].replace('@', '');
        bot.restrictChatMember(chatId, muteUserId, {
          until_date: Math.floor(Date.now() / 1000) + 3600, // Mute for 1 hour
          can_send_messages: false,
          can_send_media_messages: false,
          can_send_polls: false,
          can_send_other_messages: false,
          can_add_web_page_previews: false,
          can_change_info: false,
          can_invite_users: false,
          can_pin_messages: false,
        })
          .then(() => {
            bot.sendMessage(chatId, `User ${muteUserId} has been muted for 1 hour.`);
          })
          .catch((error) => {
            bot.sendMessage(chatId, `Failed to mute user: ${error.description}`);
          });
      } else {
        bot.sendMessage(chatId, 'You do not have permission to mute users.');
      }
    })
      .catch((error) => {
        bot.sendMessage(chatId, `Failed to get chat administrators: ${error.description}`);
      });
  });
};
