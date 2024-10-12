import pg from 'pg'
import fs from "fs";
import { MyTemplate } from '../srcJs/MyTemplate.js';
const { Pool } = pg


export class PostgresSrv {
    static renderer = new MyTemplate();
    static pool = null;
    static {
        PostgresSrv.renderer.registerFunction("noQuotes", PostgresSrv.noQuotes);
        PostgresSrv.renderer.registerFunction("sanitizeText", PostgresSrv.sanitizeText);
        const types = pg.types;
        types.setTypeParser(types.builtins.INT8, function (val) {
            const bigNumber = BigInt(val);
            if (bigNumber > Number.MAX_SAFE_INTEGER) {
                // Fallback...
                return 0;
            }
            return Number(bigNumber);
        });
    }
    static noQuotes(val, ...args) {
        return val.replace(/'/g, "''");
    }
    static sanitizeText(val, ...args) {
        let text = val;
        text = PostgresSrv.noQuotes(text);
        return text;
    }
    static getConnectionParams() {
        const host = process.env.POSTGRES_HOST || "postgres";
        const port = parseInt(process.env.POSTGRES_PORT || "5432");
        const database = process.env.POSTGRES_DB || "nogales";
        const user = process.env.POSTGRES_USER || "user";
        const password = process.env.POSTGRES_PASSWORD || "pass";
        return {
            host,
            port,
            database,
            user,
            password
        };
    }

    static async executeTextInTransaction(sql, model = {}) {
        const pool = PostgresSrv.getPool();
        const client = await pool.connect();
        await client.query('BEGIN')
        try {
            // Insert into media
            const result = await PostgresSrv.executeText(sql, model, client);
            await client.query('COMMIT');
            return result;
        } catch (e) {
            await client.query('ROLLBACK');
            throw e
        } finally {
            client.release();
        }
    }

    static async executeText(sql, model = {}, client = null) {
        const sqlRendered = PostgresSrv.renderer.render(sql, model);
        console.log(sqlRendered);
        let localClient = false;
        if (!client) {
            const pool = PostgresSrv.getPool();
            localClient = true;
            client = await pool.connect()
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

    static getPool() {
        if (PostgresSrv.pool == null) {
            const params = PostgresSrv.getConnectionParams();
            PostgresSrv.pool = new Pool({
                user: params.user,
                password: params.password,
                host: params.host,
                port: params.port,
                database: params.database,
            });
        }
        return PostgresSrv.pool;
    }

    static async test(req, res, next) {
        const model = { other: "other" };
        const result = await PostgresSrv.executeText("SELECT NOW() as ping", model);
        const row = result.rows[0];
        res.status(200).send({ row });
    }
}
