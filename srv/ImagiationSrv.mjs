import { MyStore } from "./common/MyStore.mjs";
import { General } from "./common/General.mjs";
import axios from "axios";

const MAX_READ_SIZE = 60;

export class ImagiationSrv {
    static async save(req, res, next) {
        const token = res.locals.token;
        const AHORA = new Date().getTime();
        const image = General.readParam(req, "image");
        const pageId = req.params['pageId'];
        const pageType = "imagiation";

        if (image instanceof Array) {
            for (let i = 0; i < image.length; i++) {
                const image1 = image[i];
                image1.author = token.email;
                image1.updated = AHORA;
                image1.pg = pageId;
                image1.pageType = pageType;
                ImagiationSrv.serializeImage(image1);
                if (image1.id) {
                    await MyStore.updateById("imagiationimg", image1.id, image1);
                } else {
                    image1.created = AHORA;
                    await MyStore.create("imagiationimg", image1);
                }
                ImagiationSrv.deserializeImage(image1);
            }
        } else {
            image.author = token.email;
            image.updated = AHORA;
            image.pg = pageId;
            image.pageType = pageType;
            ImagiationSrv.serializeImage(image);
            if (image.id) {
                await MyStore.updateById("imagiationimg", image.id, image);
            } else {
                image.created = AHORA;
                await MyStore.create("imagiationimg", image);
            }
            ImagiationSrv.deserializeImage(image);
        }

        res.status(200).send({
            status: "ok",
            image
        });
    }
    static serializeImage(image) {
        const tags = image.tags;
        const nuevo = [];
        for (let i = 0; i < tags.length; i++) {
            const tag = tags[i];
            for (let j = 0; j < tag.length; j++) {
                nuevo.push(tag[j]);
            }
        }
        image.tags = nuevo;
    }
    static deserializeImage(image) {
        const tags = image.tags;
        const nuevo = [];
        const total = Math.floor(tags.length / 5);
        for (let i = 0; i < total; i++) {
            nuevo.push([tags[5 * i], tags[5 * i + 1], tags[5 * i + 2], tags[5 * i + 3], tags[5 * i + 4]]);
        }
        image.tags = nuevo;
    }
    static async read(req, res, next) {
        const { max, offset } = General.readMaxOffset(req, MAX_READ_SIZE);
        const max_date = parseInt(General.readParam(req, "max_date", 0));
        const min_date = parseInt(General.readParam(req, "min_date", 0));
        let response = [];
        const pageId = req.params['pageId'];
        // Se debe realizar la lectura como tal
        const where = [
            { key: "pg", oper: "==", value: pageId },
        ];
        if (!isNaN(max_date) && max_date > 0) {
            where.push({ key: "created", oper: "<=", value: max_date });
        }
        if (!isNaN(min_date) && min_date > 0) {
            where.push({ key: "created", oper: ">=", value: min_date });
        }
        response = await MyStore.paginate("imagiationimg", [{ name: "created", dir: 'desc' }], offset, max, where);
        for (let i = 0; i < response.length; i++) {
            const image = response[i];
            ImagiationSrv.deserializeImage(image);
        }
        res.status(200).send({
            status: "ok",
            images: response,
        });
    }
    static async delete(req, res, next) {
        const image = General.readParam(req, "image");

        if (image instanceof Array) {
            for (let i = 0; i < image.length; i++) {
                if (image1.id) {
                    await MyStore.deleteById("imagiationimg", image1.id);
                }
            }
        } else {
            await MyStore.deleteById("imagiationimg", image.id);
        }

        res.status(200).send({
            status: "ok",
            image: []
        });
    }

    static async tagsSave(req, res, next) {
        const pageId = req.params['pageId'];
        const tag = General.readParam(req, "tag");
        await MyStore.updateOrCreateById("imagiationtag", pageId, { txt: JSON.stringify(tag) });
        res.status(200).send({
            status: "ok",
        });
    }

    static async tagsRead(req, res, next) {
        const pageId = req.params['pageId'];
        let existente = await MyStore.readById("imagiationtag", pageId);
        if (!existente) {
            existente = { txt: "{}" };
            await MyStore.createById("imagiationtag", pageId, existente);
        }
        // Se tumba el id si está
        delete existente.id;

        const actual = JSON.parse(existente.txt);
        const keys = Object.keys(actual);
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const val = actual[key];
            if (typeof val == "string") {
                actual[key] = { txt: val, ref: null };
            }
        }
        res.status(200).send({
            status: "ok",
            tag: actual,
        });
    }

    static async jobsSave(req, res, next) {
        const token = res.locals.token;
        const AHORA = new Date().getTime();
        const pageId = req.params['pageId'];
        const pageType = req.params['pageType'];
        const job = General.readParam(req, "job");
        if (job.id) {
            // Primero se lee el estado
            const old = await MyStore.readById("imagiationjob", job.id);
            if (old.state != 'pending') {
                throw new Error("No se puede hacer la modificación");
            }
            job.pageType = pageType;
            job.updated = AHORA;
            await MyStore.updateById("imagiationjob", job.id, job);
        } else {
            job.pageType = pageType;
            job.pg = pageId;
            job.created = AHORA;
            job.updated = AHORA;
            job.state = 'pending';
            job.progress = 0;
            job.owner = token.email;
            if (!job.workerType) {
                job.workerType = 'predefined';
            }
            job.started = 0;
            await MyStore.create("imagiationjob", job);
        }

        res.status(200).send({
            status: "ok",
            jobs: [job],
        });
    }

    static async jobsRead(req, res, next) {
        const { max, offset } = General.readMaxOffset(req, MAX_READ_SIZE);
        let response = [];
        const pageId = req.params['pageId'];
        // Se debe realizar la lectura como tal
        const where = [
            { key: "pg", oper: "==", value: pageId },
        ];
        response = await MyStore.paginate("imagiationjob", [{ name: "created", dir: 'desc' }], offset, max, where);
        res.status(200).send({
            status: "ok",
            jobs: response,
        });
    }

    static async jobRead(req, res, next) {
        const jobId = General.readParam(req, "jobId");
        const response = await MyStore.readById("imagiationjob", jobId);
        const jobs = [];
        if (response) {
            jobs.push(response);
        }
        res.status(200).send({
            status: "ok",
            jobs,
        });
    }

    static serializeModel(model) {
        const configs = model.configs;
        if (configs) {
            for (let i = 0; i < configs.length; i++) {
                configs[i] = JSON.stringify(configs[i]);
            }
        } else {
            model.configs = [];
        }
        return model;
    }

    static deserializeModel(model) {
        const configs = model.configs;
        if (configs) {
            for (let i = 0; i < configs.length; i++) {
                configs[i] = JSON.parse(configs[i]);
            }
        } else {
            model.configs = [];
        }
        return model;
    }

    static async confSave(req, res, next) {
        const token = res.locals.token;
        const AHORA = new Date().getTime();
        const pageId = req.params['pageId'];
        const pageType = req.params['pageType'];
        let conf = General.readParam(req, "conf");
        conf = ImagiationSrv.serializeModel(conf);
        if (conf.id) {
            conf.pageType = pageType;
            conf.updated = AHORA;
            await MyStore.updateById("imagiationconf", conf.id, conf);
        } else {
            // No existe
            conf.pageType = pageType;
            conf.pg = pageId;
            conf.created = AHORA;
            conf.updated = AHORA;
            conf.owner = token.email;
            await MyStore.create("imagiationconf", conf);
        }

        res.status(200).send({
            status: "ok",
            confs: [ImagiationSrv.deserializeModel(conf)],
        });
    }

    static async confsRead(req, res, next) {
        const { max, offset } = General.readMaxOffset(req, MAX_READ_SIZE);
        let response = [];
        const pageId = req.params['pageId'];
        // Se debe realizar la lectura como tal
        const where = [
            { key: "pg", oper: "==", value: pageId },
        ];
        response = await MyStore.paginate("imagiationconf", [{ name: "created", dir: 'desc' }], offset, max, where);
        response = response.map((elem) => {
            return ImagiationSrv.deserializeModel(elem);
        });
        res.status(200).send({
            status: "ok",
            confs: response,
        });
    }

    static async confRead(req, res, next) {
        const confId = General.readParam(req, "confId");
        const response = await MyStore.readById("imagiationconf", confId);
        const confs = [];
        if (response) {
            confs.push(ImagiationSrv.deserializeModel(response));
        }
        res.status(200).send({
            status: "ok",
            confs,
        });
    }

    static async confDelete(req, res, next) {
        const confId = General.readParam(req, "confId");
        const response = await MyStore.deleteById("imagiationconf", confId);
        res.status(200).send({
            status: "ok",
        });
    }

    static serializeStatistic(stat) {
        const respuesta = {
            founds: []
        };
        for (let i = 0; i < stat.length; i++) {
            const valor = stat[i];
            const name = `count_${valor.name}`;
            if (!(name in respuesta)) {
                respuesta[name] = 1;
                respuesta.founds.push(valor.name);
            } else {
                respuesta[name] += 1;
            }
        }
        return respuesta;
    }

    static deserializeStatistic(stat) {
        const founds = stat.founds;
        const mapa = {};
        for (let i = 0; i < founds.length; i++) {
            const name = founds[i];
            if (!(name in mapa)) {
                mapa[name] = { count: 0 };
            }
            const conteoActual = stat[`count_${name}`];
            mapa[name].count += conteoActual;
        }
        stat.founds = mapa;
    }

    static async storeStatistic(req, res, next) {
        const AHORA = new Date().getTime();
        const confId = General.readParam(req, "confId");
        const pageId = req.params['pageId'];
        const data = General.readParam(req, "data");

        // De la configuración saco el nombre
        const conf = await MyStore.readById("imagiationconf", confId);
        if (!conf) {
            throw Error("No conf");
        }
        const stat = ImagiationSrv.serializeStatistic(data.list);
        const statExtra = {
            t: AHORA,
            pg: pageId,
            confId,
            confName: conf.name,
            lat: data.lat,
            lon: data.lon,
            geohashs: data.geohashs,
            geohash7: data.geohash7,
            geohash8: data.geohash8,
            big: data.uri,
            thumb: data.uri.replace(/^(.*)\.([^\.]+)/, "$1_xs.$2")
        };
        // Eventualmente la lat y lon de la configuración si no vienen
        if (!(statExtra.lat) && !(statExtra.lat)) {
            statExtra.lat = conf.lat;
            statExtra.lon = conf.lon;
        }
        Object.assign(stat, statExtra);
        await MyStore.create("imagiationstat", stat);
        res.status(200).send({
            status: "ok",
        });
    }

    static async pageStatistics(req, res, next) {
        const { max, offset } = General.readMaxOffset(req, MAX_READ_SIZE);
        const max_date = parseInt(General.readParam(req, "max_date", 0));
        const min_date = parseInt(General.readParam(req, "min_date", 0));
        let response = [];
        const pageId = req.params['pageId'];
        // Se debe realizar la lectura como tal
        const where = [
            { key: "pg", oper: "==", value: pageId },
        ];
        if (!isNaN(max_date) && max_date > 0) {
            where.push({ key: "t", oper: "<=", value: max_date });
        }
        if (!isNaN(min_date) && min_date > 0) {
            where.push({ key: "t", oper: ">=", value: min_date });
        }
        response = await MyStore.paginate("imagiationstat", [{ name: "t", dir: 'desc' }], offset, max, where);
        /*
        for (let i = 0; i < response.length; i++) {
            const image = response[i];
            ImagiationSrv.deserializeStatistic(image);
        }
        */
        res.status(200).send({
            status: "ok",
            images: response,
        });
    }

    static async statDelete(req, res, next) {
        const statId = General.readParam(req, "statId");
        const response = await MyStore.deleteById("imagiationstat", statId);
        res.status(200).send({
            status: "ok",
        });
    }
}