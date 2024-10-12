import { FlowChartExec } from "@ejfdelgado/ejflab-common/src/flowchart/FlowChartExec.js";
import { GenericProcessor } from "./GenericProcessor.mjs";
import fs from "fs";
import { SimpleObj } from "@ejfdelgado/ejflab-common/src/SimpleObj.js";
import { Buffer } from 'buffer';

const WORKSPACE = process.env.WORKSPACE;

export class LoadFlowChartProcessor extends GenericProcessor {
    constructor(context, io, socket) {
        super(context, io, socket);
    }

    completePaths(objeto) {
        if (!objeto) {
            return;
        }
        for (let llave in objeto) {
            let valor = objeto[llave];
            if (typeof valor == "string") {
                valor = valor.replaceAll("${WORKSPACE}", WORKSPACE);
                objeto[llave] = valor;
            }
        }
    }

    async execute(args) {
        let { names, conf, dataPath, dataVal, room, skipValidation } = args;
        console.log(`LoadFlowChartProcessor at room ${room}...`);
        this.completePaths(names);
        this.completePaths(dataPath);
        if (!room) {
            if (this.socket) {
                room = this.context.getRoomFromSocket(this.socket);
            } else {
                room = "public";
            }
        }
        console.log(`Creating flowchart into ${room}`);
        let instance = null;
        if (skipValidation === false) {
            instance = await this.context.getFlowChartExec(room);
            if (instance && instance.isRunning()) {
                console.log("It is already running, must stop or pause first.");
                return;
            }
        }

        let data = {};
        if (dataPath) {
            const keysData = Object.keys(dataPath);
            for (let i = 0; i < keysData.length; i++) {
                const keyData = keysData[i];
                const dataObject = JSON.parse(fs.readFileSync(dataPath[keyData], 'utf8'));
                if (keyData.length == 0) {
                    Object.assign(data, dataObject);
                } else {
                    SimpleObj.recreate(data, keyData, dataObject);
                }
            }
        }

        if (dataVal) {
            const keysDataVal = Object.keys(dataVal);
            for (let i = 0; i < keysDataVal.length; i++) {
                const keyData = keysDataVal[i];
                const dataObject = dataVal[keyData];
                SimpleObj.recreate(data, keyData, dataObject);
            }
        }

        data['scope'] = { room, progress: 0 };

        // Leer el archivo y su data
        instance = new FlowChartExec();
        instance.setSocketIO(this.io, room);
        instance.setConf(conf);
        instance.setData(data);
        this.context.setFlowChartExec(room, instance);
        const flowchart = instance.loadFlowChart(names);
        // Asignarlo al modelo
        const roomData = this.context.getRoomLiveTupleModel(room);

        roomData.model.currentNodes = [];
        roomData.model.history = [];
        roomData.model.flowchart = flowchart;
        roomData.model.data = data;
        roomData.model.version = 0;
        // So it will be capable to reload from this point
        roomData.model.request = Buffer.from(JSON.stringify(args), "utf8").toString("base64");
        const changes = roomData.builder.trackDifferences(roomData.model);
        roomData.model = roomData.builder.affect(changes);

        // Notify
        const statusFun = (status) => {
            if (status === false) {
                this.io.to(room).emit("flowchartLoaded", {});
                roomData.statusEmitter.off("status", statusFun);
            }
        };
        roomData.statusEmitter.on("status", statusFun);
    }
}