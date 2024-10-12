import { GenericProcessor } from "./GenericProcessor.mjs";


export class CallUserProcessor extends GenericProcessor {
    constructor(context, io, socket) {
        super(context, io, socket);
    }
    execute(args) {
        console.log(`CallUserProcessor... to ${args.to}`);
        //console.log(JSON.stringify(args, null, 4));
        // Redirects to other:
        this.io.to(args.to).emit("callMade", {
            offer: args.offer,
            socket: this.socket.id,
        });
    }
}