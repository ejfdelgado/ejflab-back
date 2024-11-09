export class GenericProcessor {
    constructor(context, io, socket) {
        this.context = context;
        this.io = io;
        this.socket = socket;
    }

    async executeSave(payload) {
        try {
            await this.execute(payload);
        } catch (err) {
            console.log(err);
        }
    }
}