// Implements miscellaneous functions on the bot object.

var utils = require("./utils");
var https = require("https");
var model = require("./model");

function initMisc() {
  this.fileGet = fileGet;
  this.fileLink = fileLink;
  this.fileStream = fileStream;
  this.fileLoad = fileLoad;
  this.getChat = getChat;
  this.getProfilePhotos = getProfilePhotos;
  this.kickMember = kickMember;
  this.unbanMember = unbanMember;
  this.leaveChat = leaveChat;
  this.getChatAdministrators = getChatAdministrators;
  this.getChatMembersCount = getChatMembersCount;
  this.getChatMember = getChatMember;
  this.context = context;
  this.link = link;
  this.linkGroup = linkGroup;
  this.formatCommand = formatCommand;
}

// File upload / download

function fileGet(file, cb) {
  // Undocumented feature: sometimes the file_path property may be
  // given to you without having to call getFile [again].
  if (file instanceof model.File && file.path) return cb(null, file);

  this.callMethod("getFile", {file_id: model.resolveFile(file)}, function (err, result) {
    if (err) return cb(err);
    cb(null, new model.File().parse(result, this.options));
  }.bind(this));
}

function fileLink(path) {
  if (path instanceof model.File) path = path.path;
  return "https://api.telegram.org/file/bot" + this.authToken + "/" + path;
}

function fileStream(file, cb) {
  this.fileGet(file, function (err, info, link) {
    if (err) return cb(err);
    https.get(this.fileLink(info), function (res) {
      cb(null, res);
    }).on("error", cb);
  }.bind(this));
}

function fileLoad(file, cb) {
  this.fileStream(file, function (err, stream) {
    if (err) return cb(err);
    var chunks = [];
    stream.on("error", cb);
    stream.on("readable", function () {
      var chunk = stream.read();
      if (chunk) chunks.push(chunk);
    });
    stream.on("end", function () {
      cb(null, Buffer.concat(chunks));
    });
  }.bind(this));
}

// Chat management

function getChat(chat, cb) {
  if (utils.isStr(chat)) {
    if (chat[0] !== "@") chat = "@" + chat;
  } else {
    chat = model.resolveChat(chat);
  }
  this.callMethod("getChat", {chat_id: chat}, function (err, result) {
    if (err) return cb(err);
    cb(null, new model.Chat().parse(result, this.options));
  }.bind(this));
}

function getProfilePhotos(user, range, cb) {
  if (arguments.length === 2) cb = range, range = null;

  var parameters = {user_id: model.resolveChat(user)};
  if (range) {
    utils.checkArr(range);
    if (range[1] < 1 || range[1] > 100) throw new Error("Invalid photo range");
    parameters.offset = utils.checkInt(range[0]);
    parameters.limit = utils.checkInt(range[1]);
  }
  this.callMethod("getUserProfilePhotos", parameters, function (err, result) {
    if (err) return cb(err);

    utils.checkObj(result);

    var photos = utils.checkArr(result.photos);
    delete result.photos;
    photos = photos.map(function (photo) {
      return model.parsePhoto.call({}, photo, this.options);
    }.bind(this));

    photos.total = utils.checkInt(result.total_count);
    delete result.total_count;

    utils.verifyEmpty(result, this.options);
    cb(null, photos);
  }.bind(this));
}

function kickMember(chat, user, cb) {
  this.callMethod("kickChatMember", {chat_id: model.resolveChat(chat), user_id: model.resolveChat(user)}, function (err, result) {
    if (err) return cb(err);
    if (result !== true) return cb(new Error("Expected true, found " + result));
    cb();
  }.bind(this));
}

function unbanMember(chat, user, cb) {
  this.callMethod("unbanChatMember", {chat_id: model.resolveChat(chat), user_id: model.resolveChat(user)}, function (err, result) {
    if (err) return cb(err);
    if (result !== true) return cb(new Error("Expected true, found " + result));
    cb();
  }.bind(this));
}

function leaveChat(chat, cb) {
  this.callMethod("leaveChat", {chat_id: model.resolveChat(chat)}, function (err, result) {
    if (err) return cb(err);
    if (result !== true) return cb(new Error("Expected true, found " + result));
    cb();
  }.bind(this));
}

function getChatAdministrators(chat, cb) {
  this.callMethod("getChatAdministrators", {chat_id: model.resolveChat(chat)}, function (err, result) {
    if (err) return cb(err);
    var members = utils.checkArr(result).map(function (member) {
      return new model.ChatMember().parse(member, this.options);
    }.bind(this));
    cb(null, members);
  }.bind(this));
}

function getChatMembersCount(chat, cb) {
  this.callMethod("getChatMembersCount", {chat_id: model.resolveChat(chat)}, function (err, result) {
    if (err) return cb(err);
    cb(null, utils.checkInt(result));
  }.bind(this));
}

function getChatMember(chat, user, cb) {
  this.callMethod("getChatMember", {chat_id: model.resolveChat(chat), user_id: model.resolveChat(user)}, function (err, result) {
    if (err) return cb(err);
    cb(null, new model.ChatMember().parse(result, this.options));
  }.bind(this));
}

// Other

function context(initial) {
  if (initial === undefined) {
    initial = function () { return {}; };
  } else if (!utils.isFunc(initial)) {
    var initialObj = initial;
    initial = function () { return Object.create(initialObj); };
  }
  var contexts = {};
  this.all(function (msg, reply, next) {
    var id = msg.chat.id;
    if (!(id in contexts)) contexts[id] = initial(msg);
    msg.context = contexts[id];
    next();
  });
}

function link(payload, group) {
  if (!this.get("username")) throw new Error("Username still not available");
  var link = "https://telegram.me/" + this.get("username");
  if (payload !== undefined) {
    if (!/^[A-Za-z0-9_-]+$/.test(payload))
      throw new Error("Payload contains invalid characters");
    link += "?start" + (group ? "group" : "") + "=" + payload;
  }
  return link;
}

function linkGroup(payload) {
  return this.link(payload, true);
}

function formatCommand(username, command, args) {
  if (username === true) {
    if (!this.get("username")) throw new Error("Username still not available");
    username = this.get("username");
  }
  if (!(args instanceof Array))
    args = [].slice.call(arguments, 2);
  if (username) username = username.toString();

  return model.formatCommand(username, command, args);
}



exports.initMisc = initMisc;
