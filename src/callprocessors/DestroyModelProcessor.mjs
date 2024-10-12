import { GenericProcessor } from "./GenericProcessor.mjs";


export class DestroyModelProcessor extends GenericProcessor {
    constructor(context, io, socket) {
        super(context, io, socket);
    }
    execute(args) {
        const socketId = this.socket.id;
        const room = this.context.getRoomFromSocket(this.socket);
        this.context.getRoomLiveTupleModel(room, true);
        // Emmit to client do the same!
        this.io.to(room).emit("setModel", { model: {} });
        this.io.to(room).emit("flowchartUnloaded", {});
    }
}