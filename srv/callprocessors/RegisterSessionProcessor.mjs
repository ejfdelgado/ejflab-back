import { GenericProcessor } from "./GenericProcessor.mjs";


export class RegisterSessionProcessor extends GenericProcessor {
    constructor(context, io, socket) {
        super(context, io, socket);
    }
    execute(args) {
        console.log(`RegisterSessionProcessor... ${JSON.stringify(args)}`);
        const sessionsData = this.context.sessionsByProvider;
        const { socketId, sessionId, provider } = args;
        if (!(provider in sessionsData)) {
            const userSessions = {
                sockets: {},
                sessions: {},
            };
            sessionsData[provider] = userSessions;
            userSessions.sockets[socketId] = sessionId;
            userSessions.sessions[sessionId] = socketId;
        } else {
            const userSessions = sessionsData[provider];
            const { sockets, sessions } = userSessions;
            if (sessionId in sessions) {
                // If it is an existent session, then switch the socketId
                const oldSocketId = sessions[sessionId];
                sessions[sessionId] = socketId;
                delete sockets[oldSocketId];
                sockets[socketId] = sessionId;
            } else {
                // Register the new session
                userSessions.sockets[socketId] = sessionId;
                userSessions.sessions[sessionId] = socketId;
            }
        }
        console.log(JSON.stringify(sessionsData, null, 4));
        // Notify all sockets the amount of sessions
        const allSockets = Object.keys(sessionsData[provider].sockets);
        const count = allSockets.length;
        for (let i = 0; i < allSockets.length; i++) {
            const socketIdOther = allSockets[i];
            this.io.to(socketIdOther).emit("sessionCount", { count });
        }
    }
}