import { MyStore } from "./common/MyStore.mjs";
import { General } from "./common/General.mjs";
import axios from "axios";

const MAX_READ_SIZE = 60;
const FACE_SERVER = process.env.FACE_SERVER;

export class AudIASrv {
    static async save(req, res, next) {
        const token = res.locals.token;
        const AHORA = new Date().getTime();
        const audio = General.readParam(req, "audio");
        const pageId = req.params['pageId'];
        const pageType = "audia";

        if (audio instanceof Array) {
            for (let i = 0; i < audio.length; i++) {
                const audio1 = audio[i];
                audio1.author = token.email;
                audio1.updated = AHORA;
                audio1.pg = pageId;
                audio1.pageType = pageType;
                AudIASrv.serializeImage(audio1);
                if (audio1.id) {
                    await MyStore.updateById("audia", audio1.id, audio1);
                } else {
                    audio1.created = AHORA;
                    await MyStore.create("audia", audio1);
                }
                AudIASrv.deserializeImage(audio1);
            }
        } else {
            audio.author = token.email;
            audio.updated = AHORA;
            audio.pg = pageId;
            audio.pageType = pageType;
            AudIASrv.serializeImage(audio);
            if (audio.id) {
                await MyStore.updateById("audia", audio.id, audio);
            } else {
                audio.created = AHORA;
                await MyStore.create("audia", audio);
            }
            AudIASrv.deserializeImage(audio);
        }

        res.status(200).send({
            status: "ok",
            audio
        });
    }
    static serializeImage(audio) {
        //
    }
    static deserializeImage(audio) {
        //
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
        response = await MyStore.paginate("audia", [{ name: "created", dir: 'desc' }], offset, max, where);
        for (let i = 0; i < response.length; i++) {
            const audio = response[i];
            AudIASrv.deserializeImage(audio);
        }
        res.status(200).send({
            status: "ok",
            audios: response,
        });
    }
    static async delete(req, res, next) {
        const audio = General.readParam(req, "audio");

        if (audio instanceof Array) {
            for (let i = 0; i < audio.length; i++) {
                if (audio1.id) {
                    await MyStore.deleteById("audia", audio1.id);
                }
            }
        } else {
            await MyStore.deleteById("audia", audio.id);
        }

        res.status(200).send({
            status: "ok",
            audio: []
        });
    }

    static async characterizeVoice(req, res, next) {
        const sound = General.readParam(req, "sound");
        //console.log(`characterizeVoice ${JSON.stringify(sound)}`);
        const url = `${FACE_SERVER}characterize_voice`;
        //console.log(`calling ${url}`);
        const responseRequest = await new Promise((resolve, reject) => {
            const options = {};
            axios.post(url, sound, options)
                .then(res => { resolve(res) })
                .catch(error => {
                    reject(Error(error.response.data))
                });
        });
        const response = responseRequest.data;

        // write it to current sound
        const embed = response.out?.embed;
        if (embed) {
            await MyStore.updateById("audia", sound.id, { embed });
        }

        res.status(200).send({
            status: "ok",
            response: { embed }
        });
    }

    static async tagsSave(req, res, next) {
        const pageId = req.params['pageId'];
        const classes = General.readParam(req, "classes");
        await MyStore.updateOrCreateById("audiaclass", pageId, { txt: JSON.stringify(classes) });
        res.status(200).send({
            status: "ok",
        });
    }

    static async tagsRead(req, res, next) {
        const pageId = req.params['pageId'];
        let existente = await MyStore.readById("audiaclass", pageId);
        if (!existente) {
            existente = { txt: "[]" };
            await MyStore.createById("audiaclass", pageId, existente);
        }
        // Se tumba el id si está
        // delete existente.id;
        const actual = JSON.parse(existente.txt);
        res.status(200).send({
            status: "ok",
            classes: actual,
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
            const old = await MyStore.readById("audiajob", job.id);
            if (old.state != 'pending') {
                throw new Error("No se puede hacer la modificación");
            }
            job.pageType = pageType;
            job.updated = AHORA;
            await MyStore.updateById("audiajob", job.id, job);
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
            await MyStore.create("audiajob", job);
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
        response = await MyStore.paginate("audiajob", [{ name: "created", dir: 'desc' }], offset, max, where);
        res.status(200).send({
            status: "ok",
            jobs: response,
        });
    }

    static async jobRead(req, res, next) {
        const jobId = General.readParam(req, "jobId");
        const response = await MyStore.readById("audiajob", jobId);
        const jobs = [];
        if (response) {
            jobs.push(response);
        }
        res.status(200).send({
            status: "ok",
            jobs,
        });
    }
}