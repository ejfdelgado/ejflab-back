import fs from "fs";
import { MyTemplate } from "@ejfdelgado/ejflab-common/src/MyTemplate.js";
import { MyUtilities } from '@ejfdelgado/ejflab-common/src/MyUtilities.js';
import { SimpleObj } from '@ejfdelgado/ejflab-common/src/SimpleObj.js';

export class TranslateSrv {
    static keyPromises = {};// this is the cache
    static renderer = new MyTemplate();

    static loadLanguageDB(args, currentLang) {
        // Read query param
        const key = `${args[0]}/${currentLang}`;
        let promesa = TranslateSrv.keyPromises[key];
        if (!promesa) {
            const path = MyUtilities.removeRepeatedSlash(`./src/assets/lang/${key}.json`);
            const exists = fs.existsSync(path);
            if (exists) {
                TranslateSrv.keyPromises[key] = JSON.parse(fs.readFileSync(path));
            } else {
                TranslateSrv.keyPromises[key] = {};
            }
            promesa = TranslateSrv.keyPromises[key];
        }
        const valor = promesa;
        return valor;
    }
    /**
    * 
    * @param key 
    * @param args Can be a string, referencing the folder name in assets/lang/FOLDER/en.json or a JSON object {es: {}, en: {}}
    * @returns 
    */
    static translate(key, args, currentLang = "en") {
        const def = key;
        if (args.length > 0) {
            let valor = {};
            const args0 = args[0];
            if (typeof args0 == 'string') {
                valor = TranslateSrv.loadLanguageDB(args, currentLang);
            } else if (
                args0 !== undefined &&
                args0 !== null &&
                typeof args0 == 'object'
            ) {
                if (currentLang in args0) {
                    valor = args0[currentLang];
                }
            }
            let raw = SimpleObj.getValue(valor, key, def);
            if (args.length >= 2) {
                raw = TranslateSrv.renderer.render(raw, args[1]);
            }
            return raw;
        } else {
            return def;
        }
    }
}