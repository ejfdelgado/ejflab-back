import fs from "fs";
import { General } from "./common/General.mjs";
import { NoExisteException, ParametrosIncompletosException } from "./MyError.mjs";
import { guessMimeType } from "./common/MimeTypeMap.mjs";

const FOLDER_LOCALS = "assets/";
const PATH_LOCALS = `./src/${FOLDER_LOCALS}`;

export class MyFileServiceLocal {

    static async uploadFile(req, res, next) {
        const base64 = General.readParam(req, "base64");
        const fileName = General.readParam(req, "fileName");
        const buffer = Buffer.from(base64, 'base64');
        // Write buffer down to local file
        const filePath = decodeURIComponent(fileName.replace(/^\//, "").replace(/\?.*$/, ""));
        await new Promise((resolve, reject) => {
            fs.open(`${PATH_LOCALS}${filePath}`, 'w', function (err, fd) {
                if (err) {
                    reject(err);
                    return;
                }
                fs.write(fd, buffer, 0, buffer.length, null, function (err) {
                    if (err) {
                        reject(err);
                    }
                    fs.close(fd, function () {
                        resolve();
                    });
                });
            });
        });
        const response = {
            uri: fileName,
            key: fileName,
            bucket: '',
        };
        res.status(200).send(response);
    }

    static async readFile(req, res, next) {
        const downloadFlag = req.query ? req.query.download : false;
        const encoding = req.query ? req.query.encoding : null;
        const rta = await MyFileServiceLocal.read(req.originalUrl, encoding);
        const MAPEO_CHARSET = {
            "utf8": "; charset=utf-8",
        };
        let charset = MAPEO_CHARSET[encoding];
        if (!charset) {
            charset = "";
        }
        res.writeHead(200, {
            "Content-Type": rta.metadata.contentType + charset,
            "Content-disposition":
                downloadFlag != undefined
                    ? "attachment;filename=" + rta.metadata.filename
                    : "inline",
        });
        res.end(rta.data);
    }

    static async readBinary(filePath) {
        //console.log(`readBinary ${filePath}`);
        filePath = filePath.replace(/^[/]/, "");
        try {
            const contents = fs.readFileSync(`${PATH_LOCALS}${filePath}`);
            return contents;
        } catch (err) {
            if (err.code === 'ENOENT') {
                throw new NoExisteException(`Does not exists ${filePath}`);
            } else {
                throw err;
            }
        }
    }

    static async readString(filePath, encoding = "utf8") {
        //console.log(`readString ${encoding} ${filePath}`);
        const respuesta = await MyFileServiceLocal.readBinary(filePath);
        if (respuesta != null) {
            return respuesta.toString(encoding);
        }
        return null;
    }

    static async read(originalUrl, encoding = null) {
        //console.log(`read ${encoding} ${originalUrl}`);
        const filePath = decodeURIComponent(originalUrl.replace(/^\//, "").replace(/\?.*$/, ""));
        const fileName = /[^/]+$/.exec(filePath)[0];

        const metadataPromise = new Promise((resolve, reject) => {
            fs.stat(`${PATH_LOCALS}${filePath}`, (err, stats) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(stats);
                }
            });
        });
        let contentPromise;
        if (encoding == null) {
            contentPromise = MyFileServiceLocal.readBinary(filePath);
        } else {
            contentPromise = MyFileServiceLocal.readString(filePath, encoding);
        }
        return new Promise((resolve, reject) => {
            Promise.all([metadataPromise, contentPromise]).then(
                function (respuesta) {
                    const metadata = respuesta[0];
                    metadata.filename = fileName;
                    metadata.fullPath = originalUrl;
                    if (!metadata.contentType) {
                        metadata.contentType = guessMimeType(fileName);
                    }
                    const content = respuesta[1];
                    resolve({
                        metadata: metadata,
                        data: content,
                    });
                },
                function (err) {
                    metadataPromise
                        .then(() => {
                            reject(err);
                        })
                        .catch((error) => {
                            if (error.code == 404) {
                                resolve(null);
                            } else {
                                reject(err);
                            }
                        });
                }
            );
        });
    }

    static async deleteFile(req, res, next) {
        const filePath = decodeURIComponent(req.originalUrl.replace(/^\//, "").replace(/\?.*$/, ""));
        const fullPath = `${PATH_LOCALS}${filePath}`;
        await new Promise((resolve, reject) => {
            fs.stat(fullPath, function (err, stats) {
                if (err) {
                    reject(err);
                }
                fs.unlink(fullPath, function (err) {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve();
                });
            });
        });
        res.status(204).send();
    }

    static async listFiles(req, res, next) {
        let localPath = General.readParam(req, "path");
        if (localPath == null) {
            throw new ParametrosIncompletosException("Falta path");
        }
        // Use only slashes
        localPath = localPath.replace(/\\/g, "/");
        // Avoid end with slash
        localPath = localPath.replace(/\/\s*$/g, "");
        // Avoid starts with slash
        localPath = localPath.replace(/^\//, "");
        //passsing directoryPath and callback function
        const fileObjs = fs.readdirSync(`${PATH_LOCALS}${localPath}`, { withFileTypes: true });
        const response = [];
        fileObjs.forEach(function (file) {
            response.push({ name: file.name, path: `${FOLDER_LOCALS}${localPath}/${file.name}` });
        });
        res.status(200).send({ data: response });
    }
}