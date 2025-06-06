import pg from "pg";
import fs from "fs";
import { MyTemplate } from "@ejfdelgado/ejflab-common/src/MyTemplate.js";
import { consoleSrv } from "./ConsoleSrv.mjs";
const { Pool } = pg;

export class PostgresSrv {
    static renderer = new MyTemplate();
    static pool = null;
    static {
        PostgresSrv.renderer.registerFunction("noQuotes", PostgresSrv.noQuotes);
        PostgresSrv.renderer.registerFunction("singleWord", PostgresSrv.singleWord);
        PostgresSrv.renderer.registerFunction("sanitizeNumber", PostgresSrv.sanitizeNumber);
        PostgresSrv.renderer.registerFunction("sanitizeText", PostgresSrv.sanitizeText);
        PostgresSrv.renderer.registerFunction("sanitizeTextNull", PostgresSrv.sanitizeTextNull);
        const types = pg.types;
        types.setTypeParser(types.builtins.INT8, function (val) {
            const bigNumber = BigInt(val);
            if (bigNumber > Number.MAX_SAFE_INTEGER) {
                // Fallback...
                return 0;
            }
            return Number(bigNumber);
        });
        types.setTypeParser(types.builtins.NUMERIC, function (val) {
            const bigNumber = parseFloat(val);
            if (isNaN(bigNumber)) {
                // Fallback...
                return null;
            }
            return bigNumber;
        });
        types.setTypeParser(types.builtins.BIT, function (val) {
            const myBit = parseInt(val);
            if (isNaN(myBit)) {
                // Fallback...
                return null;
            }
            return myBit;
        });
    }
    static noQuotes(val, ...args) {
        if ([null, undefined].indexOf(val) >= 0) {
            return "NULL";
        }
        return val.replace(/'/g, "''");
    }
    static singleWord(val, ...args) {
        const text = PostgresSrv.sanitizeTextNull(val);
        return text.split(/\s+/g)[0];
    }
    static sanitizeText(val, ...args) {
        let text = val;
        if ([null, undefined].indexOf(text) >= 0) {
            if (typeof args[0] == "string") {
                return args[0];
            }
            return "";
        }
        text = `${text}`;
        text = PostgresSrv.noQuotes(text);
        return text;
    }
    static sanitizeTextNull(val, ...args) {
        if ([null, undefined].indexOf(val) >= 0) {
            return "NULL";
        }
        let text = PostgresSrv.noQuotes(`${val}`, args);
        return text;
    }
    static sanitizeNumber(val, ...args) {
        let myNumber = parseFloat(val);
        if (isNaN(myNumber)) {
            if (typeof args[0] == "number") {
                return args[0];
            }
            return 'NULL';
        }
        return myNumber;
    }
    static getConnectionParams() {
        const host = process.env.POSTGRES_HOST || "postgres";
        const port = parseInt(process.env.POSTGRES_PORT || "5432");
        const database = process.env.POSTGRES_DB || "nogales";
        const user = process.env.POSTGRES_USER || "user";
        const password = process.env.POSTGRES_PASSWORD || "pass";
        const timeout = process.env.POSTGRES_TIMEOUT || "2000";
        return {
            host,
            port,
            database,
            user,
            password,
            timeout,
        };
    }

    static async executeTextInTransaction(sql, model = {}) {
        const pool = await PostgresSrv.getPool();
        const client = await pool.connect();
        await client.query("BEGIN");
        try {
            // Insert into media
            const result = await PostgresSrv.executeText(sql, model, client);
            await client.query("COMMIT");
            return result;
        } catch (e) {
            await client.query("ROLLBACK");
            throw e;
        } finally {
            client.release();
        }
    }

    static async executeText(sql, model = {}, client = null) {
        const sqlRendered = PostgresSrv.renderer.render(sql, model);
        consoleSrv.log(sqlRendered);
        let localClient = false;
        if (!client) {
            const pool = await PostgresSrv.getPool();
            localClient = true;
            client = await pool.connect();
        }
        const result = await client.query(sqlRendered);
        if (localClient) {
            client.release();
        }
        return result;
    }

    static async executeFile(path, model = {}, client = null) {
        const sql = fs.readFileSync(path, "utf-8");
        return await PostgresSrv.executeText(sql, model, client);
    }

    static async executeFileInTransaction(path, model = {}) {
        const sql = fs.readFileSync(path, "utf-8");
        return await PostgresSrv.executeTextInTransaction(sql, model);
    }

    static createPool() {
        const params = PostgresSrv.getConnectionParams();
        PostgresSrv.pool = new Pool({
            user: params.user,
            password: params.password,
            host: params.host,
            port: params.port,
            database: params.database,
            connectionTimeoutMillis: parseInt(params.timeout),
        });
        PostgresSrv.pool.on('error', (err) => {
            // try reconnect given the tipe of error
            consoleSrv.error("-------------------------------------");
            consoleSrv.error("------------------ Handling error ---");
            consoleSrv.error("-------------------------------------");
            consoleSrv.error(JSON.stringify(err.message));
            if (err.message == "read ETIMEDOUT") {
                PostgresSrv.createPool();
            }
        });
    }

    static async checkSelect1() {
        if (PostgresSrv.pool == null) {
            PostgresSrv.createPool();
        }
        try {
            await PostgresSrv.pool.query('SELECT 1;');
            return true;
        } catch (err) {
            return false;
        }
    }

    static async getPool() {
        const canSelect1 = await PostgresSrv.checkSelect1();
        if (!canSelect1) {
            PostgresSrv.createPool();
        }
        return PostgresSrv.pool;
    }

    static async test(req, res, next) {
        const model = { other: "other" };
        const result = await PostgresSrv.executeText("SELECT NOW() as ping", model);
        const row = result.rows[0];
        res.status(200).send({ row });
    }

    static async simpleTest() {
        const testsNumber = [
            { type: 'sanitizeNumber', in: undefined, expected: 'NULL', def: undefined },
            { type: 'sanitizeNumber', in: null, expected: 'NULL', def: undefined },
            { type: 'sanitizeNumber', in: "", expected: 'NULL', def: undefined },
            { type: 'sanitizeNumber', in: undefined, expected: 1, def: 1 },
            { type: 'sanitizeNumber', in: null, expected: 1, def: 1 },
            { type: 'sanitizeNumber', in: "", expected: 1, def: 1 },
            { type: 'sanitizeNumber', in: "3", expected: 3, def: 1 },
            { type: 'sanitizeNumber', in: "5.26", expected: 5.26, def: 1 },
            //
            { type: 'sanitizeText', in: undefined, expected: "" },
            { type: 'sanitizeText', in: null, expected: "" },
            { type: 'sanitizeText', in: 5, expected: "5" },
            { type: 'sanitizeText', in: undefined, expected: "nothing", def: "nothing" },
            { type: 'sanitizeText', in: null, expected: "nothing", def: "nothing" },
            { type: 'sanitizeText', in: "", expected: "", def: "nothing" },
            //
            { type: 'sanitizeTextNull', in: "", expected: "''", def: "" },
            { type: 'sanitizeTextNull', in: null, expected: "NULL", def: "" },
            { type: 'sanitizeTextNull', in: undefined, expected: "NULL", def: "" },
            { type: 'sanitizeTextNull', in: 5, expected: "'5'", def: "" },
            { type: 'sanitizeTextNull', in: "Prueba'", expected: "'Prueba'''", def: "" },
        ];
        for (let i = 0; i < testsNumber.length; i++) {
            const actual = testsNumber[i];
            const returned = this[actual.type](actual.in, actual.def);
            if (JSON.stringify(returned) != JSON.stringify(actual.expected)) {
                throw new Error(`Test ${i + 1} In: ${actual.in} Actual: ${returned} but expected ${actual.expected}`);
            }
        }
        consoleSrv.log(`Test passed ${testsNumber.length}!`);

        //consoleSrv.log(PostgresSrv.renderer.render('Hola ${name} with age ${age | sanitizeNumber :  0}', {name: "Edgar", age: undefined}));
    }
}

// node PostgresSrv.mjs
//PostgresSrv.simpleTest();