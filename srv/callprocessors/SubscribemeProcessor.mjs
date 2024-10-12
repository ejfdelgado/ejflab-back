import { GenericProcessor } from "./GenericProcessor.mjs";


export class SubscribemeProcessor extends GenericProcessor {
    constructor(context, io, socket) {
        super(context, io, socket);
    }
    execute(args) {
        const { ref } = args;
        console.log(`Joining ${this.socket.id} to ${ref}`);
        this.socket.join(ref);
    }
}