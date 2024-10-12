
// https://d1ril7hq6s7m5z.cloudfront.net/latam/en/docs/getting-started/response-codes-and-variables.html
export class PayUSrvConstants {
    static ENDPOINTS = {
        // Credenciales de prueba?
        // https://developers.payulatam.com/latam/es/docs/getting-started/test-your-solution.html
        "dev": {
            "serviceCgi": "https://sandbox.api.payulatam.com/payments-api/4.0/service.cgi",
            "paymentsUrl": "https://sandbox.api.payulatam.com/payments-api/",
            "reportsUrl": "https://sandbox.api.payulatam.com/reports-api/",

        },
        "pro": {
            "serviceCgi": "https://api.payulatam.com/payments-api/4.0/service.cgi",
            "paymentsUrl": "https://api.payulatam.com/payments-api/",
            "reportsUrl": "https://api.payulatam.com/reports-api/",
        }
    }
    //https://d1ril7hq6s7m5z.cloudfront.net/latam/en/docs/getting-started/response-codes-and-variables.html#processing-countries
    static VALID_COUNTRIES = ["AR", "BR", "CL", "CO", "MX", "PA", "PE"];
    static DOCUMENT_TYPES = [
        { txt: "Cédula de ciudadanía", val: "CC" },
        { txt: "Cédula de extrangería", val: "CE" },
        { txt: "Teléfono móvil", val: "CEL" },
        { txt: "Nit", val: "NIT" },
        { txt: "Registro civil", val: "RC" },
        { txt: "Tarjeta de identidad", val: "TI" },
    ];
    static LANGUAGES = [
        { txt: "Español", val: "es" },
        { txt: "English", val: "en" },
        { txt: "Português", val: "pt" },
    ];
    static COUNTRIES = [
        { txt: "Colombia", val: "CO" },
    ];
    static CURRENCIES = [
        { txt: "Peso Colombiano", val: "COP" },
        { txt: "Dolar Estadounidense", val: "USD" },
        { txt: "Peso Argentino", val: "ARS" },
        { txt: "Real Brasilero", val: "BRL" },
        { txt: "Peso Chileno", val: "CLP" },
        { txt: "Peso Mexicano", val: "MXN" },
        { txt: "Sol Peruano", val: "PEN" },
    ];
}