#!/usr/bin/env node
// Utility that uses the Bot API to obtain
// information about a particular chat.
// Usage: ./info.js <auth token> <chat ID or username>

var botgram = require("..");
var bot = botgram(process.argv[2]);

bot.ready(function() {
  // Stop the bot right after identification;
  // we don't want to consume any updates.
  bot.stop();
});


// Fetch and print generic info about the chat, resolving it if necessary
var chatId = parseInt(process.argv[3]);
if (isNaN(chatId)) chatId = process.argv[3];

call(bot, bot.getChat, chatId).then(function (chat) {
  console.log("%s %s (%s):", chat.type[0].toUpperCase() + chat.type.substring(1), chat.id, chat.name);
  if (chat.username) console.log(" - username: @%s", chat.username);
  if (chat.firstname) console.log(" - first name: %s", chat.firstname);
  if (chat.lastname) console.log(" - last name: %s", chat.lastname);
  if (chat.title) console.log(" - title: %s", chat.title);

  return Promise.resolve().then(function () {
    return printProfilePhotos(chat);
  }).then(function () {
    return printMembers(chat);
  });
}, function (err) {
  console.error("Couldn't lookup the chat:\n%s", err);
  process.exit(1);
}).catch(function (err) {
  process.nextTick(function () { throw err; });
});


// Fetch list (and links to) profile photos for the user
function printProfilePhotos(chat) {
  if (chat.type !== "user") return;
  return call(bot, bot.getProfilePhotos, chat).then(function (photos) {
    console.log(" - profile photos: %s", photos.total);

    return photos.reduce(function (sequence, photo) {
      return sequence.then(processPhoto.bind(photo));
    }, Promise.resolve());

    function processPhoto() {
      console.log("\nProfile photo:");
      return this.sizes.reduce(function (sequence, size) {
        return sequence.then(processPhotoSize.bind(size));
      }, Promise.resolve());
    }

    function processPhotoSize() {
      return call(bot, bot.fileGet, this.file).then(function (file) {
        console.log("[%sx%s]: %s", this.width, this.height, bot.fileLink(file));
      }.bind(this));
    }
  }, function (err) {
    console.error("\nError when fetching profile photos:\n%s", err);
  });
}


// Fetch chat administrators, member count and member status for this bot
function printMembers(chat) {
  if (chat.type !== "group" && chat.type !== "supergroup") return;

  return Promise.resolve().then(function() {
    return getId().then(function (id) {
      return call(bot, bot.getChatMember, chat, id);
    }).then(function (member) {
      console.log("\nBot status in this chat: %s", member.status);
    }, function (err) {
      console.error("\nError when fetching own chat status:\n%s", err);
    });
  }).then(function () {
    return call(bot, bot.getChatAdministrators, chat).then(function (members) {
      console.log("\nChat administrators:");
      members.forEach(function (member) {
        console.log(" - %s %s (%s)", member.status, member.user.id, member.user.name);
      });
    }, function (err) {
      console.error("\nError when fetching administrators:\n%s", err);
    });
  }).then(function () {
    return call(bot, bot.getChatMembersCount, chat).then(function (count) {
      console.log("\nChat has %s members.", count);
    }, function (err) {
      console.error("\nError when fetching chat member count:\n%s", err);
    });
  });
}



// Utility to turn a callback method into a promise
function call(obj, method) {
  var args = [].slice.call(arguments, 2);
  return new Promise(function (resolve, reject) {
    args.push(function (err, result) {
      if (err) reject(err);
      else resolve(result);
    });
    method.apply(obj, args);
  });
}
// Utility to get the bot's ID as a promise
function getId() {
  return new Promise(function (resolve, reject) {
    bot.ready(function () {
      resolve(bot.get("id"));
    });
  });
}
