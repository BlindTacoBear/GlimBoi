// This file handles the glimboi logging system. This is separate from chat logging (message only)

let loggingDB:Nedb;
let logPath = "./";

/**
 * Logging Event. Any non message event
 */
class LoggingEvent implements LogType {
    event: logEvent;
    caused: string
    affected: string[];
    time: Date;
    description: string
    constructor({event, users, data = null}:LogConstructor) {
        this.event = event;
        this.caused = users[0];
        this.affected = this.handleUsers(users);
        this.time = new Date();
        this.description = this.determineDescription(event, this.caused, this.affected, data);
    }

    /**
     *
     * @param {array} users
     * @returns
     */
    handleUsers(users:string[]) {
        let userData = [];
        users.splice(0, 1);
        for (let i = 0; i < users.length; i++) {
            userData.push(users[i])
        }
        return userData
    }

    /**
     * Returns the description with the event details.
     * @param {string} event The event for the log
     * @param {string} caused The user that caused the event
     * @param {array} affected The users that are affected
     * @param {array} data The data about the event. Null if none
     * @returns {string}
     */
    determineDescription(event: string, caused:userName, affected:string[], data:any): string {
        switch (event) {
            case "Add User":
                return `${this.time}: ${caused} added ${affected[0]} to the user list.`;
            case "Edit User":
                return `${this.time}: ${caused} edited ${affected[0]}. Rank: ${data[0]}. Points: ${data[1]}.`
            case "Remove User":
                return `${this.time}: ${caused} removed ${affected[0]} from the user list.`
            case "Add Points":
                return `${this.time}: ${caused} added ${data[0]} ${data[1]}s to ${affected[0]}`
            case "Edit Points":
                return `${this.time}: ${caused} set ${data[0]} ${data[0]}s to ${affected[0]}`
            case "Remove Points":
                return `${this.time}: ${caused} removed ${data[0]} ${data[0]}s to ${affected[0]}`
            case "Delete Message":
                return `${this.time}: ${caused} deleted a message from ${affected[0]} with ID ${data.messageID}`
            case "Short Timeout User":
                return `${this.time}: ${caused} performed a short timeout on ${affected[0]}`
            case "Long Timeout User":
                return `${this.time}: ${caused} performed a long timeout on ${affected[0]}`
            case "Ban User":
                return `${this.time}: ${caused} banned ${affected[0]}`
            case "UnBan User":
                return `${this.time}: ${caused} banned ${affected[0]}`
            default:
                return "No event was sent to the Log Handler."
        }
    }
}

/**
 * Updates the path to the DB. The path variable is updated
 */
 function updatePath(path:string): void {
    logPath = path
    // @ts-ignore
    loggingDB = new Datastore({ filename: `${path}/data/logging.db`, autoload: true, timestampData: true });
}


/**
 * Logs an event to the db.
 * @param {object} data The data revelant to the event
 */
function logEvent(data: LogConstructor): void {
    let newEvent = new LoggingEvent(data)
    console.log(newEvent);
    loggingDB.insert(newEvent, function (err, doc) {});
    if (currentPage == "chat") {
        addAction(newEvent)
    } else if (currentPage == "mod") {
        switch (newEvent.event) {
            case "Delete Message":
                case "Ban User":
                case "Long Timeout User":
                case "Short Timeout User":
                case "UnBan User":
                logModAction(newEvent)
            default:
                break;
        }
    }
}

/**
 * Returns the 5 most recent logs matching the type you requested
 * @param log The log(')s to search for
 * @returns
 */
function getLogByType(log:logEvent | logEvent[]): Promise<null | LogType[]> {
    return new Promise(resolve => {
        if (typeof log == "string") {
            loggingDB.find({event: log}).limit(5).exec(function (err: Error | null, docs: LogType[]) {
                if (docs.length == 0) {
                    resolve(null)
                } else {
                    resolve(docs)
                }
            })
        } else {
            let search = [];
            log.forEach(logEventName => {
                search.push({event: logEventName})
            });
            loggingDB.find({ $or: search}).limit(5).exec(function (err: Error | null, docs: any[]) {
                if (docs.length == 0) {
                    resolve(null)
                } else {
                    resolve(docs.sort((a,b) => b.time - a.time))
                }
          });
        }
    })
}

export {getLogByType, logEvent, LoggingEvent ,updatePath}
