
import { MyDates } from "../srcJs/MyDates.js";
import { ModuloDatoSeguro } from "../srcJs/ModuloDatoSeguro.js";
import { General } from "./common/General.mjs";
import { MyStore } from "./common/MyStore.mjs";
import { ModuloDatoSeguroBack } from "../srcJs/ModuloDatoSeguroBack.mjs";

const KEYS_TYPE = "page-key";
const DEFAULT_KEY_SIZE = 10;

export class KeysSrv {
    static async getOrGeneratePageKeys(pageId) {
        // Cada página debe tener algo como esto:
        const {
            actual,
            siguiente,
            anterior,
        } = MyDates.getDates();

        // Busco el registro por pageId
        const response = await MyStore.readById(KEYS_TYPE, pageId);
        const payload = {};
        if (!response) {
            // Toca crearlo desde ceros todo
            payload[actual] = ModuloDatoSeguro.generateKey(DEFAULT_KEY_SIZE);
            payload[siguiente] = ModuloDatoSeguro.generateKey(DEFAULT_KEY_SIZE);
            payload[anterior] = ModuloDatoSeguro.generateKey(DEFAULT_KEY_SIZE);
            await MyStore.createById(KEYS_TYPE, pageId, payload);
        } else {
            payload[actual] = response[actual];
            payload[siguiente] = response[siguiente];
            payload[anterior] = response[anterior];
            let modificado = false;
            if (!(actual in payload) || !payload[actual]) {
                payload[actual] = ModuloDatoSeguro.generateKey(DEFAULT_KEY_SIZE);
                modificado = true;
            }
            if (!(siguiente in payload) || !payload[siguiente]) {
                payload[siguiente] = ModuloDatoSeguro.generateKey(DEFAULT_KEY_SIZE);
                modificado = true;
            }
            if (!(anterior in payload) || !payload[anterior]) {
                payload[anterior] = ModuloDatoSeguro.generateKey(DEFAULT_KEY_SIZE);
                modificado = true;
            }
            if (modificado) {
                await MyStore.updateById(KEYS_TYPE, pageId, payload);
            }
        }
        return payload;
    }

    static async cifrar(objeto, pageId) {
        const llavero = await KeysSrv.getOrGeneratePageKeys(pageId);
        const actual = MyDates.getDayAsContinuosNumber(new Date());
        const pass = llavero[actual];
        const resultado = ModuloDatoSeguroBack.cifrarSimple(objeto, pass);
        return resultado;
    }

    static async decifrar(texto, pageId) {
        const llavero = await KeysSrv.getOrGeneratePageKeys(pageId);
        const {
            actual,
            siguiente,
            anterior,
        } = MyDates.getDates();
        let resultado = undefined;
        const llaves = [];
        llaves.push(llavero[actual]);
        llaves.push(llavero[anterior]);
        llaves.push(llavero[siguiente]);
        for (let i = 0; i < llaves.length; i++) {
            const llave = llaves[i];
            try {
                resultado = ModuloDatoSeguroBack.decifrarSimple(texto, llave);
            } catch (e) {

            }
        }
        return resultado;
    }

    static async getPageKeys(req, res, next) {
        const pageId = req.params['pageId'];
        const llavero = await KeysSrv.getOrGeneratePageKeys(pageId);
        res.status(200).send(llavero);
    }

    static async cifrarWeb(req, res, next) {
        const key = General.readParam(req, "key");
        const payload = General.readParam(req, "payload");
        const resultado = ModuloDatoSeguroBack.cifrarSimple(payload, key);
        console.log(resultado);
        res.status(200).send(resultado);
    }

    static async decifrarWeb(req, res, next) {
        const key = General.readParam(req, "key");
        const payload = General.readParam(req, "payload");
        const resultado = ModuloDatoSeguroBack.decifrarSimple(payload, key);
        res.status(200).send(resultado);
    }
}
