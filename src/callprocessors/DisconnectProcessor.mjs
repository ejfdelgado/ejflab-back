import { GenericProcessor } from "./GenericProcessor.mjs";
import { SimpleObj } from "../../srcJs/SimpleObj.js";


export class DisconnectProcessor extends GenericProcessor {
    constructor(context, io, socket) {
        super(context, io, socket);
    }

    clearClientSocket(sources, socketId) {
        for (let sourceKey in sources) {
            const source = sources[sourceKey];
            if (source.socket == socketId) {
                source.socket = null;
                break;
            }
        }
    }

    clearPersonFromPeople(people, socketId) {
        for (let personId in people) {
            const onePerson = people[personId];
            if (onePerson.socket == socketId) {
                delete people[personId]
                break;
            }
        }
    }

    async execute(args) {
        const socketId = this.socket.id;
        // Busco los sources
        const room = this.context.getRoomFromSocket(this.socket);
        const instance = await this.context.getFlowChartExec(room);
        const roomData = this.context.getRoomLiveTupleModel(room);
        if (instance) {
            roomData.model.data = instance.getData();
        }
        const sources = SimpleObj.getValue(roomData.model, "data.state.sources", {});
        const processors = SimpleObj.getValue(roomData.model, "data.state.processors", {});
        this.clearClientSocket(sources, socketId);
        this.clearClientSocket(processors, socketId);
        //
        const people = SimpleObj.getValue(roomData.model, "data.people", null);
        if (people) {
            this.clearPersonFromPeople(people, socketId);
        }

        const observe = ["data", "data.state", "data.state.sources", "data.state.processors", "data.people"];
        let changes = roomData.builder.trackDifferences(roomData.model, [], null, observe);
        roomData.model = roomData.builder.affect(changes);
    }
}