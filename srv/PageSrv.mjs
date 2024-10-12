import { MyUtilities } from "@ejfdelgado/ejflab-common/src/MyUtilities.js";
import { MyRoutes } from "@ejfdelgado/ejflab-common/src/MyRoutes.js"
import { General } from "./common/General.mjs";
import { MyStore } from "./common/MyStore.mjs";
import { Utilidades } from "./common/Utilidades.mjs";
import { MalaPeticionException, NoExisteException } from "./MyError.mjs";
import { AuthorizationSrv } from "./AuthorizationSrv.mjs";
import { MyConstants } from "@ejfdelgado/ejflab-common/src/MyConstants.js";
import { ModuloDatoSeguroBack } from "@ejfdelgado/ejflab-common/src/ModuloDatoSeguroBack.mjs";



const PAGE_TYPE = "page";
const PAGE_DELETE_TYPE = "page-delete";
const MAX_READ_SIZE = 30;

export class PageSrv {
    static async deletePage(req, res, next) {
        let respuesta = {};
        const pageId = req.params['pageId'];
        const ahora = new Date().getTime();
        // Crear una entidad como evidencia de que el borrado está en proceso
        await MyStore.createById(PAGE_DELETE_TYPE, pageId, {
            state: 0,
            created: ahora,
            updated: ahora,
        });
        // Se borra la página como tal
        await MyStore.deleteById(PAGE_TYPE, pageId);
        res.status(200).send(respuesta);
    }
    static async savePage(req, res, next) {
        let respuesta = {};
        const pageId = req.params['pageId'];
        const datos = General.readParam(req, "datos");
        if (!pageId) {
            throw new MalaPeticionException("Falta el id");
        }
        if (!datos || !(typeof datos == "object")) {
            throw new MalaPeticionException("Falta datos");
        }
        const response = await MyStore.readById(PAGE_TYPE, pageId);
        if (response) {
            const { tit, desc } = datos;
            const q = MyUtilities.partirTexto(`${typeof tit == 'string' ? tit : ''} ${typeof desc == 'string' ? desc : ''}`, true);
            //Se agrega al buscable el correo del autor
            q.push(response.usr);
            const updated = {
                tit,
                desc,
                q,
            };
            if (res.locals && res.locals.uri) {
                updated.img = res.locals.uri;
            }
            await MyStore.updateById(PAGE_TYPE, pageId, updated);
            Object.assign(response, updated);
            respuesta = response;
        } else {
            throw new NoExisteException(`Does not exists ${pageId}`);
        }
        PageSrv.cleanSecrets(respuesta);
        res.status(200).send(respuesta);
    }
    static async createNewPage(req, res, next) {
        const user = res.locals.user;
        const elpath = Utilidades.leerRefererPath(req);
        const partes = MyRoutes.splitPageData(elpath);
        const elUsuario = user.metadatos.email;
        const nueva = await PageSrv.commonCreateNewPage(elUsuario, partes.pageType);
        PageSrv.cleanSecrets(nueva);
        res.status(200).send(nueva);
    }
    static async getCurrentPage(req, res, next) {
        const user = res.locals.user;
        const elpath = Utilidades.leerRefererPath(req);
        const partes = MyRoutes.splitPageData(elpath);
        const respuesta = await PageSrv.loadCurrentPage(partes.pageType, partes.pageId, user);
        PageSrv.cleanSecrets(respuesta);
        res.status(200).send(respuesta);
    }
    // PageSrv.cleanSecrets(page)
    static async cleanSecrets(page) {
        if (page) {
            delete page['private'];
            delete page['private2'];
            delete page['public2'];
            delete page['pass'];
        }
        return page;
    }
    static async rotateSecret1(req, res, next) {
        let respuesta = {};
        const pageId = req.params['pageId'];
        if (!pageId) {
            throw new MalaPeticionException("Falta el id");
        }
        const actualizacion = { pass: ModuloDatoSeguroBack.generateKey(4) };
        await MyStore.updateById(PAGE_TYPE, pageId, actualizacion);
        res.status(200).send(respuesta);
    }
    static async rotateSecret2(req, res, next) {
        let respuesta = {};
        const pageId = req.params['pageId'];
        if (!pageId) {
            throw new MalaPeticionException("Falta el id");
        }
        const actualizacion = ModuloDatoSeguroBack.generateKeyPair();
        await MyStore.updateById(PAGE_TYPE, pageId, actualizacion);
        res.status(200).send(respuesta);
    }
    static async rotateSecret3(req, res, next) {
        let respuesta = {};
        const pageId = req.params['pageId'];
        if (!pageId) {
            throw new MalaPeticionException("Falta el id");
        }
        const par = ModuloDatoSeguroBack.generateKeyPair();
        const actualizacion = {
            public2: par.public,
            private2: par.private,
        };
        await MyStore.updateById(PAGE_TYPE, pageId, actualizacion);
        res.status(200).send(respuesta);
    }
    static async commonCreateNewPage(elUsuario, pageType) {
        const AHORA = new Date().getTime() / 1000;
        const nueva = {
            usr: elUsuario,
            path: pageType,
            date: AHORA,
            act: AHORA,
            tit: "Título",
            desc: "Descripción",
            img: MyConstants.getDefaultPageImage(pageType),
            kw: "",
        };
        try {
            nueva.pass = ModuloDatoSeguroBack.generateKey(4);
            const par = ModuloDatoSeguroBack.generateKeyPair();
            const par2 = ModuloDatoSeguroBack.generateKeyPair();
            nueva.public = par.public;
            nueva.private = par.private;
            nueva.public2 = par2.public;
            nueva.private2 = par2.private;
        } catch (err) { }
        await MyStore.create(PAGE_TYPE, nueva);
        // Se deben agregar los permisos
        const promesasPermisos = [];
        promesasPermisos.push(AuthorizationSrv.createPagePermision("owner", nueva.id, elUsuario));
        const publicRole = MyConstants.getDefaultPublicPageRole(pageType);
        if (publicRole != "none") {
            promesasPermisos.push(AuthorizationSrv.createPagePermision(publicRole, nueva.id));
        }
        await Promise.all(promesasPermisos);
        return nueva;
    }
    static async loadCurrentPage(pageType, pageId, usuario = null) {
        const AHORA = new Date().getTime() / 1000;
        if (usuario == null && pageId == null) {
            return {};
        }
        if (typeof pageId == "string") {
            // Si hay id se debe buscar con Id y listo
            const response = await MyStore.readById(PAGE_TYPE, pageId);
            if (response) {
                return response;
            } else {
                throw new NoExisteException(`Does not exists ${pageId}`);
            }
        } else {
            if (usuario) {
                const elUsuario = usuario.metadatos.email;
                const where = [
                    { key: "usr", oper: "==", value: elUsuario },
                    { key: "path", oper: "==", value: pageType },
                ];
                const max = 1;
                // Si no hay id pero hay usuario logeado se debe buscar por aut y pageType
                const response = await MyStore.paginate(PAGE_TYPE, [{ name: "act", dir: 'desc' }], 0, max, where);
                if (response.length > 0) {
                    return response[0];
                } else {
                    // Si no existe lo crea y devuelve el valor por defecto
                    const nueva = await PageSrv.commonCreateNewPage(elUsuario, pageType);
                    return nueva;
                }
            }
        }
    }
    static async iterateMyPages(req, res, next) {
        const token = res.locals.token;
        const { max, offset } = General.readMaxOffset(req, MAX_READ_SIZE);
        const q = General.readParam(req, "q");
        const path = General.readParam(req, "path");
        if (!path) {
            throw new MalaPeticionException("Falta el path");
        }
        // Que sea mio
        const where = [
            { key: "usr", oper: "==", value: token.email },
            { key: "path", oper: "==", value: path },
        ];
        if (typeof q == 'string' && q.trim().length > 0) {
            const partes = MyUtilities.partirTexto(q, false, true);
            where.push({
                key: "q", oper: "array-contains-any", value: partes
            });
        }
        const select = ["date", "path", "img", "act", "usr", "kw", "tit", "desc", "public"];
        const response = await MyStore.paginate(PAGE_TYPE, [{ name: "act", dir: 'desc' }], offset, max, where, null, select);
        res.status(200).send(response);
    }
    static async iterateAllPages(req, res, next) {
        const { max, offset } = General.readMaxOffset(req, MAX_READ_SIZE);
        const q = General.readParam(req, "q");
        const path = General.readParam(req, "path");
        if (!path) {
            throw new MalaPeticionException("Falta el path");
        }
        const where = [
            { key: "path", oper: "==", value: path },
        ];
        if (typeof q == 'string' && q.trim().length > 0) {
            const partes = MyUtilities.partirTexto(q, false, true);
            where.push({
                key: "q", oper: "array-contains-any", value: partes
            });
        }
        const select = ["date", "path", "img", "act", "usr", "kw", "tit", "desc", "public"];
        const response = await MyStore.paginate(PAGE_TYPE, [{ name: "act", dir: 'desc' }], offset, max, where, null, select);
        res.status(200).send(response);
    }
}