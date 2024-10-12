import { GenericProcessor } from "./GenericProcessor.mjs";


export class OnIceCandidateProcessor extends GenericProcessor {
    constructor(context, io, socket) {
        super(context, io, socket);
    }
    execute(args) {
        // Just redirects to room
        args.from = this.socket.id;
        this.io.to(args.to).emit("onicecandidate", args);
    }
}
