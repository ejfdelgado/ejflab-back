import { SimpleObj } from "../../srcJs/SimpleObj.js";
import { GenericProcessor } from "./GenericProcessor.mjs";


export class CheckSrcResponseProcessor extends GenericProcessor {
    constructor(context, io, socket) {
        super(context, io, socket);
    }
    async execute(args) {
        const { uid, metadata } = args;
        const room = this.context.getRoomFromSocket(this.socket);
        const instance = await this.context.getFlowChartExec(room);
        if (!instance) {
            return;
        }
        const roomData = this.context.getRoomLiveTupleModel(room);
        roomData.model.data = instance.getData();
        const configuration = SimpleObj.getValue(roomData.model, `data.state.sources.${uid}.data`, null);
        if (configuration) {
            for (let key in metadata) {
                const oldData = configuration[key];
                oldData.metadata = metadata[key];
            }
            let changes = roomData.builder.trackDifferences(roomData.model, [], null, ["data", "data.state", "data.state.sources", `data.state.sources.${uid}`]);
            roomData.model = roomData.builder.affect(changes);
        }
    }
}