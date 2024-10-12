import { MyStore } from "./common/MyStore.mjs";
import { General } from "./common/General.mjs";
import axios from "axios";
import { ModuloDatoSeguroBack } from "../srcJs/ModuloDatoSeguroBack.mjs";

const MAX_READ_SIZE = 60;

const FACE_SERVER = process.env.FACE_SERVER;

export class MfaSrv {
    static async computeVector(req, res, next) {
        const imgId = General.readParam(req, "imgid");
        const url = `${FACE_SERVER}compute?imgid=${imgId}`;
        const responseRequest = await new Promise((resolve, reject) => {
            const options = {};
            axios.get(url, options)
                .then(res => {
                    resolve(res)
                })
                .catch(error => {
                    reject(Error(error.response.data))
                });
        });
        const response = responseRequest.data;
        res.status(200).send({
            status: "ok",
            response
        });
    }
    static async validateFace(req, res, next) {
        const base64 = General.readParam(req, "base64");
        const searchtype = General.readParam(req, "searchtype");
        const value = General.readParam(req, "value");
        const url = `${FACE_SERVER}validateface`;
        const responseRequest = await new Promise((resolve, reject) => {
            const options = {};
            axios.post(url, { base64, searchtype, value }, options)
                .then(res => { resolve(res) })
                .catch(error => {
                    reject(Error(error.response.data))
                });
        });
        const response = responseRequest.data;
        res.status(200).send({
            status: "ok",
            response
        });
    }
    static async save(req, res, next) {
        const token = res.locals.token;
        const AHORA = new Date().getTime();
        const image = General.readParam(req, "image");
        const pageId = req.params['pageId'];
        const pageType = "mfa";

        if (image instanceof Array) {
            for (let i = 0; i < image.length; i++) {
                const image1 = image[i];
                image1.author = token.email;
                image1.updated = AHORA;
                image1.pg = pageId;
                image1.pageType = pageType;
                MfaSrv.serializeImage(image1);
                if (image1.id) {
                    await MyStore.updateById("mfaimg", image1.id, image1);
                } else {
                    image1.created = AHORA;
                    await MyStore.create("mfaimg", image1);
                }
                MfaSrv.deserializeImage(image1);
            }
        } else {
            image.author = token.email;
            image.updated = AHORA;
            image.pg = pageId;
            image.pageType = pageType;
            MfaSrv.serializeImage(image);
            if (image.id) {
                await MyStore.updateById("mfaimg", image.id, image);
            } else {
                image.created = AHORA;
                await MyStore.create("mfaimg", image);
            }
            MfaSrv.deserializeImage(image);
        }

        res.status(200).send({
            status: "ok",
            image
        });
    }
    static serializeImage(image) {
        //
    }
    static deserializeImage(image) {
        //
    }
    static async validateuid(req, res, next) {
        const pageId = req.params['pageId'];
        const uid = General.readParam(req, "uid");
        const imgid = General.readParam(req, "imgid");
        const page = await MyStore.readById("page", pageId);
        const pass = page.pass;
        if (!pass) {
            throw Error("Primero debe generar las llaves secretas de la página");
        }
        let validated = false;
        try {
            const decifrado = ModuloDatoSeguroBack.decifrarSimple(uid, pass);
            const respuesta = /^(.{2})_([^_]*)_(.{2})$/.exec(decifrado);
            validated = (respuesta != null && respuesta[2] == imgid);
        } catch (err) { }
        res.status(200).send({
            status: "ok",
            validated,
        });
    }
    static async rotate(req, res, next) {
        const pageId = req.params['pageId'];
        const imgid = General.readParam(req, "imgid");
        const page = await MyStore.readById("page", pageId);
        const pass = page.pass;
        if (!pass) {
            throw Error("Primero debe generar las llaves secretas de la página");
        }
        const rand1 = ModuloDatoSeguroBack.generateKey(2);
        const rand2 = ModuloDatoSeguroBack.generateKey(2);
        const dato = `${rand1}_${imgid}_${rand2}`;
        const uid = ModuloDatoSeguroBack.cifrarSimple(dato, pass);
        // Guardo el uid
        await MyStore.updateById("mfaimg", imgid, { uid });
        res.status(200).send({
            status: "ok",
            uid,
        });
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
        const select = ["created", "updated", "author", "pg", "urlBig", "urlThumbnail", "name", "lastname", "idType", "uid", "face_confidence", "embedding_time"];
        response = await MyStore.paginate("mfaimg", [{ name: "created", dir: 'desc' }], offset, max, where, null, select);
        for (let i = 0; i < response.length; i++) {
            const image = response[i];
            MfaSrv.deserializeImage(image);
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
                    await MyStore.deleteById("mfaimg", image1.id);
                }
            }
        } else {
            await MyStore.deleteById("mfaimg", image.id);
        }

        res.status(200).send({
            status: "ok",
            image: []
        });
    }

    static async createUpdateEnrollmentLink(req, res, next) {
        const imgid = General.readParam(req, "imgid");
        const origin = General.readParam(req, "origin");
        const pageId = req.params['pageId'];
        const AHORA = new Date().getTime();

        let [mfaenrollment, image, page] = await Promise.all([
            MyStore.readById("mfaenrollment", imgid),
            MyStore.readById("mfaimg", imgid),
            MyStore.readById("page", pageId),
        ]);

        if (mfaenrollment) {
            mfaenrollment.created = AHORA;
            await MyStore.updateById("mfaenrollment", imgid, mfaenrollment);
        } else {
            mfaenrollment = {
                created: AHORA,
                name: `${image.name} ${image.lastname}`,
                id: imgid,
            };
            await MyStore.createById("mfaenrollment", imgid, mfaenrollment);
        }

        const cifrado = ModuloDatoSeguroBack.cifrar({ id: mfaenrollment.id, t: AHORA }, page.public2);

        const url = `${origin}/mfaenrollment/?pg=${pageId}&data=${cifrado}`;
        //const srv = `http://localhost:8081/srv/mfa/${pageId}/executeenrollment?pass=hey&data=${cifrado}`;

        res.status(200).send({
            status: "ok",
            mfaenrollment,
            url,
            //srv
        });
    }

    static async executeEnrollment(req, res, next) {
        const data = General.readParam(req, "data");
        const pass = General.readParam(req, "pass");
        const pageId = req.params['pageId'];
        const AHORA = new Date().getTime();
        const MAX_TIME = 1000 * 60 * 60 * 24 * 1;// 1 día

        if (!data) {
            throw Error("Err A");
        }

        if (!pass) {
            throw Error("Err Z");
        }

        const page = await MyStore.readById("page", pageId);
        if (!page) {
            throw Error("Err 0");
        }
        const decifrado = ModuloDatoSeguroBack.decifrar(data, page.private2);
        const imgid = decifrado.id;
        const t = decifrado.t;

        const mfaenrollment = await MyStore.readById("mfaenrollment", imgid);
        if (!mfaenrollment) {
            throw Error("Err 1");
        }
        if (mfaenrollment.created != t) {
            throw Error("Err B");
        }
        const difference = AHORA - mfaenrollment.created;
        if (difference > MAX_TIME) {
            throw Error("El enlace caducó, pide ayuda a soporte.");
        }

        await MyStore.runTransaction(async (firebaseInstance) => {
            await Promise.all([
                MyStore.updateById("mfaimg", imgid, { pass }, firebaseInstance),
                MyStore.deleteById("mfaenrollment", imgid, firebaseInstance),
            ]);
        });

        res.status(200).send({
            status: "ok",
        });
    }
}