import { GenericProcessor } from "./GenericProcessor.mjs";
import { SimpleObj } from "../../srcJs/SimpleObj.js";

export class ProcessResponseProcessor extends GenericProcessor {
    constructor(context, io, socket) {
        super(context, io, socket);
    }
    async execute(args) {
        const { processorId, id, data } = args;
        let room = "";
        if (args.room) {
            room = args.room;
        } else if (this.socket) {
            room = this.context.getRoomFromSocket(this.socket);
        }

        if (!room) {
            console.log(`No room provided`);
            return;
        }

        const instance = await this.context.getFlowChartExec(room);
        if (!instance) {
            console.log(`No instance found for room ${room}`);
            return;
        }

        // Check for ignore timedout messages
        if (!instance.existsPendingCall(id)) {
            console.log(`WARNING: Ignoring message id ${id}`);
            return;
        }

        // Handling errors
        if (data["error"]) {
            console.log(`Processors name ${processorId} returns an error ${JSON.stringify(data["error"])}`);
            // Halt everything
            if (!instance.canRetry(id, new Error(data["error"]))) {
                instance.stop();
                return;
            }
        }

        // Reads output description
        const roomData = this.context.getRoomLiveTupleModel(room);

        const partsName = /^([^\.\d]+)(\d*)\.?([^'.]*)$/.exec(processorId);
        if (!partsName) {
            console.log(`The processor name ${processorId} does not match ^([^\.\d]+)(\d*)\.?([^'.]*)$`);
            return;
        }
        let method = "main";
        const processorMethod = partsName[0];
        const processorName = partsName[1];
        const instanceNumber = partsName[2];
        let processorInstance = partsName[1];
        if (typeof partsName[2] == "string") {
            processorInstance += instanceNumber;
        }
        if (typeof partsName[3] == "string" && partsName[3].trim().length > 0) {
            method = partsName[3];
        }

        const outputConnectionsConf = SimpleObj.getValue(roomData.model, `flowchart.flux.${processorInstance}.${method}.out`, null);
        if (!outputConnectionsConf) {
            console.log(`WARN: No output connection flux configuration for ${processorInstance}.${method}`);
            //return;
        }

        roomData.model.data = instance.getData();
        let countLocalChanges = 0;
        if (!!outputConnectionsConf) {
            outputConnectionsConf.forEach((outputConnectionsConfOne) => {
                const { key, val } = outputConnectionsConfOne;
                const output = val;
                const dataLocal = data[key];
                if (dataLocal != undefined) {
                    // Sends dataResponse to val
                    const outputParts = /^(b\.([^.]+)\.([^.]+)|d\.(.+))$/i.exec(output);
                    if (!outputParts) {
                        console.log(`${output} does not match ^(b\.([^.]+)\.([^.]+)|d\.(.+))$`);
                        return;
                    }
                    if (!outputParts[4]) {
                        const processorIdLocal = outputParts[2];
                        const sourcePath = outputParts[3];
                        instance.saveBufferData(processorIdLocal, sourcePath, dataLocal);
                        // Publish to others
                        const destiny = `${room}.${output}`;
                        //console.log(`Publishing to ${destiny} ok?`);
                        this.io.to(destiny).emit("processResponse", {
                            processorId,
                            sourcePath,
                            data: dataLocal
                        });
                    } else {
                        // Affect the model in the given point
                        const path = outputParts[4];
                        SimpleObj.recreate(roomData.model.data, path, dataLocal);
                        countLocalChanges++;
                        // Publish to others
                        const destiny = `${room}.d.${path}`;
                        //console.log(`Publishing to ${destiny} ok?`);
                        this.io.to(destiny).emit("processResponse", {
                            processorId,
                            sourcePath: path,
                            data: dataLocal
                        });
                    }
                } else {
                    console.log(`Skip output connection ${val} with no value`);
                }
            });
        }

        if (countLocalChanges > 0) {
            const changes = roomData.builder.trackDifferences(roomData.model, [], null, ["data"]);
            roomData.model = roomData.builder.affect(changes);
        }

        instance.clearPendingCall(id);
    }
}