import { SimpleObj } from "@ejfdelgado/ejflab-common/src/SimpleObj.js";
import { GenericProcessor } from "./GenericProcessor.mjs";


export class RegisterSourceProcessor extends GenericProcessor {
    constructor(context, io, socket) {
        super(context, io, socket);
    }
    async execute(args) {
        const { uid } = args;
        const room = this.context.getRoomFromSocket(this.socket);
        const instance = await this.context.getFlowChartExec(room);
        if (!instance) {
            return;
        }
        const roomData = this.context.getRoomLiveTupleModel(room);
        roomData.model.data = instance.getData();
        SimpleObj.recreate(roomData.model, `data.state.sources.${uid}.socket`, this.socket.id);
        let changes = roomData.builder.trackDifferences(roomData.model, [], null, ["data", "data.state", "data.state.sources"]);
        roomData.model = roomData.builder.affect(changes);
    }
}