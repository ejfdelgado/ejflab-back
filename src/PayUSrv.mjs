import axios from "axios";
import geoip from 'geoip-lite';
import { PayUSrvConstants } from "./PayUSrvConstants.mjs";
import { SecretsSrv } from "./SecretsSrv.mjs";

/**
 * It is important to validate the length and numbers of credit cards by franchise, together with the security codes.
 */
export class PayUSrv {
    static DEFAULTS = {
        "timeout": 60000,//Maximum said by payu
        "language": PayUSrvConstants.LANGUAGES[0].val,
        "country": PayUSrvConstants.COUNTRIES[0].val,
        "currency": PayUSrvConstants.CURRENCIES[0].val,
        //"keysprefix": "edelgado@panal.co-payu-",
        "keysprefix": "info@pais.tv+",
        //"keysprefix": "edgar.jose.fernando.delgado@gmail.com+",
    };
    static mode = "dev";
    static endpoint = PayUSrvConstants.ENDPOINTS[PayUSrv.mode];

    /*
    [
        {
            txt: "AMEX",
            val: "12"
        },
        {
            txt: "PSE",
            val: "254"
        },
    ]
    */
    static async paymentmethods(req, res, next) {
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const response = await PayUSrv.getPaymentMethodsLocal(clientIp);
        res.status(200).json(response.data.paymentMethods).end();
    }
    /*
    [
        {
            val: "fd8273ef-2fe8-4598-91d6-f09ecdff42c9",
            txt: "ALIANZA FIDUCIARIA S A",
            pseCode: "5016"
        },
    ]
    */
    static async psebanks(req, res, next) {
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const response = await PayUSrv.getPSEBankListLocal(clientIp);
        res.status(200).json(response.data.banks).end();
    }
    static async ping(req, res, next) {
        const response = await PayUSrv.pingLocal();
        res.status(200).json(response.data).end();
    }
    static async getPSEBankListLocal(clientIp) {
        const country = PayUSrv.getCurrentCountryFromIp(clientIp);
        PayUSrv.checkValidCountry(country);
        const request = {
            "command": "GET_BANKS_LIST",
            "bankListInformation": {
                paymentMethod: "PSE",
                paymentCountry: country,
            }
        };
        const response = await PayUSrv.generalRequest(request);
        PayUSrv.checkReponseError(response);
        const NO_PSE_CODES = ["0"];
        response.data.banks = response.data.banks.filter((el) => {
            return NO_PSE_CODES.indexOf(el.pseCode) < 0;
        }).map((el) => {
            return { val: el.id, txt: el.description, pseCode: el.pseCode };
        });
        return response;
    }
    static async pingLocal() {
        const request = {
            "command": "PING",
        };
        const response = await PayUSrv.generalRequest(request);
        PayUSrv.checkReponseError(response);
        return response;
    }
    static async getPaymentMethodsLocal(clientIp) {
        const country = PayUSrv.getCurrentCountryFromIp(clientIp);
        PayUSrv.checkValidCountry(country);
        const request = {
            "command": "GET_PAYMENT_METHODS",
        };
        const response = await PayUSrv.generalRequest(request);
        PayUSrv.checkReponseError(response);
        // Se debe filtrar por país actual
        response.data.paymentMethods = response.data.paymentMethods.filter((oneMethod) => {
            return oneMethod.country == country && oneMethod.enabled;
        }).map((actual) => {
            return { txt: actual.description, val: actual.id };
        });

        return response;
    }
    static async generalRequest(extra) {
        const credentials = await PayUSrv.getCredentials();
        const request = {
            "test": PayUSrv.isTest(),
            "language": PayUSrv.DEFAULTS.language,

            "merchant": {
                "apiLogin": credentials.payu_api_login,
                "apiKey": credentials.payu_api_key,
            }
        };
        Object.assign(request, extra);
        // Call the service...
        const url = PayUSrv.endpoint.serviceCgi;
        const options = {
            timeout: PayUSrv.DEFAULTS.timeout,
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Accept': 'application/json',
            },
        };
        const response = await new Promise((resolve, reject) => {
            axios.post(url, request, options)
                .then(res => { resolve(res) })
                .catch(error => {
                    if (error.code === 'ECONNABORTED') {
                        reject(error);
                    } else {
                        reject(error);
                    }
                });
        });

        //console.log(response.data);
        //console.log(`response.status = ${response.status}`);
        //console.log(`response.statusText = ${response.statusText}`);
        //console.log(response.headers);
        //console.log(response.config);

        if ([200].indexOf(response.status) < 0) {
            throw new Error(response.statusText);
        }

        return response;
    }
    static getCurrentCountryFromIp(clientIp) {
        clientIp = "186.102.39.136";
        const detail = geoip.lookup(clientIp);
        //console.log(`clientIp = ${clientIp} detail.country = ${detail.country}`);
        if (detail == null) {
            //throw new Error("No se puede determinar en qué país te encuentras.");
            return PayUSrv.DEFAULTS.country;
        } else {
            // 2 letter ISO-3166-1 country code
            return detail.country;
        }
    }
    static checkReponseError(response) {
        if (response.data.code !== "SUCCESS") {
            if (typeof response.data.error == "string") {
                throw new Error(response.data.error);
            }
        }
    }
    static checkValidCountry(country) {
        if (PayUSrvConstants.VALID_COUNTRIES.indexOf(country) < 0) {
            throw new Error(`Tu país ${country} no acepta pagos por este medio.`);
        }
    }
    static setMode(mode) {
        if (["dev", "pro"].indexOf(mode) < 0) {
            throw Error("Se debe seleccionar un modo dev o pro");
        }
        PayUSrv.mode = mode;
        PayUSrv.endpoint = PayUSrvConstants.ENDPOINTS[PayUSrv.mode];
    }
    static async getCredentials() {
        const respuesta = await SecretsSrv.localRead(["payu_api_login", "payu_api_key"], PayUSrv.DEFAULTS.keysprefix);
        const mapa = respuesta.mapa;
        return mapa;
    }
    static isTest() {
        return !(PayUSrv.mode == "pro");
    }
}
