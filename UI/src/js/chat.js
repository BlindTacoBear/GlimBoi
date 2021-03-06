var ChatHandle = require(appData[0] + "/chatbot/lib/chat.js"); // Chat Module
var ModHandle = require(appData[0] + "/chatbot/lib/moderator.js"); // handles moderator actions
var isDev = false; // We assume they are on a production release.
ChatHandle.updatePath(appData[1]);

var contextItem;
var globalChatMessages;
var currentChatConnected = null;

/**
 * Gets the bot username for autofilling recent channels
 */
async function getBot() {
  return new Promise(resolve => {
    try {
      AuthHandle.getToken().then(data => {
        if (data == undefined || data.length == 0 ) {
          resolve(null);
        } else {
          ApiHandle.updatePath(data); //Sends the API module our access token.
          ApiHandle.getBotAccount().then(data => {
            resolve(data);
          });
        }
      });
    } catch (e) {
      console.log(e);
      resolve(null);
    }
  })
}
/**
 * The main starting logic for joining and leaving and deleting recent chats / channels
 *
 * 3 actions trigger this. Delete, Join, Leave
 *
 * Delete:
 *  - Deletes the element from the page and the database
 *  - If the user is connected to the deleted channel, they get disconnected
 *
 * Join:
 *  - Joins the selected channel, once ensuring data / auth is correct
 *  - Leaves any channel if the socket is open (was before everything was disabled, now it's still there for bug prevention)
 *
 * Leave:
 *  - Leaves the current connected chat
 */
$(document).on('click', '#chatConnections button', function (event) {
  var action    = $(this).attr('data-action');
  var listing   = $(this).closest('.channel-listing');
  var channel   = listing.attr('data-channel');
  var channelid = listing.attr('data-channelid');

  $('button[data-action=leave]').prop('disabled', true);
  $('button[data-action=join]').prop('disabled', true);

  if (action === 'delete') {
    $(this).prop('disabled', true); // Disable delete btn
    if (currentChatConnected === channel) {
      currentChatConnected = null;
      ChatHandle.disconnect(false);
    }

    $(listing).remove();
    ChatHandle.removeRecentChannelByID(channelid); // Remove from DB
  } else if (ChatHandle.isConnected()) {
    // Always disconnect unless we're deleting
    currentChatConnected = null;
    ChatHandle.disconnect(false);
  }

  // Join a chat? Set a timeout to avoid a race condition between disconnect and joinChat
  // We cannot async / promise the disconnect on the websocket
  if (action === 'join') {
    setTimeout(function () {
      joinChat(channel);
    }, 500);
  } if (ChatHandle.isConnected() === false) {
    // Clear the right-side text of what channel we're connect to & reload channels after deletion
    $('#channelConnectedName').removeClass('text-success').addClass('text-danger');
    $('#channelConnectedName').text('Not Connected');
    ChatHandle.getAllRecentChannels().then(channels => displayChannels(channels));
  }
});

/**
 * Join a chat after ensuring everything is kosher, and display the connection
 * @param {string} chat
 */
function joinChat(chat) {
  var chatToJoin = chat;

  AuthHandle.getToken().then(data => {
    if (data == undefined || data.length == 0 ) {
      errorMessage("The auth process is not yet complete. Please complete it before trying to join a chat.", "Go to the home page of Glimboi and auth again.")
    } else {
      ApiHandle.updatePath(data); //Sends the API module our access token.
      ApiHandle.getChannelID(chatToJoin).then(response => {
        if (response == null) {
          errorMessage(response, "Please make sure that the channel exists. Check your spelling.")
        } else if (response.status == "AUTHNEEDED") {
          errorMessage(response.data, "You need to authenticate again.")
        } else {
          //We have the ID, time to join the channel. At this point we assume the auth info is correct and we can finally get to their channel.
          currentChatConnected = chatToJoin;
          ChatHandle.join(data, response); // Joins the channel
          successMessage("Chat connected!", "Please disconnect when you are finished. Happy Streaming!");
          // Now we need to import the filter.
          ModHandle.importFilter();

          addChannelAndDisplay(chatToJoin).then(function () {
            $('#channelConnectedName').text(chatToJoin);
            $('#channelConnectedName').removeClass('text-danger').addClass('text-success ');
          });
        }
      })
    }
  })
}

/**
 * Adds a new chat / channel only, does not connect
 */
$(document).on('click', '#triggerNewChatAdd', function (event) {
  var chatToJoin = $('#newChatName').val();
  AuthHandle.getToken().then(data => {
    if (data == undefined || data.length == 0) {
      errorMessage("The auth process is not yet complete. Please complete it before trying to join a chat.", "Go to the home page of Glimboi and auth again.")
    } else {
      // Authenticate if we can and check the channel
      ApiHandle.updatePath(data); //Sends the API module our access token.
      ApiHandle.getChannelID(chatToJoin).then(response => {
        if (response == null || response.data == 'Could not find resource') {
          errorMessage(response.data, "Please make sure that the channel exists. Check your spelling.")
        } else {
          addChannelAndDisplay(chatToJoin).then($('#newChatModal').modal('hide'));
        }
      })
    }
  })
});

/**
 * Loads the chat window, autofills some data from the API and displays it
 */
function loadChatWindow() {
  globalChatMessages.forEach(msg => {
    ChatHandle.logMessage(msg[0], msg[1], msg[2], false);
  });

  try {
    getBot().then(botName => {
      var ts = (Date.now());
      var defaultChannels = [{
        channel: 'Glimesh',
        timestamp: ts
      }];

      // If we have authentication, add our name to recent channels
      if (botName !== null) {
        defaultChannels.push({
          channel: botName,
          timestamp: ts
        });
      }

      ChatHandle.getAllRecentChannels().then(channels => {
        if (channels.length == 0) {
          defaultChannels.forEach(chan => {
            ChatHandle.addRecentChannel(chan.channel, chan.ts);
          });
          channels = defaultChannels;
        }

        $('#chatConnections').empty();
        displayChannels(channels);
      });
    });
  } catch (e) {
    console.log(e);
  }
}

/**
 * Adds a channel to the DB, then reloads the visuals
 *
 * @param {string} chatToJoin
 */
async function addChannelAndDisplay(chatToJoin) {
  return new Promise(resolve => {
    try {
      ChatHandle.addRecentChannel(chatToJoin).then(newChannel => {
        ChatHandle.getAllRecentChannels().then(channels => {
          displayChannels(channels);
          resolve(newChannel);
        });
      });
    } catch (e) {
      console.log(e);
      resolve(null);
    }
  });
}

/**
 * Displays all loaded channels into the recent channels / chats box, sorted by timestamp last connected
 *
 * @param {array[object]} channels
 */
function displayChannels(channels) {
  $('#chatConnections').empty(); // clear
  $('#chatConnections').append(`<div class="pinned"></div>`);
  $('#chatConnections').append(`<div class="scroller"></div>`);

  // Sort channels by timestamp
  channels.sort((a,b) => (a.timestamp < b.timestamp) ? 1 : ((b.timestamp < a.timestamp) ? -1 : 0))

  // Add default elements
  channels.forEach(channel => {
    var d = new Date(channel.timestamp);
    var current = currentChatConnected === channel.channel;

    if (currentChatConnected === null) {
      $('#channelConnectedName').removeClass('text-success').addClass('text-danger');
      $('#channelConnectedName').text('Not Connected');
    } else if (current) {
      $('#channelConnectedName').removeClass('text-danger').addClass('text-success');
      $('#channelConnectedName').text(currentChatConnected);
    }

    // Disable all leave buttons (except on the connected chat)
    // Enable all join buttons (except on the connected chat)
    var disableJoin = (currentChatConnected !== null) ? 'disabled': '';
    var disableLeave = (currentChatConnected === null || !current) ? 'disabled': '';

    $(current ? '#chatConnections .pinned' : '#chatConnections .scroller')
    .append(`<div class="mx-0 row channel-listing" data-channel="${channel.channel}" data-channelid="${channel._id}">
        <h4 class="col whiteText channelName p-0" title="Last Seen: ${d.toLocaleString()} | Channel: ${channel.channel}">${channel.channel}</h4>
        <div class="d-flex">
          <div><button data-action="join" class="mx-1 btn btn-success btn-block" ${disableJoin}>Join</button></div>
          <div><button data-action="leave" class="mx-1 btn btn-danger btn-block" ${disableLeave}>Leave</button></div>
          <div><button style="width: 40px;" title="Delete" data-action="delete" class="mx-1 btn btn-danger btn-block btn-icon"><i class="fas fa-trash"></i></button></div>
        </div>
      </div>
    `)
  });
}

/**
 * Sends a message to chat as the bot. This is user input.
 * Resets when sent.
 */
function sendMessage() {
  ChatHandle.filterMessage(document.getElementById("messageArea").value, "user");
  document.getElementById("messageArea").value = "" // resets the message box
}


/**
 * Checks for updates on launch. Also sets dev state to true/false. Shows restart button if update is ready.
 */
function checkForUpdate() {
  const version = document.getElementById('version');
  ipcRenderer.send('app_version');
  ipcRenderer.on('app_version', (event, arg) => {
    console.log("Recieved app_version with : " + arg.version)
    console.log("Removing all listeners for app_version.")
    version.innerText = 'Version ' + arg.version;
    if (arg.isDev == true) {
      isDev = true;
      console.log("Glimboi is in dev mode. We will not request the token.")
    } else {
      console.log("GlimBoi is in production mode. We will request an access token. ")
    }
    ipcRenderer.removeAllListeners('app_version');
  });
  const notification = document.getElementById('notification');
  const message = document.getElementById('message');
  const restartButton = document.getElementById('restart-button');

  ipcRenderer.on('update_available', () => {
    ipcRenderer.removeAllListeners('update_available');
    console.log("Update Avaible")
    message.innerText = 'A new update is available. Downloading now...';
    notification.classList.remove('hidden');
  });

  ipcRenderer.on('update_downloaded', () => {
    console.log("Update Downloaded")
    ipcRenderer.removeAllListeners('update_downloaded');
    message.innerText = 'Update Downloaded. It will be installed on restart. Restart now?';
    restartButton.classList.remove('hidden');
    notification.classList.remove('hidden');
    function closeNotification() {
      notification.classList.add('hidden');
    }
  })
  // test functions
  ipcRenderer.on("aaaaaaaaaaaaa", () => {
    console.log("it happened")
  })
  ipcRenderer.on("test", data => {
    console.log(data)
  })
}

function restartApp() {
  console.log("trying to restart the app for the update")
  ipcRenderer.send('restart_app');
}

function testingStuff(e) {
  contextItem = $(e.target).attr('name')
  console.log(contextItem)
  var top = e.pageY - 110;
  var left = e.pageX + 10;
  $("#context-menu").css({
    display: "block",
    top: top,
    left: left
  }).addClass("show");
  document.body.addEventListener("click", function() {$("#context-menu").removeClass("show").hide()},{once:true})
}

function contextMenu(action) {
  if (action == "ADDUSER") {
    UserHandle.addUser(contextItem.toLowerCase(), false).then(data => {

    })
  } else if (action == "ADDQUOTE") {

  } else {

  }
}

/**
 * Edits the action modal to show the correct info.
 * @param {string} action The type of moderator action
 */
function actionBuilder(action) {
  console.log(action)
  document.getElementById("actionType").innerText = action
  switch (action) {
    case "Short Timeout":
      document.getElementById("targetActionButton").onclick = function() {
        ModHandle.timeoutByUsername("short", document.getElementById('whichUser').value, "GUI")
      }
      break;
    case "Long Timeout":
      document.getElementById("targetActionButton").onclick = function() {
        ModHandle.timeoutByUsername("long", document.getElementById('whichUser').value, "GUI")
      }
      break;
    case "Ban":
      document.getElementById("targetActionButton").onclick = function() {
        ModHandle.banByUsername(document.getElementById('whichUser').value, "GUI")
      }
      break;
    case "UnBan":
      document.getElementById("targetActionButton").onclick = function() {
        ModHandle.unBanByUsername(document.getElementById('whichUser').value, "GUI")
      }
      break;

    default:
      break;
  }
}
