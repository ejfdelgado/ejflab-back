import { GenericProcessor } from "./GenericProcessor.mjs";
import { SimpleObj } from "@ejfdelgado/ejflab-common/src/SimpleObj.js";


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

    clearPersonFromPeople(people, socketId, room) {
        for (let personId in people) {
            const onePerson = people[personId];
            //console.log(room, JSON.stringify(onePerson));
            if (room == "public") {
                // public room control
                const { type, user_id } = onePerson;
                if (type == "provider") {
                    // It's provider, then remove it from connected providers
                    //console.log(`Register session end to ${user_id}`);
                    this.context.internalBus.emit("unregisterSession", {
                        provider: user_id,
                        socketId: socketId,
                    });
                }
            }
            if (onePerson.socket == socketId || socketId == personId) {
                if (onePerson.sharedState && onePerson.sharedState.user_id) {
                    this.context.internalBus.emit("closeVideoChat", {
                        provider: onePerson.sharedState.user_id,
                        room: room,
                    });
                }
                if (onePerson.sharedState && onePerson.sharedState.uuid) {
                    this.context.internalBus.emit("soupClose", {
                        uuid: onePerson.sharedState.uuid,
                        room: room,
                        sharedState: onePerson.sharedState,
                    });
                }
                delete people[personId];
                break;
            }
        }
    }

    async execute(args) {
        const socketId = typeof args.socketId == "string" ? args.socketId : this.socket.id;
        console.log(`DisconnectProcessor "${socketId}"`);
        // Busco los sources
        const room = this.context.getRoomFromSocket({ id: socketId });
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
            this.clearPersonFromPeople(people, socketId, room);
        }

        const observe = ["data", "data.state", "data.state.sources", "data.state.processors", "data.people"];
        let changes = roomData.builder.trackDifferences(roomData.model, [], null, observe);
        roomData.model = roomData.builder.affect(changes);
    }
}
