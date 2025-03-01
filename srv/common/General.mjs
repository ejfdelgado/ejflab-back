import md5 from 'md5';
import { MalaPeticionException, ParametrosIncompletosException } from '../MyError.mjs';

export class General {
    static PAGE_SIZE_DEFAULT = "20";
    static PAGE_DIRECTION = "DESC";
    static DIRECTION_CHOICES = ["asc", "desc"];
    static readMaxOffset(req, MAX_READ_SIZE) {
        const offsetR = parseInt(General.readParam(req, "offset"));
        const maxR = parseInt(General.readParam(req, "max"));
        let offset = 0;
        if (!isNaN(offsetR)) {
            offset = Math.max(0, offsetR);
        }
        let max = 0;
        if (!isNaN(maxR)) {
            max = Math.min(MAX_READ_SIZE, maxR);
        }
        return {
            max,
            offset,
        };
    }
    static readParam(req, name, pred = null, complain = false) {
        const nameLower = name.toLowerCase();
        if (req.body && name in req.body) {
            return req.body[name];
        } else if (req.query && name in req.query) {
            return req.query[name];
        } else if (req.query && nameLower in req.query) {
            return req.query[nameLower];
        } else if (req.params && name in req.params) {
            return req.params[name];
        } else if (req.params && nameLower in req.params) {
            return req.params[nameLower];
        } else if (req.locals?.extra) {
            if (name in req.locals.extra) {
                return req.locals.extra[name];
            }
        }
        if (complain) {
            throw new ParametrosIncompletosException(`Parameter not found but required: ${name}`);
        }
        return pred;
    }
    static getSuffixPath(keyName, suffix) {
        const keyNameXs = keyName.replace(/^(.+)\.([^./]+)$/ig, `$1${suffix}.$2`);
        if (keyNameXs == keyName) {
            // fallback when no extension
            return keyName + suffix;
        }
        return keyNameXs;
    }
    static randomIntFromInterval(min, max) {
        return Math.floor(Math.random() * (max - min + 1) + min);
    }
    static toBase64(texto) {
        return Buffer.from(texto, 'utf8').toString('base64');
    }
    static fromBase64(texto) {
        return Buffer.from(texto, "base64").toString('utf8');
    }
    static getNameParts() {
        const ahora = new Date();
        const epochText = ahora.getTime() + "";
        return {
            year: ahora.getFullYear(),
            month: ('0' + (ahora.getMonth() + 1)).slice(-2),
            day: ('0' + ahora.getDate()).slice(-2),
            hours: ('0' + ahora.getHours()).slice(-2),
            minutes: ('0' + ahora.getMinutes()).slice(-2),
            seconds: ('0' + ahora.getSeconds()).slice(-2),
            millis: ('00' + ahora.getMilliseconds()).slice(-3),
            epoch: epochText,
            hash: md5(epochText),
        };
    }

    static getPaginationArguments(req, orderColumnDef = null) {
        const limit = parseInt(General.readParam(req, "limit", General.PAGE_SIZE_DEFAULT));
        const orderColumn = General.readParam(req, "orderColumn", orderColumnDef);
        const direction = General.readParam(req, "direction", General.PAGE_DIRECTION).toLowerCase();
        const page = parseInt(General.readParam(req, "page", null));
        const offsetProvided = parseInt(General.readParam(req, "offset", null));
        if (!(typeof limit == "number")) {
            throw new MalaPeticionException("limit is expected to be a number");
        }
        if (isNaN(page) && isNaN(offsetProvided)) {
            throw new MalaPeticionException("page or offset is expected to be a number");
        }
        if (General.DIRECTION_CHOICES.indexOf(direction) < 0) {
            throw new MalaPeticionException(`direction is expected to be one of ${General.DIRECTION_CHOICES.join(', ')}`);
        }
        return {
            limit,
            orderColumn,
            direction,
            page,
            offset: !isNaN(offsetProvided) ? offsetProvided : page * limit
        };
    }
}