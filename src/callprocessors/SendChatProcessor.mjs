import { SimpleObj } from "../../srcJs/SimpleObj.js";
import { GenericProcessor } from "./GenericProcessor.mjs";


export class SendChatProcessor extends GenericProcessor {
    MAX_COUNT_TIMESTAMS = 6;
    constructor(context, io, socket) {
        super(context, io, socket);
    }
    execute(args) {
        const { text, author, open } = args;
        const room = this.context.getRoomFromSocket(this.socket);
        const roomData = this.context.getRoomLiveTupleModel(room);
        if (!roomData.model.data) {
            roomData.model.data = {};
        }
        if (!roomData.model.data.chat) {
            roomData.model.data.chat = [];
        }
        const now = new Date().getTime();
        roomData.model.data.chat.push({
            text,
            date: now,
            author: {
                uid: author,
            },
        });
        let changes = roomData.builder.trackDifferences(roomData.model, [], null, ["data", "data.chat"]);
        roomData.model = roomData.builder.affect(changes);
        // Also notify last message time
        const roomPublicData = this.context.getRoomLiveTupleModel("public");
        if (roomPublicData.model.data) {
            const tupleKey = `data.lastmsg.${room}.${author}.arr`;
            const arr = SimpleObj.getValue(roomPublicData.model, tupleKey, []);
            arr.push(now);
            const sobrantes = arr.length - this.MAX_COUNT_TIMESTAMS;
            if (sobrantes > 0) {
                arr.splice(0, sobrantes);
            }
            SimpleObj.recreate(roomPublicData.model, tupleKey, arr);
            const changePaths = [
                "data",
                "data.lastmsg",
                `data.lastmsg.${room}`,
                `data.lastmsg.${room}.${author}`,
                `data.lastmsg.${room}.${author}.arr`
            ];
            let changes2 = roomPublicData.builder.trackDifferences(roomPublicData.model, [], null, changePaths);
            roomPublicData.model = roomPublicData.builder.affect(changes2);

            if (open) {
                // Get the other id
                let otherId;
                if (room.startsWith(author)) {
                    otherId = room.substring(author.length + 1);
                } else {
                    otherId = room.substring(0, room.length - (author.length + 1));
                }
                console.log(`I'm ${author} and other is ${otherId}`);
                const otherSocket = SimpleObj.getValue(roomPublicData.model, `data.people.${otherId}.socket`, null);
                if (otherSocket) {
                    this.io.to(otherSocket).emit("openChat", {
                        room,
                    });
                }
            }
        }


    }
}