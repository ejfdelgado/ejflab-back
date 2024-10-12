import { GenericProcessor } from "./GenericProcessor.mjs";


export class ChatSetSawProcessor extends GenericProcessor {
    MAX_COUNT_TIMESTAMS = 6;
    constructor(context, io, socket) {
        super(context, io, socket);
    }
    execute(args) {
        const now = new Date().getTime();
        const { author } = args;
        const room = this.context.getRoomFromSocket(this.socket);
        // Also notify last message time
        const roomPublicData = this.context.getRoomLiveTupleModel("public");
        if (roomPublicData.model.data) {
            let lastmsg = roomPublicData.model.data.lastmsg;
            if (!lastmsg) {
                lastmsg = {};
                roomPublicData.model.data.lastmsg = lastmsg;
                lastmsg[room] = {}
            }
            let tiempos = lastmsg[room][author];
            if (!tiempos) {
                tiempos = {
                    last: now,
                };
                lastmsg[room][author] = tiempos;
            } else {
                tiempos.last = now;
            }
            const changePaths = [
                "data",
                "data.lastmsg",
                `data.lastmsg.${room}`,
                `data.lastmsg.${room}.${author}`,
                `data.lastmsg.${room}.${author}.last`
            ];
            let changes2 = roomPublicData.builder.trackDifferences(roomPublicData.model, [], null, changePaths);
            roomPublicData.model = roomPublicData.builder.affect(changes2);
        }
    }
}