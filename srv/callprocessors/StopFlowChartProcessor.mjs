import { GenericProcessor } from "./GenericProcessor.mjs";

export class StopFlowChartProcessor extends GenericProcessor {
    constructor(context, io, socket) {
        super(context, io, socket);
    }
    async execute(args) {
        const room = this.context.getRoomFromSocket(this.socket);
        const instance = await this.context.getFlowChartExec(room);
        if (!instance) {
            console.log(`No instance to stop`);
            return;
        }
        instance.stop();
    }
}