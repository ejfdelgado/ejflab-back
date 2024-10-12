import { GenericProcessor } from "./GenericProcessor.mjs";

export class StartFlowChartProcessor extends GenericProcessor {
    constructor(context, io, socket) {
        super(context, io, socket);
    }
    async execute(args) {
        let { room } = args;
        if (!room) {
            if (this.socket) {
                room = this.context.getRoomFromSocket(this.socket);
            } else {
                room = "public";
            }
        }
        const instance = await this.context.getFlowChartExec(room);
        if (!instance) {
            console.log(`No instance for room ${room}`);
            return;
        }
        const roomData = this.context.getRoomLiveTupleModel(room);
        const now = new Date().getTime();
        // weird
        const data1 = instance.getData();
        roomData.model.data = data1;
        roomData.model.data.scope.start = now;
        let changes1 = roomData.builder.trackDifferences(roomData.model, [], null, ["data", "data.scope"]);
        roomData.model = roomData.builder.affect(changes1);
        instance.executeIteration(async (status) => {
            const data = instance.getData();
            //data['scope'].current = now;
            roomData.model.data = data;
            roomData.model.currentNodes = status.currentNodes;
            roomData.model.history = status.history;

            let changes = roomData.builder.trackDifferences(roomData.model, [], null, ["data", "currentNodes", "history"]);
            roomData.model = roomData.builder.affect(changes);
            if (changes.total > 0) {
                roomData.model.version = roomData.model.version + 1;
                changes = roomData.builder.trackDifferences(roomData.model, [], null, ["version"]);
                roomData.model = roomData.builder.affect(changes);
            }

        }).then(() => {
            this.io.to(room).emit("flowchartEnd", {});
        });
    }
}
