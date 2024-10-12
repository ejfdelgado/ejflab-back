import { GenericProcessor } from "./GenericProcessor.mjs";


export class UpdateMyInformationProcessor extends GenericProcessor {
    constructor(context, io, socket) {
        super(context, io, socket);
    }
    execute(args) {
        const { userUID, data } = args;
        const room = this.context.getRoomFromSocket(this.socket);
        const roomData = this.context.getRoomLiveTupleModel(room);
        if (!roomData.model.data) {
            roomData.model.data = {};
        }
        if (!roomData.model.data.people) {
            roomData.model.data.people = {};
        }
        data.socket = this.socket.id;
        let oldValue = roomData.model.data.people[userUID];
        if (oldValue) {
            data.since = oldValue.since;
        }
        if (!data.since) {
            data.since = new Date().getTime();
        }
        roomData.model.data.people[userUID] = data;
        let changes = roomData.builder.trackDifferences(roomData.model, [], null, ["data", "data.people"]);
        roomData.model = roomData.builder.affect(changes);
    }
}