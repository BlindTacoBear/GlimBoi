// handles all the data from command modals

let ActionCreator = require(`${appData[0]}/UI/src/js/commands/actionCreator.js`);

function prepareActions(mode) {
   // Activates all bootstrap tooltips
    $('[data-toggle-second="tooltip"]').tooltip()

    // Adds a command
    document.getElementById(`${mode}CommandButtonModal`).onclick = async function () {
        // First we check to make sure all the command settings are valid
        let commandSettings = await validateSettings(mode);
        if (commandSettings) {
            console.log("All command settings for this command are valid.");
        } else {
            console.log("Command settings were not valid.");
            return
        }
        // Now we check each action
        let tempCommandActions = validateActions(mode);
        if (!tempCommandActions) {
            console.log("Command actions were not valid.");
            return
        }
        // Finally we build the actions and add them as a command
        let commandActions = [];
        tempCommandActions.forEach(element => {
            let tempAction = new CommandHandle.ChatAction[`${element.type}`](element)
            commandActions.push(tempAction);
        });
        // Now we add the actions to the settings. We send the settings to be added as a new command. Command complete!
        commandSettings.actions = commandActions;
        if (mode == "add") {
            CommandHandle.addCommand(commandSettings);
            addCommandTable(commandSettings);
            $("#modalCart").modal("hide");
        } else {
            console.log(commandSettings);
            console.info("Command Edit Finished");
            CommandHandle.editCommand(commandSettings);
            editCommandTable(commandSettings);
            $("#modalCart").modal("hide");
        }
    }

    document.getElementById("CreateChatMessage").onclick = () => addActionToUI("ChatMessage", mode);
    document.getElementById("CreateAudio").onclick = () => addActionToUI("Audio", mode);
    document.getElementById("CreateImageGif").onclick = () => addActionToUI("ImageGif", mode)
}

function prepareModals(mode) {
    $(`#${mode}CommandPoints`).keypress(function (e) {
        if (isNaN(String.fromCharCode(e.which))) e.preventDefault();
    });
    $(`#${mode}CommandUses`).keypress(function (e) {
        if (isNaN(String.fromCharCode(e.which))) e.preventDefault();
    });
    $(`#${mode}CommandCooldown`).keypress(function (e) {
        if (isNaN(String.fromCharCode(e.which)) && e.which !== 46) e.preventDefault();
    });
    setTimeout(() => {
        $(`#${mode}OpenMenu`).click()
    }, 700);
}

function loadModalAdd() {
    fs.readFile(`${appData[0]}/UI/src/html/commands/addCommand.html`, async (err, data) => {
        if (err) {
            throw err
        }
        document.getElementById(`commandContent`).innerHTML = data;
        prepareModals("add")
        let selectRank = document.getElementById("addCommandRank");
        let options = RankHandle.getCurrentRanks()
        selectRank.innerHTML += "<option value=\"" + "Everyone" + "\">" + "Everyone (Default)" + "</option>";
        for (let i = 0; i < options.length; i++) {
            let opt = options[i].rank;
            selectRank.innerHTML += "<option value=\"" + opt + "\">" + opt + "</option>";
        }
        prepareActions("add");
        addActionToUI("ChatMessage", "add");
    })
}

function loadModalEdit(command) {
    fs.readFile(`${appData[0]}/UI/src/html/commands/editCommand.html`, async (err, data) => {
        if (err) {
            throw err
        }
        document.getElementById(`commandContent`).innerHTML = data;
        insertEditData(command);
        prepareModals("edit");
        prepareActions("edit");
    })
}

/**
 * Based on the action we build the corresponding UI element
 * @param {string} action
 * @param {string} mode add or edit
 * @param {object} data The action data
 */
function addActionToUI(action, mode, data) {
    switch (action) {
        case "ChatMessage": ActionCreator.buildChatMessageUI(mode, data)
            break;

        case "Audio": ActionCreator.buildAudioUI(mode, data);
            break;

        case "ImageGif": ActionCreator.buildImageGifUI(mode, data);
        break;
        default: null
        break
    }
}

/**
 * Fills the modal with the commands data
 * @param {object} command The command we are using
 */
function insertEditData(command) {
    // Sets the name, uses, and points
    document.getElementById("editCommandName").value = command.commandName
    document.getElementById("editCommandPoints").value = command.points
    document.getElementById("editCommandUses").value = command.uses

    // Sets the cooldown if any
    if (command.cooldown == undefined) {
        document.getElementById("editCommandCooldown").value = 0
    } else {
        document.getElementById("editCommandCooldown").value = command.cooldown
    }

    // Selects the rank of the command if any
    let selectRank = document.getElementById("editCommandRank");
    let options = RankHandle.getCurrentRanks()
    selectRank.innerHTML += "<option value=\"" + "Everyone" + "\">" + "Everyone (Default)" + "</option>";
    for (let i = 0; i < options.length; i++) {
        let opt = options[i].rank;
        if (command.rank == opt) {
            selectRank.innerHTML += "<option value=\"" + opt + "\" selected>" + opt + " (current)" + "</option>";
        } else {
            selectRank.innerHTML += "<option value=\"" + opt + "\">" + opt + "</option>";
        }
    }

    // Enables or disables the repeat property
    let repeatEnabled = document.getElementById("editCommandRepeat")
    if (command.repeat == true) {
        repeatEnabled.innerHTML += "<option value=\"" + "true" + "\" selected>" + "Enabled" + "</option>";
        repeatEnabled.innerHTML += "<option value=\"" + "false" + "\">" + "Disabled (Default)" + "</option>";
    } else if (command.repeat == false) {
        repeatEnabled.innerHTML += "<option value=\"" + "true" + "\">" + "Enabled" + "</option>";
        repeatEnabled.innerHTML += "<option value=\"" + "false" + "\" selected>" + "Disabled (Default)" + "</option>";
    }

    // Now we show the actions. If none exist (v1 command) we convert the message prperties to their action equivalents
    if (command.actions) {
        for (let i = 0; i < command.actions.length; i++) {
            switch (command.actions[i].action) {
                case "ChatMessage":ActionCreator.buildChatMessageUI("edit", {message: command.actions[i].message})
                break;

                default:
                    break;
            }
        }
    } else {
        ActionCreator.buildChatMessageUI("edit", {message: command.message});
        if (command.sound) {
            ActionCreator.buildAudioUI("edit", {sound: command.sound})
        } else if (command.media) {

        }
    }
}


module.exports = {addActionToUI, loadModalAdd, loadModalEdit}