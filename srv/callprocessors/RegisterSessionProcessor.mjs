import { GenericProcessor } from "./GenericProcessor.mjs";


export class RegisterSessionProcessor extends GenericProcessor {
    constructor(context, io, socket) {
        super(context, io, socket);
    }
    execute(args) {
        console.log(`RegisterSessionProcessor... to ${args.to}`);
        const sessions = this.context.sessionsByProvider;
        console.log(JSON.stringify(sessions, null, 4));
    }
}