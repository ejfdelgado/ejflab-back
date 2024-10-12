import { MyRoutes } from "../srcJs/MyRoutes.js";
import { ModuloDatoSeguroBack } from "../srcJs/ModuloDatoSeguroBack.mjs";
import { General } from "./common/General.mjs";
import { MyStore } from "./common/MyStore.mjs";
import { Utilidades } from "./common/Utilidades.mjs";

const SECRET_TYPE = "secret";

export class SecretsSrv {
    static masterName = "dont_use";
    static masterPub = "key_pub";
    static masterPri = "key_pri";
    static async getMasterKey(prefix) {
        let response = null;
        const dbData = await MyStore.readById(SECRET_TYPE, prefix + SecretsSrv.masterName);
        if (dbData == undefined) {
            // Debe crear una llave, guardarla y retornarla
            response = ModuloDatoSeguroBack.generateKey(10);
            await MyStore.createById(SECRET_TYPE, prefix + SecretsSrv.masterName, { val: response });
        } else {
            response = dbData.val;
        }
        let changed = "";
        const intermediate = `${process.env.SPAN}`;
        for (let i = 0; i < response.length; i++) {
            const car = intermediate[i % intermediate.length];
            changed += `${response[i]}${car}`;
        }
        return changed;
    }
    // SecretsSrv.localRead(["llave1", "llave2"], "edelgado@panal.co+");
    // {mapa: {llave1: "XXXXX", llave2: undefined}, lista: [{key: "llave1", val: "XXXXX"}, undefined]}
    static async localRead(arg, prefix) {
        const master = await SecretsSrv.getMasterKey(prefix);
        const argsPrefix = arg.map(v => prefix + v);
        const response = await MyStore.readByIds(SECRET_TYPE, argsPrefix);
        const lista = [];
        const mapa = {};
        for (let i = 0; i < argsPrefix.length; i++) {
            const key = argsPrefix[i];
            if (key in response) {
                const payload = response[key];
                const one = { key: arg[i] };
                one.val = ModuloDatoSeguroBack.decifrarSimple(payload.val, master);
                lista.push(one);
                mapa[one.key] = one.val;
            } else {
                lista.push(undefined);
                mapa[arg[i]] = undefined;
            }
        }
        return {
            lista,
            arg,
            master,
            mapa,
        };
    }
    // SecretsSrv.localSave({"llave1": "secreto"}, "edelgado@panal.co+");
    static async localSave(arg, prefix) {
        const master = await SecretsSrv.getMasterKey(prefix);
        const keys = Object.keys(arg);
        const promises = [];
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            let secreto = arg[key];
            secreto = ModuloDatoSeguroBack.cifrarSimple(secreto, master);
            promises.push(MyStore.createById(SECRET_TYPE, prefix + key, { val: secreto }));
        }
        await Promise.all(promises);
        return {
            arg,
            master
        };
    }
    static generateOldPrefix(req, res) {
        const elpath = Utilidades.leerRefererPath(req);
        const partes = MyRoutes.splitPageData(elpath);
        const token = res.locals.token;
        return `${token.email}${partes.pageType}/`;
    }
    static generatePrefix(req, res) {
        const token = res.locals.token;
        return `${token.email}+`;
    }
    static async read(req, res, next) {
        const ans = {};
        ans.keys = General.readParam(req, "key");
        const prefix = SecretsSrv.generatePrefix(req, res);
        const response = await SecretsSrv.localRead(ans.keys, prefix);
        Object.assign(ans, response);
        res.status(200).json(ans.lista).end();
    }
    static async save(req, res, next) {
        const ans = {};
        ans.map = General.readParam(req, "map");
        const prefix = SecretsSrv.generatePrefix(req, res);
        const response = await SecretsSrv.localSave(ans.map, prefix);
        Object.assign(ans, response);
        res.status(200).json(Object.keys(ans.map).length).end();
    }
    static async getPubKey(req, res, next) {
        const ans = {};
        const myKeys = [
            SecretsSrv.masterPub,
            SecretsSrv.masterPri
        ];
        const prefix = SecretsSrv.generatePrefix(req, res);
        const dbData = await SecretsSrv.localRead(myKeys, prefix);
        if (dbData[0] == undefined || dbData[1] == undefined) {
            // Debe crear una llave, guardarla y retornarla
            const pair = ModuloDatoSeguroBack.generateKeyPair();
            const myMap = {};
            myMap[SecretsSrv.masterPub] = pair.public;
            myMap[SecretsSrv.masterPri] = pair.private;
            const response = await SecretsSrv.localSave(myMap, prefix);
            console.log("response=" + JSON.stringify(response));
        } else {
            const cipherPub = dbData[myKeys[0]];
            const cipherPri = dbData[myKeys[1]];
            console.log("cipherPub=" + JSON.stringify(cipherPub));
            console.log("cipherPri=" + JSON.stringify(cipherPri));
        }
        res.status(200).json(ans).end();
    }
}