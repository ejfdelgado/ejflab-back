import { GenericProcessor } from "./GenericProcessor.mjs";


export class MakeAnswerProcessor extends GenericProcessor {
    constructor(context, io, socket) {
        super(context, io, socket);
    }
    execute(args) {
        console.log(`MakeAnswerProcessor... to ${args.to}`);
        //console.log(JSON.stringify(args, null, 4));
        // Redirects to other:
        this.io.to(args.to).emit("answerMade", {
            socket: this.socket.id,
            answer: args.answer
        });
    }
}
