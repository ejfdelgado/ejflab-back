import url from "url";
import fs from "fs";
import path from "path";
import { guessMimeType } from "./common/MimeTypeMap.mjs";
import { MainReplacer } from "./MainReplacer.mjs";
import { MyRoutes } from "@ejfdelgado/ejflab-common/src/MyRoutes.js";
import { PageSrv } from "./PageSrv.mjs";
import { ModuloDatoSeguro } from "@ejfdelgado/ejflab-common/src/ModuloDatoSeguro.js";
import { ModuloDatoSeguroBack } from "@ejfdelgado/ejflab-common/src/ModuloDatoSeguroBack.mjs";
import { MyConstants } from "@ejfdelgado/ejflab-common/src/MyConstants.js";

export class MainHandler {
    static LOCAL_FOLDER1 = path.resolve() + "/src";// First try
    static LOCAL_FOLDER = path.resolve() + "/dist/bundle";// Finall try
    static async handle(req, res, next) {
        const originalUrl = req.getUrl();
        const theUrl = url.parse(originalUrl);
        //console.log(`theUrl.pathname = ${theUrl.pathname}`);
        if (theUrl.pathname == "/socket.io/" || theUrl.pathname.startsWith("/srv/")) {
            //next(); // it can't call no one after then...
            return;
        }
        const rutas = MainHandler.decodeUrl(theUrl);
        const encoding = req.query.encoding;
        const rta = await MainHandler.resolveLocalFile(rutas, encoding);
        if (
            rta != null &&
            typeof rta.data == "string" &&
            rta.metadata.filename == "index.html"
        ) {
            const partes = MyRoutes.splitPageData(theUrl.path);
            if (MyConstants.NO_AUTO_PAGE_NAVITATION.indexOf(partes.pageType) >= 0) {
                partes.pageId = null;
            }
            const replaces = await PageSrv.loadCurrentPage(partes.pageType, partes.pageId);
            const firebaseJson = await MainHandler.resolveLocalFileSingle(MyConstants.FIREBASE_CONFIG_FILE, "utf8", path.resolve());
            // Acá se debe inyectar el password y el json se lee de local y se cifra
            replaces.time = "" + new Date().getTime();
            replaces.pass = ModuloDatoSeguro.generateKey();
            replaces.firebase = ModuloDatoSeguroBack.cifrarSimple(JSON.parse(firebaseJson), replaces.pass);
            MainReplacer.replace(rta, replaces, theUrl);
        }
        MainHandler.makeResponse(rta, req, res);
    }

    static decodeUrl(localPath) {
        const respuestas = [];
        respuestas.push(localPath.pathname);
        respuestas.push("/index.html");
        const ans = {
            files: respuestas,
            pageType: null,
            pageId: null,
        };
        return ans;
    }

    static makeResponse(rta, req, res) {
        const downloadFlag = (req.query && req.query.download);
        if (rta != null) {
            if (rta.redirect) {
                res.redirect(rta.redirect);
            } else {
                res.writeHead(200, {
                    "Content-Type": rta.metadata.contentType,
                    "Content-disposition":
                        downloadFlag ? "attachment;filename=" + rta.metadata.filename : "inline",
                });
                res.end(rta.data);
            }
        } else {
            res.status(202).end();
        }
    }

    static async resolveLocalFile(localPath, encoding = "utf8") {
        for (let i = 0; i < localPath.files.length; i++) {
            const filename = localPath.files[i];
            const contentType = guessMimeType(filename);
            let contenido;
            if (["text/html"].indexOf(contentType) >= 0) {
                contenido = await MainHandler.resolveLocalFileSingle(
                    filename,
                    encoding
                );
            } else {
                contenido = await MainHandler.resolveLocalFileSingle(filename);
            }
            if (contenido != null) {
                return {
                    data: contenido,
                    metadata: {
                        contentType: contentType,
                        filename: /[^/]*$/.exec(filename)[0],
                        fullPath: filename,
                    },
                };
            }
        }
        return null;
    }

    static async resolveLocalFileSingle(filename, encoding, rootFolder) {
        return new Promise((resolve, reject) => {

            // Try
            const options = [];
            if (rootFolder) {
                options.push(path.join(rootFolder, filename));
            }
            if (process.env.ENV != "pro") {
                options.push(path.join(MainHandler.LOCAL_FOLDER1, filename));
            }
            options.push(path.join(MainHandler.LOCAL_FOLDER, filename));

            // Check which exists first, if not resolve null with log
            let selected = null;
            for (let i = 0; i < options.length; i++) {
                const actual = options[i];
                if (fs.existsSync(actual)) {
                    selected = actual;
                    break;
                }
            }

            if (!selected) {
                console.log(`Files not found ${options}`);
                resolve(null);
                return;
            }

            const somePath = selected;
            if (!fs.lstatSync(somePath).isFile()) {
                resolve(null);
                return;
            }
            if (typeof encoding == "string") {
                fs.readFile(somePath, encoding, function (err, data) {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(data);
                });
            } else {
                fs.readFile(somePath, function (err, data) {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(data);
                });
            }
        });
    }

    static addGetUrl(req, res, next) {
        req.getUrl = function () {
            return req.protocol + "://" + req.get("host") + req.originalUrl;
        };
        return next();
    }
}
