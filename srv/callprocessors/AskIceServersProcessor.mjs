import fs from "fs";
import { GenericProcessor } from "./GenericProcessor.mjs";

export class AskIceServersProcessor extends GenericProcessor {
    constructor(context, io, socket) {
        super(context, io, socket);
    }
    execute(args) {
        // Reads from credentilas file...
        let confFile = process.env.WEBRTC_CONF || "./credentials/webrtcconfig.json";
        if ("webrtc_conf" in args) {
            confFile = args["webrtc_conf"];
        }
        const text = fs.readFileSync(confFile, 'utf8');
        const parsed = JSON.parse(text);
        this.io.to(this.socket.id).emit("oniceservers", parsed);
    }
}
