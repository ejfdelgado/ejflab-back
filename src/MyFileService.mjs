import axios from "axios";
import sharp from "sharp";
import { Buffer } from 'buffer';
import { Storage } from '@google-cloud/storage';
import ReadableStreamClone from 'readable-stream-clone'
import { MyConstants } from "../srcJs/MyConstants.js";
import { General } from "./common/General.mjs";
import { PassThrough } from "stream";
import { Gif } from "../srcJs/gif/index.mjs";

const storage = new Storage();

const defaultBucket = storage.bucket(MyConstants.BUCKET.PUBLIC);
const privateBucket = storage.bucket(MyConstants.BUCKET.PRIVATE);

export class MyFileService {

    async setFilePublic(bucketRef, fileName) {
        await bucketRef
            .file(fileName)
            .makePublic();
    }

    static async makegif(req, res, next) {
        const token = res.locals.token;
        const pageId = req.params['pageId'];
        const peticion = req.body;

        //console.log(JSON.stringify(peticion, null, 4));

        //duration, audioUrl, imageUrl
        const frames = peticion.frames;
        const promesasImg = [];
        for (let i = 0; i < frames.length; i++) {
            const frame = frames[i];
            const { imageUrl } = frame;
            promesasImg.push(MyFileService.read(imageUrl));
        }
        const imgBuffers = await Promise.all(promesasImg);
        for (let i = 0; i < frames.length; i++) {
            const frame = frames[i];
            frame.src = new Uint8Array(imgBuffers[i].data);
        }
        const quality = 80;
        const myGif = new Gif(peticion.width, peticion.height, quality);
        myGif.setLoops(1);
        await myGif.setFrames(frames);
        const rendered = await myGif.encode();

        const bucketKey = MyFileService.getKeyBucketPath(token, "srv/pg/tale/", `${pageId}/${peticion.key}`, "OWN");
        const uri = `${MyConstants.BUCKET.URL_BASE}/${MyConstants.BUCKET.PRIVATE}/${peticion.key}`;

        const file = privateBucket.file(bucketKey);

        const stream = new PassThrough();
        stream.end(rendered);

        await MyFileService.sendFile2Bucket(stream, file);

        if (peticion.download) {
            res.writeHead(200, {
                "Content-Type": "image/gif",
                "Content-disposition": "attachment;filename=" + peticion.key
            });
            res.end(rendered);
        } else {
            res.status(200).send({ key: bucketKey + "?t=" + new Date().getTime(), uri });
        }
    }

    static async deleteDonationFiles(bucketRef, keyName) {
        keyName = keyName.replace(/^.*storage.googleapis.com\/[^/]+\//ig, "");
        const keyNameXs = General.getSuffixPath(keyName, "_xs");
        const file = bucketRef.file(keyName);
        const fileXs = bucketRef.file(keyNameXs);
        const reporte = [];
        try {
            const detalle = { url: keyName };
            reporte.push(detalle);
            await file.delete();
            detalle.ok = true;
        } catch (error) { }
        try {
            const detalle = { url: keyNameXs };
            reporte.push(detalle);
            await fileXs.delete();
            detalle.ok = true;
        } catch (error) { }
        return reporte;
    }

    static async cloneFile(bucketRef, token, orig, dest) {
        const origPath = MyFileService.getKeyBucketPath(token, orig.folder, orig.filename, orig.type);
        const destPath = MyFileService.getKeyBucketPath(token, dest.folder, dest.filename, dest.type);
        const origFile = bucketRef.file(origPath);
        const destFile = bucketRef.file(destPath);
        const copyOptions = {};
        await origFile.copy(destFile, copyOptions);
        await destFile.makePublic();
    }
    static async stream2Buffer(stream) {
        return new Promise((resolve, reject) => {
            const _buf = [];
            stream.on("data", (chunk) => _buf.push(chunk));
            stream.on("end", () => resolve(Buffer.concat(_buf)));
            stream.on("error", (err) => reject(err));
        });
    }
    static async fetchFile2Stream(url) {
        const options = { responseType: 'stream' };
        const response = await new Promise((resolve, reject) => {
            axios.get(url, options)
                .then(res => { resolve(res) })
                .catch(error => { reject(error) });
        });
        const stream = response.data;
        return stream;
    }
    static async fetchUrl2Bucket(url, token, folder, filename, type, isPrivate = false) {
        const keyName = MyFileService.getKeyBucketPath(token, folder, filename, type);
        const stream = await MyFileService.fetchFile2Stream(url);
        let file = defaultBucket.file(keyName);
        let uri = `${MyConstants.BUCKET.URL_BASE}/${MyConstants.BUCKET.PUBLIC}/${keyName}`;
        if (isPrivate) {
            file = privateBucket.file(keyName);
            uri = `${MyConstants.BUCKET.URL_BASE}/${MyConstants.BUCKET.PRIVATE}/${keyName}`;
        }
        await MyFileService.sendFile2Bucket(stream, file);
        if (isPrivate === false) {
            await file.makePublic();
        }

        return uri;
    }

    static async sendFile2Bucket(req, file) {
        return new Promise((resolve, reject) => {
            req.pipe(file.createWriteStream()).on('finish', () => {
                resolve();
            }).on('error', (error) => {
                reject(error);
            });
        });
    }

    static getKeyBucketPath(token, folder = "general", fileName, type) {
        const mp = General.getNameParts();
        let keyName;
        if (type == "FIRST_YEAR_MONTH") {
            keyName = `${folder}/${mp.year}/${mp.month}/${token.email}/${mp.day}/${mp.hours}/${mp.minutes}/${mp.seconds}/${mp.millis}/${fileName}`;
        } else if (type == "FIRST_EMAIL") {
            keyName = `${folder}/${token.email}/${mp.year}/${mp.month}/${mp.day}/${mp.hours}/${mp.minutes}/${mp.seconds}/${mp.millis}/${fileName}`;
        } else {
            keyName = `${folder}/${token.email}/${fileName}`;
        }
        keyName = keyName.replace(/[\/]{2,}/g, "/");
        return keyName;
    }

    static async readBinary(bucket, filePath) {
        filePath = filePath.replace(/^[/]/, "");
        const file = bucket.file(filePath);
        const contents = (await file.download())[0];
        return contents;
    }

    static async readString(bucket, filePath, encoding = "utf8") {
        const respuesta = await MyFileService.readBinary(bucket, filePath);
        if (respuesta != null) {
            return respuesta.toString(encoding);
        }
        return null;
    }

    static async deleteFile(req, res, next) {
        const originalUrl = req.originalUrl;
        const filePath = decodeURIComponent(originalUrl.replace(/^\//, "").replace(/\?.*$/, ""));
        const bucket = privateBucket;
        const oldFileRef = bucket.file(filePath);
        try {
            await oldFileRef.delete();
        } catch (err) {
            //ignore, best effor
        }
        res.status(204).send();
    }

    static async readFile(req, res, next) {
        const downloadFlag = req.query ? req.query.download : false;
        const encoding = req.query ? req.query.encoding : null;
        const rta = await MyFileService.read(req.originalUrl, encoding);
        const MAPEO_CHARSET = {
            "utf8": "; charset=utf-8",
        };
        let charset = MAPEO_CHARSET[encoding];
        if (!charset) {
            charset = "";
        }
        if (!rta) {
            res.status(204).send();
            return;
        }
        const response = {
            "Content-Type": rta.metadata.contentType + charset,
            "Content-disposition":
                downloadFlag != undefined
                    ? "attachment;filename=" + rta.metadata.filename
                    : "inline",
        };
        if (req.query.max_age) {
            response["Cache-Control"] = `max-age=${req.query.max_age}`;
        }
        res.writeHead(200, response);
        res.end(rta.data);
    }

    /**
    * @param encoding ascii, utf8 or null
    */
    static async read(originalUrl, encoding = null) {
        const filePath = decodeURIComponent(originalUrl.replace(/^\//, "").replace(/\?.*$/, ""));
        const fileName = /[^/]+$/.exec(filePath)[0];
        const bucket = privateBucket;
        const file = bucket.file(filePath);
        const metadataPromise = file.getMetadata();
        let contentPromise;
        if (encoding == null) {
            contentPromise = MyFileService.readBinary(bucket, filePath);
        } else {
            contentPromise = MyFileService.readString(bucket, filePath, encoding);
        }
        return new Promise((resolve, reject) => {
            Promise.all([metadataPromise, contentPromise]).then(
                function (respuesta) {
                    const metadata = respuesta[0][0];
                    metadata.filename = fileName;
                    metadata.fullPath = originalUrl;
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

    static async uploadFileResponse(req, res, next) {
        res.status(200).send({ uri: res.locals.uri, key: res.locals.key, bucket: res.locals.bucket });
    }

    static async setFilePublicSrv(req, res, next) {
        const key = General.readParam(req, "key");
        await privateBucket
            .file(key)
            .makePublic();
        res.status(200).send({ ok: true });
    }

    static async uploadFile(req, res, next) {

        if (!req.headers.filename) {
            if (typeof next != "undefined") {
                next();// use await??
                return;
            }
        }

        const token = res.locals.token;

        const extra = req.headers.extra;
        if (extra) {
            try {
                const buffer = Buffer.from(extra, 'base64');
                const texto = buffer.toString("utf8");
                if (!req.locals) {
                    req.locals = {};
                }
                req.locals.extra = JSON.parse(texto);
            } catch (e) {
                console.log(e);
                console.log("Can't decode extra header, but present.");
            }
        }

        let folderType = "FIRST_YEAR_MONTH";

        if (req.headers.foldertype) {
            folderType = req.headers.foldertype;
        }

        let bucketRef = defaultBucket;
        let bucketName = MyConstants.BUCKET.PUBLIC;
        let isPublic = true;
        if (req.headers.isprivate !== undefined && req.headers.isprivate !== '0') {
            bucketRef = privateBucket;
            bucketName = MyConstants.BUCKET.PRIVATE;
            isPublic = false;
        }

        let isplainfile = false;
        if ([false, "0", null, undefined].indexOf(req.headers.isplainfile) < 0) {//es undefined si no se manda
            isplainfile = true;
        }

        const keyName = MyFileService.getKeyBucketPath(
            token,
            req.headers.folder,
            req.headers.filename,
            folderType,
        );
        const file = bucketRef.file(keyName);

        //check if needs to erase previous file
        if (req.headers.erasefile) {
            const oldFile = decodeURIComponent(req.headers.erasefile.replace(/^\//, "").replace(/\?.*$/, ""));
            const oldFileRef = bucketRef.file(oldFile);
            try {
                await oldFileRef.delete();
            } catch (err) {
                //ignore, best effor
            }
        }

        if (isplainfile) {
            // Treated as simple blob
            const readClone1 = new ReadableStreamClone(req);
            await MyFileService.sendFile2Bucket(readClone1, file);
            if (isPublic) {
                await file.makePublic();
            }
        } else {
            // Treated as image with thumbnail
            const keyNameXs = General.getSuffixPath(keyName, "_xs");
            const fileXs = bucketRef.file(keyNameXs);
            let sizeBig = 1024;
            let sizeSmall = 256;
            if (req.headers.sizebig) {
                const numero = parseInt(req.headers.sizebig);
                if (!isNaN(numero)) {
                    sizeBig = numero;
                }
            }
            if (req.headers.sizesmall) {
                const numero = parseInt(req.headers.sizesmall);
                if (!isNaN(numero)) {
                    sizeSmall = numero;
                }
            }
            const bigImage = sharp().resize(null, sizeBig).withMetadata().jpeg({ mozjpeg: true });
            const smallImage = sharp().resize(null, sizeSmall).withMetadata().jpeg({ mozjpeg: true });

            const readClone1 = new ReadableStreamClone(req);
            const readClone2 = new ReadableStreamClone(req);

            await Promise.all([
                MyFileService.sendFile2Bucket(readClone1.pipe(bigImage), file),
                MyFileService.sendFile2Bucket(readClone2.pipe(smallImage), fileXs)
            ]);
            if (isPublic) {
                await Promise.all([
                    file.makePublic(),
                    fileXs.makePublic(),
                ]);
            }
        }

        res.locals.bucket = bucketName;
        res.locals.key = `${keyName}`;
        const uri = `${MyConstants.BUCKET.URL_BASE}/${bucketName}/${keyName}`;
        res.locals.uri = uri;

        next();
    }

    static async listFiles(req, res, next) {
        res.status(200).send({ data: [] });
    }
}