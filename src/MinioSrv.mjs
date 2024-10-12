import * as Minio from 'minio';
import { Buffer } from 'buffer';
import { NoExisteException } from './MyError.mjs';
import { decode } from "@msgpack/msgpack";

export class MinioSrv {
    static getClient() {
        const uri = process.env.MINIO_URI;
        const uriParts = /^\s*([^:]+):(\d+)\s*$/.exec(uri);
        if (!uriParts) {
            throw new Error(`Bad MINIO_URI ${uri}`);
        }
        const minioClient = new Minio.Client({
            endPoint: uriParts[1],
            port: parseInt(uriParts[2]),
            useSSL: false,
            accessKey: process.env.MINIO_ACCESS_KEY,
            secretKey: process.env.MINIO_SECRET_KEY,
        });
        return minioClient;
    }
    static async assureBucket(minioClient, bucket, region = "us-east-1") {
        const exists = await minioClient.bucketExists(bucket)
        if (exists) {
            //console.log(`Bucket ${bucket} exists.`);
        } else {
            await minioClient.makeBucket(bucket, region)
            //console.log(`Bucket ${bucket} created in "${region}".`);
        }
    }
    static async putObject(minioClient, bucketName, objectPath, buffer, metadata = {}) {
        return new Promise((resolve, reject) => {
            minioClient.putObject(bucketName, objectPath, buffer, Buffer.byteLength(buffer), metadata, function (err, etag) {
                if (err) {
                    reject(err);
                } else {
                    resolve(etag);
                }
            });
        });
    }
    static async stream2Buffer(stream) {
        return new Promise((resolve, reject) => {
            const _buf = [];
            stream.on("data", (chunk) => _buf.push(chunk));
            stream.on("end", () => resolve(Buffer.concat(_buf)));
            stream.on("error", (err) => reject(err));
        });
    }
    static async getObject(minioClient, bucketName, objectPath) {
        const readedMetadataPromise = minioClient.statObject(bucketName, objectPath);
        const dataStreamPromise = new Promise(async (resolve, reject) => {
            try {
                const dataStream = await minioClient.getObject(bucketName, objectPath);
                const bytes = await MinioSrv.stream2Buffer(dataStream);
                resolve(bytes);
            } catch (err) {
                reject(err);
            }
        });
        try {
            const [readedMetadata, bytes] = await Promise.all([readedMetadataPromise, dataStreamPromise]);
            const metadata = readedMetadata.metaData;
            metadata['Last-Modified'] = readedMetadata.lastModified;
            return {
                data: bytes,
                metadata,
            };
        } catch (err) {
            if (err.code == 'NotFound') {
                throw new NoExisteException(`Not found ${objectPath} on ${bucketName}`);
            } else {
                throw err;
            }
        }
    }
    static async test(req, res, next) {
        const minioClient = MinioSrv.getClient();
        const bucketName = "public";
        const objectPath = "local/myFile.txt";
        const b64string = "Hola cómo estás?";
        const metaData = { 'Content-Type': 'text/plain; charset=utf-8' };

        await MinioSrv.assureBucket(minioClient, bucketName);
        const buffer = Buffer.from(b64string, 'utf8');
        const putResponse = await MinioSrv.putObject(minioClient, bucketName, objectPath, buffer, metaData);

        const getResponse = await MinioSrv.getObject(minioClient, bucketName, objectPath);

        const headers = getResponse.metadata;
        headers['Content-disposition'] = "inline; filename=name.txt";
        //headers['Cache-Control'] = "max-age=0";

        res.writeHead(200, headers);
        res.end(getResponse.data);
    }
    static async readFile(req, res, next) {
        const bucketName = req.params['bucket'];
        const downloadFlag = req.query ? req.query.download : false;
        const minioClient = MinioSrv.getClient();
        await MinioSrv.assureBucket(minioClient, bucketName);
        const cleanedUrl = decodeURIComponent(req.originalUrl.replace(/^\//, "").replace(/\?.*$/, ""));
        const urlParts = /^srv\/minio\/[^\/]+\/(.*)$/.exec(cleanedUrl);
        const objectPath = urlParts[1];
        const getResponse = await MinioSrv.getObject(minioClient, bucketName, objectPath);
        const headers = getResponse.metadata;
        const fileName = /([^\/]+)$/.exec(objectPath)[1];
        if (downloadFlag != undefined) {
            headers['Content-disposition'] = `attachment; filename=${fileName}`;
        } else {
            headers['Content-disposition'] = `inline; filename=${fileName}`;
        }
        if (req.query.max_age) {
            headers["Cache-Control"] = `max-age=${req.query.max_age}`;
        }
        res.writeHead(200, headers);
        res.end(getResponse.data);
    }
    static async writeFileLocal(bucketName, fileList) {
        const minioClient = MinioSrv.getClient();
        await MinioSrv.assureBucket(minioClient, bucketName);
        const promesas = [];
        // Ensure it is an array
        if (!(fileList instanceof Array)) {
            fileList = [fileList];
        }
        for (let i = 0; i < fileList.length; i++) {
            const someFile = fileList[i];
            const { objectPath, bytes, metadata } = someFile;
            const promesa = MinioSrv.putObject(minioClient, bucketName, objectPath, bytes, metadata);
            promesas.push(promesa);
        }
        await Promise.all(promesas);
    }
    static async writeFile(req, res, next) {
        const bucketName = req.params['bucket'];
        const buffer = req.body;
        const fileList = decode(buffer);
        await MinioSrv.writeFileLocal(bucketName, fileList);
        const response = {
            status: "ok",
        };
        res.status(200).send(response);
    }
    static async ping(req, res, next) {
        const minioClient = MinioSrv.getClient();
        const buckets = await minioClient.listBuckets();
        const response = {
            buckets,
            status: "ok",
        };
        res.status(200).send(response);
    }
}