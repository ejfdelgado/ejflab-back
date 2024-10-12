import { General } from "./common/General.mjs";
import { MyStore } from "./common/MyStore.mjs";
import { InstancesClient, ZoneOperationsClient } from '@google-cloud/compute'
import axios from "axios";
import MyDatesBack from "@ejfdelgado/ejflab-common/src/MyDatesBack.mjs";

const projectId = "ejfexperiments";
export const instancesMap = {
    "imagiation-worker-1": {
        name: "Entrenamiento de Detección de Imágenes - 4CPU virt (2 cores) 16G Mem",
        zone: "us-central1-c",
        workerType: 'predefined',
        url: "http://34.16.94.71/",
        state: null,// STOPPING -> TERMINATED -> PROVISIONING -> STAGING -> RUNNING
        stateDetail: null,
        log: [],
        price: 0.134012
    },
    "imagiation-worker-2": {
        name: "Entrenamiento de Detección de Imágenes - 8CPU virt (4 cores) 32G Mem",
        zone: "us-central1-c",
        workerType: 'paid1',
        url: "http://104.198.166.155/",
        state: null,// STOPPING -> TERMINATED -> PROVISIONING -> STAGING -> RUNNING
        stateDetail: null,
        log: [],
        price: 0.28
    },
    "local": {
        name: "Entrenamiento de Detección de Imágenes - Local",
        zone: "local",
        workerType: 'local',
        url: "http://localhost:8080/",
        state: "RUNNING",
        stateDetail: null,
        log: [],
        price: 0
    },
};

export class ComputeEngineSrv {
    static async startJobExecution(instanceUrl, job) {
        const url = `${instanceUrl}train_mock?job=${job.id}`;
        const responseRequest = await new Promise((resolve, reject) => {
            const options = {};
            axios.get(url, options)
                .then(res => { resolve(res) })
                .catch(error => { reject(error) });
        });
        const response = responseRequest.data;
        return response;
    }
    static async executeJobQueuee(instanceName, instancesClient = null) {
        // Tomar el job más viejito en pending asociado a la instancia workerType que pasen por parámetro
        // order by created asc, jobType == imagiation-worker-1 [0]
        const ref = instancesMap[instanceName];
        const localres = {
            message: "",
        };
        if (ref) {
            const estadoActualPromise = ComputeEngineSrv.getCurrentInstanceStatus(instanceName, instancesClient);
            estadoActualPromise.catch(err => { });
            const where = [
                { key: "workerType", oper: "==", value: ref.workerType },
                { key: "state", oper: "==", value: "pending" },
            ];
            const offset = 0;
            const max = 1;
            const jobs = await MyStore.paginate("imagiationjob", [{ name: "created", dir: 'asc' }], offset, max, where);
            const tamanio = jobs.length;

            // Leer el estado del job
            try {
                const estadoActual = await estadoActualPromise;
                localres.health = estadoActual;
                localres.message = "";
                if (tamanio == 0) {
                    // Si no hay nada, leer el estado del job, si el job está sin tareas, terminar.
                    if (estadoActual.state == "RUNNING") {
                        if (estadoActual.stateDetail.state == "free" && estadoActual.stateDetail.currentJobs == 0) {
                            if (instanceName != "local") {
                                localres.message = `${instanceName} sin tareas pendientes por lanzar y sin ejecuciones en curso, DETENER!`;
                            }
                            await ComputeEngineSrv.stopInstanceRaw(instanceName, instancesClient);
                        } else {
                            //localres.message = `${instanceName} en ${estadoActual.state} y current running tasks ${estadoActual.stateDetail.currentJobs}`;
                        }
                    }
                } else {
                    // Leer la instancia asociada a ese job
                    const job = jobs[0];
                    if (estadoActual.state == "RUNNING") {
                        const tieneCapacidad = (estadoActual.stateDetail.currentJobs < estadoActual.stateDetail.maxJobs);
                        if (tieneCapacidad) {
                            localres.message = `${instanceName} lanzando job ${job.id}`;
                            // Si es running y si tiene capacidad -> ejecutar job.id
                            await ComputeEngineSrv.startJobExecution(estadoActual.url, job);
                        } else {
                            // Si es running y no tiene capacidad -> ignorar
                            localres.message = `${instanceName} ejecutando ${estadoActual.stateDetail.currentJobs}/${estadoActual.stateDetail.maxJobs}`;
                        }
                    } else {
                        // Si es TERMINATED solo intentar lanzar y ya.
                        if (estadoActual.state == "TERMINATED") {
                            localres.message = `${instanceName} encendiendo!`;
                            await ComputeEngineSrv.startInstanceRaw(instanceName, instancesClient);
                        } else {
                            localres.message = `${instanceName} en ${estadoActual.state}`;
                        }
                    }
                }
            } catch (err) {
                localres.message = err.message;
            }
        } else {
            localres.message = `La cola de ejecución ${instanceName} no existe`;
        }

        // Se complementa con la fecha
        if (localres.message.length > 0) {
            localres.message = "[" + MyDatesBack.formatDateCompleto(new Date()) + "] " + localres.message;
            ref.log.unshift(localres.message);
            // Limit
            const MAX_LINES = 50;
            if (ref.log.length > MAX_LINES) {
                ref.log.splice(MAX_LINES, 1);
            }
        }
        return localres;
    }
    static async getCurrentInstanceStatus(instanceName, instancesClient = null) {
        const ref = instancesMap[instanceName];
        if (ref) {
            if (instanceName != "local") {
                if (!instancesClient) {
                    instancesClient = new InstancesClient();
                }
                const zone = ref.zone;
                const [instance] = await instancesClient.get({
                    project: projectId,
                    zone,
                    instance: instanceName,
                });
                const status = instance.status;
                ref.state = status;
            }
            let responseRequest = {};
            if (ref.state == "RUNNING") {
                // Ask server state
                const url = `${ref.url}ping`;
                responseRequest = await new Promise((resolve, reject) => {
                    const options = {};
                    axios.get(url, options)
                        .then(res => { resolve(res) })
                        .catch(error => { reject(error) });
                });
                const response = responseRequest.data;
                ref.stateDetail = response;
            } else {
                ref.stateDetail = null;
            }
            return ref;
        }
        return null;
    }
    static async stopInstanceRaw(instanceName, instancesClient = null) {
        if (instanceName == "local") {
            return;
        }
        const ref = instancesMap[instanceName];
        if (ref) {
            if (!instancesClient) {
                instancesClient = new InstancesClient();
            }
            const zone = ref.zone;
            const [instance] = await instancesClient.get({
                project: projectId,
                zone,
                instance: instanceName,
            });
            const status = instance.status;
            if (status !== "RUNNING") {
                throw new Error(`No se puede detener una instancia en estado diferente a RUNNING, actualmente es ${status}`);
            }
            const [response] = await instancesClient.stop({
                project: projectId,
                zone,
                instance: instanceName,
            });
            let operation = response.latestResponse;
            const operationsClient = new ZoneOperationsClient();
            //console.log(`operation.status = ${operation.status}`);
            // Wait for the operation to complete.
            while (operation.status !== 'DONE') {
                [operation] = await operationsClient.wait({
                    operation: operation.name,
                    project: projectId,
                    zone: operation.zone.split('/').pop(),
                });
                //console.log(`operation.status = ${operation.status}`);
            }
        }
    }
    static async startInstanceRaw(instanceName, instancesClient = null) {
        if (instanceName == "local") {
            return;
        }
        const ref = instancesMap[instanceName];
        if (ref) {
            if (!instancesClient) {
                instancesClient = new InstancesClient();
            }
            const zone = ref.zone;
            const [instance] = await instancesClient.get({
                project: projectId,
                zone,
                instance: instanceName,
            });
            const status = instance.status;
            if (status !== "TERMINATED") {
                throw new Error(`No se puede iniciar una instancia en estado diferente a TERMINATED, actualmente es ${status}`);
            }
            const [response] = await instancesClient.start({
                project: projectId,
                zone,
                instance: instanceName,
            });
            let operation = response.latestResponse;
            const operationsClient = new ZoneOperationsClient();
            //console.log(`operation.status = ${operation.status}`);
            // Wait for the operation to complete.
            while (operation.status !== 'DONE') {
                [operation] = await operationsClient.wait({
                    operation: operation.name,
                    project: projectId,
                    zone: operation.zone.split('/').pop(),
                });
                //console.log(`operation.status = ${operation.status}`);
            }
        }
    }
    static async startInstance(req, res, next) {
        const image = General.readParam(req, "name");
        const instancesClient = new InstancesClient();
        await ComputeEngineSrv.startInstanceRaw(image, instancesClient);
        const response = {
            status: "ok",
            image
        };
        res.status(200).send(response);
    }
    static async stopInstance(req, res, next) {
        const image = General.readParam(req, "name");
        const instancesClient = new InstancesClient();
        await ComputeEngineSrv.stopInstanceRaw(image, instancesClient);
        const response = {
            status: "ok",
            image
        };
        res.status(200).send(response);
    }
    static async getStatus(req, res, next) {
        const image = General.readParam(req, "name");
        const instancesClient = new InstancesClient();
        const status = await ComputeEngineSrv.getCurrentInstanceStatus(image, instancesClient);
        const response = {
            status: "ok",
            status
        };
        res.status(200).send(response);
    }
    static async iterate(req, res, next) {
        const image = General.readParam(req, "name");
        const instancesClient = new InstancesClient();
        const status = await ComputeEngineSrv.executeJobQueuee(image, instancesClient);
        const response = {
            status: "ok",
            status
        };
        res.status(200).send(response);
    }
    static async readAllInstances(req, res, next) {
        const response = {
            status: "ok",
            map: instancesMap,
        };
        res.status(200).send(response);
    }
}