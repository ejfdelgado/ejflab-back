import {
    MalaPeticionException,
    NoExisteException,
    NoAutorizadoException
} from "./MyError.mjs";
import { General } from "./common/General.mjs";
import { MyStore } from "./common/MyStore.mjs";
import MyDatesBack from "@ejfdelgado/ejflab-common/src/MyDatesBack.mjs";
import { MyConstants } from "@ejfdelgado/ejflab-common/src/MyConstants.js";

const AUTH_TYPE = "auth";
const MAX_READ_SIZE = 30;

/**
 * Roles:
 * 
 * Reader, Editor, Owner
 * 
 * Capacidades
 * r
 * w
 * 
 * Recursos
 * 
 * fil - los archivos
 * pg - la página
 * tup - las tuplas
 * per - los permisos
 */

/**
 * {
 *      id: "${recurso}:${identidad}"//Esta será la llave de búsqueda, cuando no hay identidad se refiere al valor por defecto
 *      rsc: "${recurso}",
 *      who: "${identidad}",
 *      act: number,
 *      cre: number,
 *      auth: ["fil_r"],
 * }
 */

/**
 * [{
 *      who: "${identidad}",
 *      auth: ["fil_r"],
 *      erase: true,
 * }]
 */
export class AuthorizationSrv {
    static async createPagePermision(role, idPage, who = "") {
        const AHORA = MyDatesBack.getDayAsContinuosNumberHmmSSmmm(new Date());
        const auth = MyConstants.getAuthByRole(role);
        if (auth.length == 0) {
            return;
        }
        const compundId = `${idPage}:${who}`;
        await MyStore.createById(AUTH_TYPE, compundId, {
            act: AHORA,
            cre: AHORA,
            rsc: idPage,
            who: who,
            auth: auth,
            role: role,
        });
    }
    static async save(req, res) {
        const AHORA = MyDatesBack.getDayAsContinuosNumberHmmSSmmm(new Date());
        // Se lee el id del recurso}
        const idResource = req.params['pageId'];
        const lista = General.readParam(req, "lista");

        if (!idResource) {
            throw new MalaPeticionException("Falta el id");
        }
        if (!(lista instanceof Array)) {
            throw new MalaPeticionException("Falta la lista");
        }

        // Se lee el token
        // Se valida que el usuario esté autorizado para modificar los permisos del recurso

        await MyStore.runTransaction(async (firebaseInstance) => {
            // Se buscan los existentes
            const ids = [];
            for (let i = 0; i < lista.length; i++) {
                const permiso = lista[i];
                ids.push(`${idResource}:${permiso.who}`);
            }
            // Se guardan los permisos
            const existentes = await MyStore.readByIds(AUTH_TYPE, ids, firebaseInstance);
            const promesas = [];
            for (let i = 0; i < lista.length; i++) {
                const permiso = lista[i];
                const compundId = `${idResource}:${permiso.who}`;
                const existente = existentes[compundId];
                if (existente !== undefined) {
                    if (permiso.erase === true) {
                        // Se debe borrar
                        promesas.push(MyStore.deleteById(AUTH_TYPE, compundId, firebaseInstance));
                    } else {
                        // Se debe actualizar
                        promesas.push(MyStore.updateById(AUTH_TYPE, compundId, {
                            act: AHORA,
                            auth: permiso.auth,
                            role: permiso.role,
                        }, firebaseInstance));
                    }
                } else {
                    // Toca crear
                    promesas.push(MyStore.createById(AUTH_TYPE, compundId, {
                        act: AHORA,
                        cre: AHORA,
                        rsc: idResource,
                        who: permiso.who,
                        auth: permiso.auth,
                        role: permiso.role,
                    }, firebaseInstance));
                }
            }
            await Promise.all(promesas);
        });
        res.status(200).send();
    }

    static async readAll(req, res) {
        const idResource = req.params['pageId'];

        const { max, offset } = General.readMaxOffset(req, MAX_READ_SIZE);
        if (!idResource) {
            throw new MalaPeticionException("Falta el id");
        }

        const where = [
            { key: "rsc", oper: "==", value: idResource },
        ];

        const response = await MyStore.paginate(AUTH_TYPE, [], offset, max, where);
        res.status(200).send({
            payload: response,
        });
    }

    static isUserInGroupInternal(user, groups, and) {
        if (!user) {
            return false;
        }
        const currentGroups = user.groups;
        const notMeet = groups.filter((group) => {
            if (currentGroups.indexOf(group) >= 0) {
                return false;
            }
            return true;
        });
        if (and) {
            //All must have
            return notMeet.length == 0;
        } else {
            // At least one
            return notMeet.length < groups.length;
        }
    }

    static isUserInAllGroup(groups) {
        return async (req, res, next) => {
            if (res.locals.user) {
                // Hay usuario
                const cumple = this.isUserInGroupInternal(res.locals.user, groups, true);
                if (cumple) {
                    next();
                } else {
                    res.status(403).send({ message: `User not allowed` });
                }
            } else {
                res.status(403).send({ message: `User not authenticated` });
            }
        }
    }

    static isUserInSomeGroup(groups) {
        return async (req, res, next) => {
            if (res.locals.user) {
                // Hay usuario
                const cumple = this.isUserInGroupInternal(res.locals.user, groups, false);
                if (cumple) {
                    next();
                } else {
                    res.status(403).send({ message: `User not allowed` });
                }
            } else {
                res.status(403).send({ message: `User not authenticated` });
            }
        }
    }

    static hasPagePermisions(listaOr) {
        return async (req, res, next) => {
            // bypass
            if (process.env.BYPASS_PERMISSIONS == "yes") {
                next();
                return;
            }
            if (listaOr.length == 0) {
                next();
                return;
            }
            const pageId = req.params['pageId'];
            let permisions = [];
            if (res.locals.permisions instanceof Array) {
                permisions = res.locals.permisions;
            } else {
                if (pageId) {
                    // Hay página
                    if (res.locals.user) {
                        // Hay usuario
                        permisions = await AuthorizationSrv.getPermisions(pageId, res.locals.user.metadatos.email);
                    } else {
                        // No hay usuario
                        permisions = await AuthorizationSrv.getPermisions(pageId, null);
                    }
                }
                res.locals.permisions = permisions;
            }

            let cumpleOr = false;
            for (let i = 0; i < listaOr.length; i++) {
                const listaAnd = listaOr[i];
                let cumpleAnd = true;
                for (let j = 0; j < listaAnd.length; j++) {
                    const unPermiso = listaAnd[j];
                    cumpleAnd = cumpleAnd && (permisions.indexOf(unPermiso) >= 0);
                }
                cumpleOr = cumpleOr || cumpleAnd;
                if (cumpleOr) {
                    break;
                }
            }
            if (cumpleOr) {
                next();
            } else {
                //next();
                res.status(403).send({ message: `El usuario no puede hacer esa acción ${JSON.stringify(listaOr)} para ${pageId}, tiene ${JSON.stringify(permisions)}` });
            }
        }
    }

    static async getPermisions(idResource, who) {
        const listaIds = [];
        const llavePublica = `${idResource}:`;
        listaIds.push(llavePublica);
        const llavePersonal = `${idResource}:${who}`;
        if (who) {
            listaIds.push(llavePersonal);
        }
        const resultado = await MyStore.readByIds(AUTH_TYPE, listaIds);
        let respuesta = [];
        if (llavePublica in resultado) {
            respuesta = resultado[llavePublica].auth;
        }
        if (llavePersonal in resultado) {
            const permiso = resultado[llavePersonal];
            for (let i = 0; i < permiso.auth.length; i++) {
                const unPermiso = permiso.auth[i];
                if (respuesta.indexOf(unPermiso) < 0) {
                    respuesta.push(unPermiso);
                }
            }
        }
        return respuesta;
    }
}