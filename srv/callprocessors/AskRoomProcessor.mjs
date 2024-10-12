import { GenericProcessor } from "./GenericProcessor.mjs";


export class AskRoomProcessor extends GenericProcessor {
    constructor(context, io, socket) {
        super(context, io, socket);
    }
    execute(args) {
        const headers = this.context.getCustomHeaders(this.socket);
        this.io.to(this.socket.id).emit("updateUserList", {
            socketIds: this.context.mapSockets[headers.room]
        });
        this.context.sendCurrentModel(this.socket);
    }
}