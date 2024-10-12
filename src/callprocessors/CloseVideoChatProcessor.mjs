import { GenericProcessor } from "./GenericProcessor.mjs";


export class CloseVideoChatProcessor extends GenericProcessor {
    constructor(context, io, socket) {
        super(context, io, socket);
    }
    execute(args) {
        console.log(`CloseVideoChatProcessor... to ${args.room}`);
        //console.log(JSON.stringify(args, null, 4));
        // Redirects to other:
        this.io.to(args.room).emit("closeVideoChat", {
            room: args.room,
        });
    }
}