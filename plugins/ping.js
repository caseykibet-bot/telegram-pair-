module.exports = (bot) => {
  bot.onText(/\/ping/, (msg) => {
    const startTime = Date.now();
    bot.sendMessage(msg.chat.id, "Pong!")
      .then(() => {
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        bot.sendMessage(msg.chat.id, `Response time: ${responseTime}ms`);
      })
      .catch((error) => {
        console.error("Error sending message:", error);
      });
  });
};
