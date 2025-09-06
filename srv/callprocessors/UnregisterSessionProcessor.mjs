import { GenericProcessor } from "./GenericProcessor.mjs";


export class UnregisterSessionProcessor extends GenericProcessor {
    constructor(context, io, socket) {
        super(context, io, socket);
    }
    execute(args) {
        console.log(`UnregisterSessionProcessor... ${JSON.stringify(args)}`);
        const sessionsData = this.context.sessionsByProvider;
        const { socketId, provider } = args;
        if ((provider in sessionsData)) {
            const userSessions = sessionsData[provider];
            const { sockets, sessions } = userSessions;
            // Get session by socketId
            const oldSession = sockets[socketId];
            if (oldSession) {
                delete sessions[oldSession];
                delete sockets[socketId];
            }
        } else {
            // Search in all providers the socketId
            for (let providerTemp in sessionsData) {
                const userSessions = sessionsData[providerTemp];
                const { sockets, sessions } = userSessions;
                // Get session by socketId
                const oldSession = sockets[socketId];
                if (oldSession) {
                    delete sessions[oldSession];
                    delete sockets[socketId];
                }
            }
        }
        console.log(JSON.stringify(sessionsData, null, 4));
        const allSockets = Object.keys(sessionsData[provider].sockets);
        const count = allSockets.length;
        for (let i = 0; i < allSockets.length; i++) {
            const socketIdOther = allSockets[i];
            this.io.to(socketIdOther).emit("sessionCount", { count });
        }
    }
}