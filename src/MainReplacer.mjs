import { MyConstants } from "../srcJs/MyConstants.js";
import { MyUtilities } from "../srcJs/MyUtilities.js"

export class MainReplacer {
    static replace(rta, replaces, theUrl) {
        const REMPLAZOS = [
            {
                old: /name="og:title"[\s]+content="[^"]*"/,
                new: `name="og:title" content="${MyUtilities.htmlEntities(replaces.tit)}"`,
                empty: typeof replaces.tit != "string" || replaces.tit.length == 0,
            },
            {
                old: /name="og:description"[\s]+content="[^"]*"/,
                new: `name="og:description" content="${MyUtilities.htmlEntities(
                    replaces.desc
                )}"`,
                empty: typeof replaces.desc != "string" || replaces.desc.length == 0,
            },
            {
                old: /name="og:image"[\s]+content="[^"]*"/,
                new: `name="og:image" content="${replaces.img}"`,
                empty: typeof replaces.img != "string" || replaces.img.length == 0,
            },
            {
                old: /name="og:url"[\s]+content="[^"]*"/,
                new: `name="og:url" content="${theUrl.href}"`,
            },
            {
                old: /name="keywords"[\s]+content="[^"]*"/,
                new: `name="keywords" content="${replaces.kw}"`,
                empty: typeof replaces.kw != "string" || replaces.kw.length == 0,
            },
            {
                old: /<title>.*?<\/title>/,
                new: `<title>${MyUtilities.htmlEntities(replaces.tit)}<\/title>`,
                empty: typeof replaces.tit != "string" || replaces.tit.length == 0,
            },
            {
                old: /name="pageId"[\s]*content="[^"]*"/,
                new: `name="pageId" content="${replaces.id}"`,
                empty: typeof replaces.id != "string" || replaces.id.length == 0,
            },
            {
                old: /name="random"[\s]*content="[^"]*"/,
                new: `name="random" content="${replaces.pass}"`,
                empty: typeof replaces.pass != "string" || replaces.pass.length == 0,
            },
            {
                old: /name="custom"[\s]*content="[^"]*"/,
                new: `name="custom" content="${replaces.firebase}"`,
                empty: typeof replaces.firebase != "string" || replaces.firebase.length == 0,
            },
            {
                old: /name="time"[\s]*content="[^"]*"/,
                new: `name="time" content="${replaces.time}"`,
                empty: typeof replaces.time != "string" || replaces.time.length == 0,
            },
            {
                old: /<base[\s]*href="[^"]*">/,
                new: `<base href="${MyConstants.SRV_ROOT}">`,
                empty: typeof replaces.time != "string" || replaces.time.length == 0,
            }
        ];
        if (
            rta != null &&
            typeof rta.data == "string" &&
            rta.metadata.filename == "index.html"
        ) {
            for (let i = 0; i < REMPLAZOS.length; i++) {
                const remplazo = REMPLAZOS[i];
                if (!remplazo.empty) {
                    rta.data = rta.data.replace(remplazo.old, remplazo.new);
                }
            }
        }
    }
}