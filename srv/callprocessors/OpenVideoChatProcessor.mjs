import { GenericProcessor } from "./GenericProcessor.mjs";


export class OpenVideoChatProcessor extends GenericProcessor {
    constructor(context, io, socket) {
        super(context, io, socket);
    }
    execute(args) {
        console.log(`OpenVideoChatProcessor... to ${args.uuid}`);
        // Redirects to other:
        // Translate args.uuid to socketId of args.room
        const socketId = this.context.getSocketIdFromRoomAndUUID("public", args.uuid);
        this.io.to(socketId).emit("openVideoChat", {
            room: args.room,
            providerName: args.providerName,
            providerTitle: args.providerTitle,
        });
    }
}