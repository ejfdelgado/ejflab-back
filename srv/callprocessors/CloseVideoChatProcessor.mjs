import { GenericProcessor } from "./GenericProcessor.mjs";


export class CloseVideoChatProcessor extends GenericProcessor {
    constructor(context, io, socket) {
        super(context, io, socket);
    }
    execute(args) {
        if (args.uuid) {
            console.log(`CloseVideoChatProcessor... to ${args.uuid}`);
            // Redirects to other:
            // Translate args.uuid to socketId of args.room
            const socketId = this.context.getSocketIdFromRoomAndUUID("public", args.uuid);
            this.io.to(socketId).emit("closeVideoChat", {
                room: args.room,
            });
        } else {
            console.log(`CloseVideoChatProcessor... to ${args.room}`);
            this.io.to(args.room).emit("closeVideoChat", {
                room: args.room,
            });
        }
    }
}