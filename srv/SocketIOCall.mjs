import { CallUserProcessor } from "./callprocessors/CallUserProcessor.mjs";
import { MakeAnswerProcessor } from "./callprocessors/MakeAnswerProcessor.mjs";
import { Mutex } from 'async-mutex';
import { AskRoomProcessor } from "./callprocessors/AskRoomProcessor.mjs";
import { ClientChangeProcessor } from "./callprocessors/ClientChangeProcessor.mjs";
import { MyTuples } from "@ejfdelgado/ejflab-common/src/MyTuples.js";
import { SimpleObj } from "@ejfdelgado/ejflab-common/src/SimpleObj.js";
import { IdGen } from "@ejfdelgado/ejflab-common/src/IdGen.js";
import { GetModelProcessor } from "./callprocessors/GetModelProcessor.mjs";
import { LoadFlowChartProcessor } from "./callprocessors/LoadFlowChartProcessor.mjs";
import { DestroyModelProcessor } from "./callprocessors/DestroyModelProcessor.mjs";
import { OnIceCandidateProcessor } from "./callprocessors/OnIceCandidateProcessor.mjs";
import { AskIceServersProcessor } from "./callprocessors/AskIceServersProcessor.mjs";
import EventEmitter from 'node:events';
import { StartFlowChartProcessor } from "./callprocessors/StartFlowChartProcessor.mjs";
import { StopFlowChartProcessor } from "./callprocessors/StopFlowChartProcessor.mjs";
import { RegisterSourceProcessor } from "./callprocessors/RegisterSourceProcessor.mjs";
import { DisconnectProcessor } from "./callprocessors/DisconnectProcessor.mjs";
import { CheckSrcResponseProcessor } from "./callprocessors/CheckSrcResponseProcessor.mjs";
import { PauseFlowChartProcessor } from "./callprocessors/PauseFlowChartProcessor.mjs";
import { ReadSrcResponseProcessor } from "./callprocessors/ReadSrcResponseProcessor.mjs";
import { RegisterProcessorProcessor } from "./callprocessors/RegisterProcessorProcessor.mjs";
import { ProcessResponseProcessor } from "./callprocessors/ProcessResponseProcessor.mjs";
import { SubscribemeProcessor } from "./callprocessors/SubscribemeProcessor.mjs";
import { SendChatProcessor } from "./callprocessors/SendChatProcessor.mjs";
import { UpdateMyInformationProcessor } from "./callprocessors/UpdateMyInformationProcessor.mjs";
import axios from "axios";
import { encode, decode } from "@msgpack/msgpack";
import { ChatSetSawProcessor } from "./callprocessors/ChatSetSawProcessor.mjs";
import { MilvusSrv } from "./MilvusSrv.mjs";
import { MongoSrv } from "./MongoSrv.mjs";
import { MinioSrv } from "./MinioSrv.mjs";
import { PostgresSrv } from "./PostgresSrv.mjs";
import { OpenVideoChatProcessor } from "./callprocessors/OpenVideoChatProcessor.mjs";
import { CloseVideoChatProcessor } from "./callprocessors/CloseVideoChatProcessor.mjs";
import { IncludeOtherPeersProcessor } from "./callprocessors/IncludeOtherPeersProcessor.mjs";

export class SocketIOCall {
    static io;
    static mutex = new Mutex();

    static mapSockets = {};
    static socketToRoom = {};
    static roomLiveTupleModel = {};
    static mapFlowChartExec = {};
    static socketIdToSocket = {};
    static socketRoomUUIDMap = {};

    static echoLog(message) {
        console.log(message);
        SocketIOCall.io.emit('echoLog', { message });
    }

    static setFlowChartExec(room, instance) {
        this.mapFlowChartExec[room] = instance;
        instance.setSuperContext(this);
    }

    static getAxios() {
        return axios;
    }

    static getMilvusClient() {
        return MilvusSrv;
    }

    static getMongoClient() {
        return MongoSrv;
    }

    static getMinioClient() {
        return MinioSrv;
    }

    static getPostgresClient() {
        return PostgresSrv;
    }

    static async autoCreateRoomFlowChart(room) {
        console.log(`autoCreateRoomFlowChart ${room}`);
        const root_folder = process.env.WORKSPACE;
        const payload = {
            names: {},
            conf: {
                debug: false,
                sleep: 100
            },
            dataPath: {
                "state.processors": `${root_folder}/flowcharts/processors/processors.json`,
            },
            skipValidation: true,
            room,
        };
        const socket = null;
        await new LoadFlowChartProcessor(SocketIOCall, SocketIOCall.io, socket).execute(payload);
        return this.mapFlowChartExec[room];
    }

    static async getFlowChartExec(room) {
        let created = this.mapFlowChartExec[room];
        const AUTO_ROOMS = ["processors"];
        if (!created && AUTO_ROOMS.indexOf(room) >= 0) {
            created = await SocketIOCall.autoCreateRoomFlowChart(room);
        }
        return created;
    }

    static getRoomLiveTupleModel(room, rebuild = false) {
        const builderConfig = {
            MAX_SEND_SIZE: 10000,
            LOW_PRESSURE_MS: 0,
            // No tiene sentido porque como la actualización es asincrona, nunca se sabe si falló
            BACK_OFF_MULTIPLIER: 100,
        };
        let actual = SocketIOCall.roomLiveTupleModel[room];
        if (!actual || rebuild) {
            //console.log(`Creating room model builder... ${room}`);
            actual = {
                model: {},
            };
            const builder = MyTuples.getBuilder(builderConfig);
            builder.setProcesor((changes) => {
                changes.orig = "server";
                SocketIOCall.io.to(room).emit("clientChange", changes);
            });
            builder.build(actual.model);
            builder.end();
            actual.statusEmitter = new EventEmitter();
            builder.addActivityListener((status) => {
                actual.statusEmitter.emit("status", status);
            });
            actual.builder = builder;
            SocketIOCall.roomLiveTupleModel[room] = actual;
        }
        return actual;
    }

    static async registerSocket(socket) {
        console.log("registerSocket...");
        SocketIOCall.socketIdToSocket[socket.id] = socket;
        const headers = SocketIOCall.getCustomHeaders(socket);
        const room = headers.room;
        const release = await SocketIOCall.mutex.acquire();
        let currentList = SocketIOCall.mapSockets[room];
        SocketIOCall.socketToRoom[socket.id] = room;
        if (!currentList) {
            currentList = [socket.id];
            SocketIOCall.mapSockets[room] = currentList;
        } else {
            if (currentList.indexOf(socket.id) < 0) {
                currentList.push(socket.id);
            }
        }
        // Assure room existence
        if (!(room in SocketIOCall.socketRoomUUIDMap)) {
            SocketIOCall.socketRoomUUIDMap[room] = {};
        }
        const myUUID = headers.uuid;
        if (typeof myUUID == "string" && myUUID !== "null") {
            SocketIOCall.socketRoomUUIDMap[room][myUUID] = socket.id;
        }
        console.log(JSON.stringify(SocketIOCall.socketRoomUUIDMap, null, 4));
        release();
        console.log(`${socket.id} joins ${headers.room}`);
        socket.join(headers.room);
        SocketIOCall.getRoomLiveTupleModel(room);
    }

    static getSocketIdFromRoomAndUUID(room, uuid) {
        const roomMap = SocketIOCall.socketRoomUUIDMap[room];
        if (!roomMap) {
            return null;
        }
        return roomMap[uuid];
    }

    static async unregisterSocket(socket) {
        delete SocketIOCall.socketIdToSocket[socket.id];
        const headers = SocketIOCall.getCustomHeaders(socket);
        const room = headers.room;
        const release = await SocketIOCall.mutex.acquire();
        let currentList = SocketIOCall.mapSockets[room];
        if (currentList) {
            currentList = currentList.filter((elem) => {
                return elem != socket.id;
            });
            SocketIOCall.mapSockets[room] = currentList;
        }
        if (room in SocketIOCall.socketRoomUUIDMap) {
            if (headers.uuid in SocketIOCall.socketRoomUUIDMap[room]) {
                delete SocketIOCall.socketRoomUUIDMap[room][headers.uuid];
            }
            if (Object.keys(SocketIOCall.socketRoomUUIDMap[room]).length == 0) {
                delete SocketIOCall.socketRoomUUIDMap[room];
            }
            console.log(JSON.stringify(SocketIOCall.socketRoomUUIDMap, null, 4));
        }
        release();
    }

    static getCustomHeaders(socket) {
        const headersKey = ["room", "uuid"];
        const headers = socket.handshake.headers;
        const response = {};
        headersKey.forEach((key) => {
            response[key] = headers[key];
        });
        return response;
    }

    static async checkAndNotifyRoomPeers(socket) {
        await SocketIOCall.registerSocket(socket);
        // Le digo a los que están en el room quién llegó
        const headers = SocketIOCall.getCustomHeaders(socket);
        SocketIOCall.io.to(headers.room).emit("updateUserList", {
            socketIds: SocketIOCall.mapSockets[headers.room]
        });
    }

    static async sendCurrentModel(socket) {
        //console.log(`Emmit to ${socket.id} model!`);
        const headers = SocketIOCall.getCustomHeaders(socket);
        const room = headers.room;
        const dataRoom = SocketIOCall.getRoomLiveTupleModel(room);
        // Le notifico el modelo actual
        SocketIOCall.io.to(socket.id).emit("setModel", {
            model: dataRoom.model
        });
    }

    static getRoomFromSocket(socket) {
        return SocketIOCall.socketToRoom[socket.id]
    }

    static async connect(socket) {
        SocketIOCall.echoLog(`connect... ${socket.id}`);

        await SocketIOCall.checkAndNotifyRoomPeers(socket);

        socket.on("callUser", (payload) => {
            SocketIOCall.echoLog(`${socket.id} sends callUser`);
            new CallUserProcessor(SocketIOCall, SocketIOCall.io, socket).execute(payload);
        });
        socket.on("makeAnswer", (payload) => {
            SocketIOCall.echoLog(`${socket.id} sends makeAnswer`);
            new MakeAnswerProcessor(SocketIOCall, SocketIOCall.io, socket).execute(payload);
        });
        socket.on("onicecandidate", (payload) => {
            SocketIOCall.echoLog(`${socket.id} sends onicecandidate`);
            new OnIceCandidateProcessor(SocketIOCall, SocketIOCall.io, socket).execute(payload);
        });
        socket.on("disconnect", (payload) => {
            SocketIOCall.echoLog(`${socket.id} sends disconnect with ${JSON.stringify(payload)}`);
            new DisconnectProcessor(SocketIOCall, SocketIOCall.io, socket).execute(payload);
            SocketIOCall.disconnect(socket);
        });
        /*
        socket.on("reconnect", (payload) => {
            SocketIOCall.echoLog(`${socket.id} sends reconnect with ${JSON.stringify(payload)}`);
            SocketIOCall.sendCurrentModel();
        });*/
        socket.on("askRoom", (payload) => {
            SocketIOCall.echoLog(`${socket.id} sends askRoom with ${JSON.stringify(payload)}`);
            new AskRoomProcessor(SocketIOCall, SocketIOCall.io, socket).execute(payload);
        });
        socket.on("clientChange", (payload) => {
            new ClientChangeProcessor(SocketIOCall, SocketIOCall.io, socket).execute(payload);
        });
        socket.on("getModel", (payload) => {
            new GetModelProcessor(SocketIOCall, SocketIOCall.io, socket).execute(payload);
        });
        socket.on("loadFlowchart", (payload) => {
            SocketIOCall.echoLog(`${socket.id} sends loadFlowchart with ${JSON.stringify(payload)}`);
            new LoadFlowChartProcessor(SocketIOCall, SocketIOCall.io, socket).execute(payload);
        });
        socket.on("startFlowChart", (payload) => {
            SocketIOCall.echoLog(`${socket.id} sends startFlowChart with ${JSON.stringify(payload)}`);
            new StartFlowChartProcessor(SocketIOCall, SocketIOCall.io, socket).execute(payload);
        });
        socket.on("stopFlowChart", (payload) => {
            SocketIOCall.echoLog(`${socket.id} sends stopFlowChart with ${JSON.stringify(payload)}`);
            new StopFlowChartProcessor(SocketIOCall, SocketIOCall.io, socket).execute(payload);
        });
        socket.on("pauseFlowChart", (payload) => {
            SocketIOCall.echoLog(`${socket.id} sends pauseFlowChart with ${JSON.stringify(payload)}`);
            new PauseFlowChartProcessor(SocketIOCall, SocketIOCall.io, socket).execute(payload);
        });
        socket.on("destroyModel", (payload) => {
            SocketIOCall.echoLog(`${socket.id} sends destroyModel with ${JSON.stringify(payload)}`);
            new DestroyModelProcessor(SocketIOCall, SocketIOCall.io, socket).execute(payload);
        });
        socket.on("askiceservers", (payload) => {
            SocketIOCall.echoLog(`${socket.id} sends askiceservers with ${JSON.stringify(payload)}`);
            new AskIceServersProcessor(SocketIOCall, SocketIOCall.io, socket).execute(payload);
        });
        socket.on("registerSource", (payload) => {
            SocketIOCall.echoLog(`${socket.id} sends registerSource with ${JSON.stringify(payload)}`);
            new RegisterSourceProcessor(SocketIOCall, SocketIOCall.io, socket).execute(payload);
        });
        socket.on("registerProcessor", (payload) => {
            SocketIOCall.echoLog(`${socket.id} sends registerProcessor with ${JSON.stringify(payload)}`);
            new RegisterProcessorProcessor(SocketIOCall, SocketIOCall.io, socket).execute(payload);
        });

        socket.on("checkSrcResponse", (payload) => {
            //SocketIOCall.echoLog(`${socket.id} sends checkSrcResponse with ${JSON.stringify(payload)}`);
            new CheckSrcResponseProcessor(SocketIOCall, SocketIOCall.io, socket).execute(payload);
        });
        socket.on("readSrcResponse", (payload) => {
            //SocketIOCall.echoLog(`${socket.id} sends readSrcResponse with ${JSON.stringify(payload)}`);
            new ReadSrcResponseProcessor(SocketIOCall, SocketIOCall.io, socket).execute(payload);
        });
        socket.on("processResponse", (payload) => {
            //SocketIOCall.echoLog(`${socket.id} sends processResponse with ${JSON.stringify(payload)}`);
            new ProcessResponseProcessor(SocketIOCall, SocketIOCall.io, socket).execute(payload);
        });
        socket.on("subscribeme", (payload) => {
            SocketIOCall.echoLog(`${socket.id} sends subscribeme with ${JSON.stringify(payload)}`);
            new SubscribemeProcessor(SocketIOCall, SocketIOCall.io, socket).execute(payload);
        });
        socket.on("sendChat", (payload) => {
            //SocketIOCall.echoLog(`${socket.id} sends sendChat with ${JSON.stringify(payload)}`);
            new SendChatProcessor(SocketIOCall, SocketIOCall.io, socket).execute(payload);
        });
        socket.on("updateMyInformation", (payload) => {
            //SocketIOCall.echoLog(`${socket.id} sends updateMyInformation with ${JSON.stringify(payload)}`);
            new UpdateMyInformationProcessor(SocketIOCall, SocketIOCall.io, socket).execute(payload);
        });
        socket.on("chatSetSawProcessor", (payload) => {
            //SocketIOCall.echoLog(`${socket.id} sends chatSetSawProcessor with ${JSON.stringify(payload)}`);
            new ChatSetSawProcessor(SocketIOCall, SocketIOCall.io, socket).execute(payload);
        });
        socket.on("openVideoChat", (payload) => {
            //SocketIOCall.echoLog(`${socket.id} sends openVideoChat with ${JSON.stringify(payload)}`);
            new OpenVideoChatProcessor(SocketIOCall, SocketIOCall.io, socket).execute(payload);
        });
        socket.on("closeVideoChat", (payload) => {
            //SocketIOCall.echoLog(`${socket.id} sends closeVideoChat with ${JSON.stringify(payload)}`);
            new CloseVideoChatProcessor(SocketIOCall, SocketIOCall.io, socket).execute(payload);
        });
        socket.on("includeOtherPeers", (payload) => {
            //SocketIOCall.echoLog(`${socket.id} sends includeOtherPeers with ${JSON.stringify(payload)}`);
            new IncludeOtherPeersProcessor(SocketIOCall, SocketIOCall.io, socket).execute(payload);
        });
    }

    static async disconnect(socket) {
        const headers = SocketIOCall.getCustomHeaders(socket);
        // Lo saco de la lista en memoria
        await SocketIOCall.unregisterSocket(socket);
        SocketIOCall.io.to(headers.room).emit("removeUser", {
            socketId: socket.id
        });
    }

    static handle(io) {
        SocketIOCall.io = io;
        SocketIOCall.getFlowChartExec("processors").catch((err) => {
            console.log("Warning: flowchart capability not configured. " + err.message);
        });
        io.on("connection", SocketIOCall.connect);
        return () => { }
    }

    static async processorResponse(req, res, next) {
        const buffer = req.body;
        const decoded = decode(buffer);
        await new ProcessResponseProcessor(SocketIOCall, SocketIOCall.io, null).execute(decoded);
        res.status(200).send({
            status: "ok",
        });
    }

    static async loadFlowChart(req, res, next) {
        const buffer = req.body;
        await new LoadFlowChartProcessor(SocketIOCall, SocketIOCall.io, null).execute(buffer);
        if (buffer.autoStart === true) {
            new StartFlowChartProcessor(SocketIOCall, SocketIOCall.io, null).execute(buffer);
        }
        res.status(200).send({
            status: "ok",
        });
    }

    static async processorProcess(req, res, next) {
        console.log(`processorProcess...`);
        const buffer = req.body;

        let decoded = buffer;
        if (/\/processor_process$/.exec(req.path) != null) {
            decoded = decode(buffer);
        }
        //console.log(decoded);
        const { processorMethod, room, channel } = decoded;
        const parts = /(^[^\d\.]+)(\d*)\.(.*)$/.exec(processorMethod);
        if (!parts) {
            throw Error(`processorMethod ${processorMethod} does not matches /(^[^\d\.]+)(\d*)\.(.*)$/`);
        }
        const processor = parts[1];
        const instance = parts[2];
        decoded['method'] = parts[3];

        // Get socket destiny if channel is websocket
        let socketId = null;
        let postUrl = null;
        const processorsModel = SocketIOCall.getRoomLiveTupleModel("processors");
        if (channel == "websocket") {
            const path = `model.data.state.processors.${processor}.socket`;
            socketId = SimpleObj.getValue(processorsModel, path, null);
            if (!socketId) {
                throw Error(`Not processor with valid socketId for ${processor}`);
            }
        } else if (channel == "post") {
            const path = `model.data.state.processors.${processor}.postUrl`;
            postUrl = SimpleObj.getValue(processorsModel, path, null);
            if (!postUrl) {
                throw Error(`Not processor with postUrl for ${processor}`);
            }
        }

        // Complete data if room provided, room is optional
        if (room) {
            const allModel = SocketIOCall.getRoomLiveTupleModel(room);
            const pathData = `model.data.state.processors.${processor}.${instance}`;
            const temp = SimpleObj.getValue(allModel, pathData, null);
            if (decoded['data']) {
                if (temp) {
                    Object.assign(decoded['data'], temp);
                }
            } else {
                decoded['data'] = temp;
            }
        }

        const messageUID = IdGen.num2ord(new Date().getTime());

        if (!decoded['id']) {
            decoded['id'] = `${processorMethod}-${messageUID}`;
        }

        let promesa = Promise.resolve({});

        if (channel == "websocket") {
            promesa = new Promise((resolve, reject) => {
                const socket = SocketIOCall.socketIdToSocket[socketId];
                if (!socket) {
                    reject(`No socket with id ${socketId} for processor ${processor}`);
                }
                const listener = (valor) => {
                    if (valor.id == decoded['id']) {
                        socket.off("processResponse", listener);
                        resolve(valor);
                    }
                };
                socket.on("processResponse", listener);
            });
            SocketIOCall.io.to(socketId).emit("process", decoded);
        } else if (channel == "post") {
            const options = {
                maxBodyLength: Infinity,
                maxContentLength: Infinity,
                headers: { "Content-Type": "application/octet-stream" }
            };
            const encoded = encode(decoded);
            const buffer = Buffer.from(encoded);
            console.log(`POST to ${postUrl}...`);
            const temp = await axios.post(`${postUrl}/syncprocess`, buffer, options);
            console.log(`POST to ${postUrl}... OK!`);
            promesa = Promise.resolve({ data: temp.data });
        }


        const respuesta = await promesa;
        res.status(200).send({
            status: "ok",
            response: respuesta
        });
    }

    static async introspect(req, res, next) {
        const body = req.body;
        const rooms = Object.keys(SocketIOCall.roomLiveTupleModel);
        const path = `model.data.scope.progress`;
        const data = rooms.map((room) => {
            const modelo = SocketIOCall.roomLiveTupleModel[room];
            const progress = SimpleObj.getValue(modelo, path, null);
            return {
                room: room,
                percentage: progress
            };
        }).filter((data) => {
            return typeof data.percentage == "number" && ["processors", "public"].indexOf(data.room) < 0;
        });

        const response = {
            status: "ok",
            response: data
        };
        res.status(200).send(response);
    }
}