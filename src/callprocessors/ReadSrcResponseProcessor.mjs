import { SimpleObj } from "../../srcJs/SimpleObj.js";
import { GenericProcessor } from "./GenericProcessor.mjs";


export class ReadSrcResponseProcessor extends GenericProcessor {
    constructor(context, io, socket) {
        super(context, io, socket);
    }
    async execute(args) {
        const { response, sourcePair, id } = args;
        const room = this.context.getRoomFromSocket(this.socket);
        const instance = await this.context.getFlowChartExec(room);
        if (!instance) {
            return;
        }
        const sourceId = sourcePair.split(".")[0];
        for (let sourcePath in response) {
            const buffer = response[sourcePath];
            instance.saveBufferData(sourceId, sourcePath, buffer);
            // Publish to others
            this.io.to(`${room}.${sourceId}.${sourcePath}`).emit("readSrcResponse", {
                sourceId,
                sourcePath,
                buffer
            });
        }
        instance.clearPendingCall(id);

    }
}