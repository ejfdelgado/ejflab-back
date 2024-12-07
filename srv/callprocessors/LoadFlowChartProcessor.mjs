import { FlowChartExec } from "@ejfdelgado/ejflab-common/src/flowchart/FlowChartExec.js";
import { GenericProcessor } from "./GenericProcessor.mjs";
import fs from "fs";
import { SimpleObj } from "@ejfdelgado/ejflab-common/src/SimpleObj.js";
import { MyTuples } from "@ejfdelgado/ejflab-common/src/MyTuples.js";
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

    overwriteProcessorEnvVariables(dataObject) {
        //console.log(JSON.stringify(dataObject, null, 4));
        const tuples = MyTuples.getTuples(dataObject);
        //console.log(JSON.stringify(tuples, null, 4));
        const keys = Object.keys(tuples);
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const currentValue = tuples[key];
            if (typeof currentValue == "string") {
                const envKey = key.replace(".", "_").toUpperCase();
                if (envKey in process.env) {
                    SimpleObj.recreate(dataObject, key, process.env[envKey]);
                }
                console.log(`${envKey}=${SimpleObj.getValue(dataObject, key)}`);
            }
        }
    }

    static getFilteredEnv() {
        const envClone = JSON.parse(JSON.stringify(process.env));
        const envCloneKeys = Object.keys(envClone);
        for (let i = 0; i < envCloneKeys.length; i++) {
            const key = envCloneKeys[i];
            if (/pass|secret|key/i.test(key)) {
                delete envClone[key];
            }
        }
        return envClone;
    }

    async execute(args) {
        let {
            names,
            conf,
            dataPath,
            dataVal,
            room,
            skipValidation,
            multiples
        } = args;
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
                const fileName = dataPath[keyData];
                const dataObject = JSON.parse(fs.readFileSync(fileName, 'utf8'));
                // Here we can intercept the data model and overwrite given env variables
                if (fileName.endsWith("processors.json")) {
                    this.overwriteProcessorEnvVariables(dataObject);
                }
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
        data['env'] = LoadFlowChartProcessor.getFilteredEnv();

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
        roomData.model.multiples = multiples;
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