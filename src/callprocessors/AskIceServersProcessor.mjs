import fs from "fs";
import { GenericProcessor } from "./GenericProcessor.mjs";

export class AskIceServersProcessor extends GenericProcessor {
    constructor(context, io, socket) {
        super(context, io, socket);
    }
    execute(args) {
        // Reads from credentilas file...
        const text = fs.readFileSync(`./credentials/webrtcconfig.json`, 'utf8');
        const parsed = JSON.parse(text);
        this.io.to(this.socket.id).emit("oniceservers", parsed);
    }
}
