import { GenericProcessor } from "./GenericProcessor.mjs";


export class IncludeOtherPeersProcessor extends GenericProcessor {
    constructor(context, io, socket) {
        super(context, io, socket);
    }
    execute(args) {
        console.log(`IncludeOtherPeersProcessor... to ${args.to}`);
        this.io.to(args.to).emit("includeOtherPeers", {});
    }
}