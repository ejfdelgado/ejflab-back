import { MyStore } from "./common/MyStore.mjs";
import { General } from "./common/General.mjs";
import axios from "axios";

const MAX_READ_SIZE = 60;

export class Image2MeshSrv {
    static async save(req, res, next) {
        const token = res.locals.token;
        const AHORA = new Date().getTime();
        const image = General.readParam(req, "image");
        const pageId = req.params['pageId'];
        const pageType = "img2mesh";

        if (image instanceof Array) {
            for (let i = 0; i < image.length; i++) {
                const image1 = image[i];
                image1.author = token.email;
                image1.updated = AHORA;
                image1.pg = pageId;
                image1.pageType = pageType;
                Image2MeshSrv.serializeImage(image1);
                if (image1.id) {
                    await MyStore.updateById("imgtomeshimg", image1.id, image1);
                } else {
                    image1.created = AHORA;
                    await MyStore.create("imgtomeshimg", image1);
                }
                Image2MeshSrv.deserializeImage(image1);
            }
        } else {
            image.author = token.email;
            image.updated = AHORA;
            image.pg = pageId;
            image.pageType = pageType;
            Image2MeshSrv.serializeImage(image);
            if (image.id) {
                await MyStore.updateById("imgtomeshimg", image.id, image);
            } else {
                image.created = AHORA;
                await MyStore.create("imgtomeshimg", image);
            }
            Image2MeshSrv.deserializeImage(image);
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
        response = await MyStore.paginate("imgtomeshimg", [{ name: "created", dir: 'desc' }], offset, max, where);
        for (let i = 0; i < response.length; i++) {
            const image = response[i];
            Image2MeshSrv.deserializeImage(image);
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
                    await MyStore.deleteById("imgtomeshimg", image1.id);
                }
            }
        } else {
            await MyStore.deleteById("imgtomeshimg", image.id);
        }

        res.status(200).send({
            status: "ok",
            image: []
        });
    }
}