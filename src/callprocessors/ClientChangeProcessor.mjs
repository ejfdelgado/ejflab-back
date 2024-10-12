import { GenericProcessor } from "./GenericProcessor.mjs";


export class ClientChangeProcessor extends GenericProcessor {
    constructor(context, io, socket) {
        super(context, io, socket);
    }
    execute(args) {
        const { changes } = args;
        const socketId = this.socket.id;
        const room = this.context.socketToRoom[socketId];
        // Apply to local model
        const roomData = this.context.getRoomLiveTupleModel(room);
        roomData.model = roomData.builder.affect(changes);
        //Share to others the change
        //console.log(`emit to ${room} clientChange ${JSON.stringify(changes)}`);
        this.io.to(room).emit("clientChange", changes);
    }
}
