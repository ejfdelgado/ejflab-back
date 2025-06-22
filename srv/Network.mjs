import md5 from "md5";
import { Buffer } from "buffer";
import { MyError } from "./MyError.mjs";

function stringify(circ) {
    var cache = [];
    const text = JSON.stringify(circ, (key, value) => {
        if (typeof value === 'object' && value !== null) {
            if (cache.includes(value)) return;
            cache.push(value);
        }
        return value;
    });
    cache = null;
    return text;
};

function corsCustomDomains(allowedOrigins = []) {
    return (req, res, next) => {
        const origin = req.headers.origin;
        if (req.method == 'OPTIONS') {
            if (allowedOrigins.includes(origin)) {
                res.setHeader('Access-Control-Allow-Origin', origin);
            }
            res.setHeader('Access-Control-Allow-Methods', 'POST, GET, PUT, DELETE');
            res.setHeader('Access-Control-Allow-Headers', '*');
            res.setHeader('Access-Control-Max-Age', '3600');
            res.status(204).send('');
        } else {
            if (allowedOrigins.includes(origin)) {
                res.setHeader('Access-Control-Allow-Origin', origin);
            }
            next();
        }
    }
}

function cors(req, res, next) {
    if (req.method == 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, GET, PUT, DELETE');
        res.setHeader('Access-Control-Allow-Headers', '*');
        res.setHeader('Access-Control-Max-Age', '3600');
        res.status(204).send('');
    } else {
        res.setHeader('Access-Control-Allow-Origin', '*');
        next();
    }
}

async function commonHeaders(req, res, next) {
    res.setHeader('Content-Type', 'application/json');
    await next();
}

function getVerifyKey(body, sometime) {
    return md5(Buffer.from(md5(body) + sometime).toString("base64"));
}

async function verifyConstant(req, res, next) {
    const verifyHeader = req.headers["x-constant"];
    const someTimeHeader = req.headers["x-mytime"];
    const reqBody = req.body;
    const calculado = getVerifyKey(JSON.stringify(reqBody), someTimeHeader);
    if (verifyHeader != calculado) {
        res.status(403).send({ message: "Operación no permitida" });
    } else {
        await next();
    }
}

function urlNorFound(req, res, next) {
    res.status(404).send("Sorry can't find that!");
}

function getEnvVariables() {
    return {
        GAE_APPLICATION: process.env.GAE_APPLICATION,
        GAE_DEPLOYMENT_ID: process.env.GAE_DEPLOYMENT_ID,
        GAE_ENV: process.env.GAE_ENV,
        GAE_INSTANCE: process.env.GAE_INSTANCE,
        GAE_MEMORY_MB: process.env.GAE_MEMORY_MB,
        GAE_RUNTIME: process.env.GAE_RUNTIME,
        GAE_SERVICE: process.env.GAE_SERVICE,
        GAE_VERSION: process.env.GAE_VERSION,
        GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT,
        NODE_ENV: process.env.NODE_ENV,
        PORT: process.env.PORT,
        ENV: process.env.ENV ? process.env.ENV : "pro",
    };
}

function handleErrors(error, res) {
    if (error instanceof MyError && typeof error.httpCode == "number") {
        res.status(error.httpCode);
    } else {
        res.status(500);
    }
    const response = {
        status: "error",
        message: error.message,
    };
    res.send(response);
}

function handleErrorsDecorator(someFun) {
    return async (req, res, next) => {
        try {
            await someFun(req, res, next);
        } catch (error) {
            console.log(error);
            if (error.response && error.response.body) {
                console.log(JSON.stringify(error.response.body));
            }
            res.locals.myerror = error;
            handleErrors(error, res);
        }
    };
}

export {
    cors,
    corsCustomDomains,
    getEnvVariables,
    urlNorFound,
    commonHeaders,
    handleErrors,
    handleErrorsDecorator,
    verifyConstant,
    stringify
}