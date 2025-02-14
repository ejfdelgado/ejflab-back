import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { MyError } from '../MyError.mjs';
import { Usuario } from './Usuario.mjs';
import fs from "fs";
import { General } from './General.mjs';
import { MyConstants } from '@ejfdelgado/ejflab-common/src/MyConstants.js';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

const AUTH_PROVIDER = process.env.AUTH_PROVIDER;
const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID;
const MICROSOFT_TENANT = process.env.MICROSOFT_TENANT;

const microsoftClient = jwksClient({
    jwksUri: `https://login.microsoftonline.com/${MICROSOFT_TENANT}/discovery/v2.0/keys`,
});

// Helper to get the signing key
function getMicrosoftKey(header, callback) {
    microsoftClient.getSigningKey(header.kid, (err, key) => {
        if (err) {
            return callback(err);
        }
        const signingKey = key.getPublicKey();
        callback(null, signingKey);
    });
}

function verifyMicrosoftToken(token) {
    return new Promise((resolve, reject) => {
        jwt.verify(
            token,
            getMicrosoftKey,
            {
                algorithms: ['RS256'], // Tokens are typically signed with RS256
                audience: MICROSOFT_CLIENT_ID, // Replace with your application's client ID
                issuer: `https://login.microsoftonline.com/${MICROSOFT_TENANT}/v2.0`, // Replace with your tenant's issuer
                //issuer: `https://sts.windows.net/${MICROSOFT_TENANT}/`
            },
            (err, decoded) => {
                if (err) {
                    return reject(err);
                }
                resolve(decoded);
            }
        );
    });
}

function getFirebaseConfig() {
    const firebaseJson = fs.readFileSync(MyConstants.FIREBASE_CONFIG_FILE, { encoding: "utf8" });
    return JSON.parse(firebaseJson);
}

try {
    initializeApp(getFirebaseConfig());
} catch (err) {
    console.log(err);
    console.log("Firebase capability not configured");
}
function getOAuthToken(req) {
    const authcookie = General.readParam(req, "authcookie")
    if (authcookie == "1" && "yo" in req.cookies) {
        let token = req.cookies["yo"];
        return token;
    }
    if ('authentication' in req.headers) {
        return req.headers.authentication.replace(/bearer\s*/ig, '');
    }
    if ('rawHeaders' in req) {
        const lista = req.rawHeaders;
        const tamanio = lista.length / 2;
        for (let i = 0; i < tamanio; i++) {
            const key = lista[i * 2];
            const value = lista[i * 2 + 1];
            //'authorization' es interno!
            if (['x-forwarded-authorization'].indexOf(key.toLowerCase()) >= 0) {
                return value.replace(/bearer\s*/ig, '');
            }
        }
    }
    if ('authorization' in req.headers) {
        return req.headers.authorization.replace(/bearer\s*/ig, '');
    }
    if ('Authorization' in req.headers) {
        return req.headers.Authorization.replace(/bearer\s*/ig, '');
    }
    return null;
}

async function checkAutenticated(req) {
    const sessionToken = getOAuthToken(req);
    return new Promise((resolve, reject) => {
        if (!sessionToken) {
            reject(new MyError("Missing Authorization header.", 403));
            return;
        }
        if (AUTH_PROVIDER == "microsoft") {
            verifyMicrosoftToken(sessionToken)
                .then((decodedToken) => {
                    resolve({
                        decodedToken,
                        sessionToken,
                    });
                })
                .catch((error) => {
                    reject(new MyError(error.message, 403));
                });
        } else if (AUTH_PROVIDER == "google") {
            getAuth()
                .verifyIdToken(sessionToken)
                .then((decodedToken) => {
                    resolve({
                        decodedToken,
                        sessionToken,
                    });
                })
                .catch((error) => {
                    reject(new MyError(error.message, 403));
                });
        }
    });
}

async function disableUser(uid) {
    return new Promise((resolve, reject) => {
        getAuth()
            .updateUser(uid, { disabled: true, })
            .then(() => {
                resolve();
            })
            .catch((error) => {
                reject(new MyError(error.message, 403));
            });
    });
}

async function checkAuthenticated(req, res, next) {
    try {
        const {
            decodedToken,
            sessionToken,
        } = await checkAutenticated(req);
        res.locals.token = decodedToken;
        res.locals.sessionToken = sessionToken;
        res.locals.user = new Usuario(res.locals.token);
        await next();
    } catch (err) {
        res.status(428).send({ message: err.message });
    }
}

async function checkAuthenticatedSilent(req, res, next) {
    try {
        const {
            decodedToken,
            sessionToken,
        } = await checkAutenticated(req);
        res.locals.token = decodedToken;
        res.locals.sessionToken = sessionToken;
        res.locals.user = new Usuario(res.locals.token);
        await next();
    } catch (err) {
        res.locals.token = null;
        res.locals.user = null;
        await next();
    }
}

async function isAdmin(req, res, next) {
    const fixedAdmins = [
        "edgar.jose.fernando.delgado@gmail.com",
        "info@pais.tv",
    ];
    try {
        const token = res.locals.token;
        const estaEnListaAdmins = (fixedAdmins.indexOf(token.email) >= 0);
        const esDominioPanal = token.email.endsWith("@pais.tv");
        if (!(esDominioPanal || estaEnListaAdmins)) {
            res.status(403).send({ message: `Acción no permitida para ${token.email}` });
        } else {
            await next();
        }

    } catch (err) {
        res.status(428).send({ message: err.message });
    }
}

async function checkVerified(req, res, next) {
    try {
        const token = res.locals.token;
        if (token.email_verified == false) {
            res.status(424).send({ message: "Para continuar primero debes verificar tu correo" });
        } else {
            await next();
        }

    } catch (err) {
        res.status(428).send({ message: err.message });
    }
}

export {
    getFirebaseConfig,
    getOAuthToken,
    checkAutenticated,
    checkAuthenticated,
    checkAuthenticatedSilent,
    checkVerified,
    isAdmin,
    disableUser,
}