import { GenericProcessor } from "./GenericProcessor.mjs";


export class GetModelProcessor extends GenericProcessor {
    constructor(context, io, socket) {
        super(context, io, socket);
    }
    execute(args) {
        this.context.sendCurrentModel(this.socket);
    }
}