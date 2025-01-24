import { MyUtilities } from "@ejfdelgado/ejflab-common/src/MyUtilities.js";
import { MyFileService } from "../MyFileService.mjs";
import { MyConstants } from "@ejfdelgado/ejflab-common/src/MyConstants.js";
import { MyStore } from "./MyStore.mjs";
import { General } from "./General.mjs";
import { MalaPeticionException } from "../MyError.mjs";
import { Buffer } from 'buffer';

const AUTH_PROVIDER = process.env.AUTH_PROVIDER;
const groupIdMap = JSON.parse("AUTH_GROUP_ID_MAP" in process.env ? Buffer.from(process.env.AUTH_GROUP_ID_MAP, 'base64').toString("utf8") : "{}");
const USER_TYPE = "user";

export class Usuario {
    metadatos = null;
    id = null;
    email = null;
    phone = null;
    groups = [];
    constructor(token) {
        this.metadatos = token;
        if (this.metadatos != null) {
            if (this.metadatos.email) {
                this.email = this.metadatos.email;
            }
            if (AUTH_PROVIDER == "microsoft") {
                this.id = token.oid;
                this.email = token.preferred_username;
                if (token.groups instanceof Array) {
                    this.groups = token.groups.map((idGroup) => {
                        if (idGroup in groupIdMap) {
                            return groupIdMap[idGroup];
                        }
                        return idGroup;
                    });
                }
                //console.log(`id: ${this.id}`);
                //console.log(`email: ${this.email}`);
                //console.log(`groups: ${JSON.stringify(this.groups)}`);
            } else {
                if ("firebase" in this.metadatos) {
                    const contenedor = this.metadatos["firebase"];
                    const identidades = contenedor["identities"];
                    if ("email" in identidades) {
                        this.id = identidades["email"][0];
                        this.email = this.id;
                    } else if ("phone" in identidades) {
                        this.id = identidades["phone"][0];
                        this.phone = this.id;
                    }
                }
            }
        }
    }
    static async getCurrentUser(req, res, next) {
        const user = res.locals.user;
        const token = res.locals.token;
        const sessionToken = res.locals.sessionToken;
        if (sessionToken) {
            res.cookie('yo', sessionToken, { maxAge: 1000 * 60 * 60 * 24, httpOnly: true });
        }
        // Debo buscar el usuario de base de datos
        const response = await MyStore.readById(USER_TYPE, user.id);
        if (response) {
            res.status(200).send(response);
        } else {
            // Si no existe lo creo
            const AHORA = new Date().getTime();
            const email = user.email;
            const prefijoEmail = /^[^@]+/.exec(email)[0]
            const nuevo = {
                email: email,
                name: (token.name ? token.name : prefijoEmail),//El nombre será la primera parte del mail
                phone: user.phone,
            };
            const q = `${nuevo.name ? nuevo.name : ""} ${prefijoEmail}`;
            user.search = MyUtilities.partirTexto(q, true);
            if (token.picture) {
                nuevo.picture = await MyFileService.fetchUrl2Bucket(token.picture, token, MyConstants.USER.DEFAULT_FOLDER, MyConstants.USER.DEFAULT_FILE);
            } else {
                // Podría aquí hacerce un random
                nuevo.picture = MyConstants.USER.DEFAULT_IMAGE;
            }
            nuevo.created = AHORA;
            nuevo.updated = AHORA;
            await MyStore.createById(USER_TYPE, user.id, nuevo);
            nuevo.id = user.id;
            res.status(200).send(nuevo);
        }
    }

    static async saveMyUser(req, res, next) {
        const user = res.locals.user;
        const datos = General.readParam(req, "datos");
        if (!datos || !(typeof datos == "object")) {
            throw new MalaPeticionException("Falta datos");
        }
        const AHORA = new Date().getTime();
        const updated = {
            updated: AHORA,
        };
        const LLAVES = ["name", "email", "phone", "created"];
        const LLAVES_SEARCH = ["name", "phone"];
        let searchable = "";
        for (let i = 0; i < LLAVES.length; i++) {
            const llave = LLAVES[i];
            const valor = datos[llave];
            if (LLAVES_SEARCH.indexOf(llave) >= 0 && typeof valor == "string") {
                searchable += valor + " ";
            }
            updated[llave] = valor;
        }
        updated.search = MyUtilities.partirTexto(searchable);
        updated.search.push(user.id);
        if (typeof datos.email == "string" && datos.email.length > 0) {
            updated.search.push(datos.email);
        }
        await MyStore.updateById(USER_TYPE, user.id, updated);
        updated.id = user.id;
        updated.picture = datos.picture;
        delete updated.search;
        res.status(200).send(updated);
    }
}