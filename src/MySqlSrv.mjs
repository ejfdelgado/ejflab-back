import * as mysql from "mysql2/promise";

export class MySqlSrv {
    connectionPromise = null;
    connection = null;
    constructor() {
    }

    getConnectionParams() {
        const host = process.env.PMA_HOST || "localhost";
        const port = parseInt(process.env.PMA_PORT || "6033");
        const database = process.env.MYSQL_DATABASE || "policia_vr";
        const user = process.env.MYSQL_ROOT_USER || "root";
        const password = process.env.MYSQL_ROOT_PASSWORD || "p0l1c14";
        return {
            host,
            port,
            user,
            database,
            password,
            waitForConnections: true,
            connectionLimit: 10,
            maxIdle: 10, // max idle connections, the default value is the same as `connectionLimit`
            idleTimeout: 60000, // idle connections timeout, in milliseconds, the default value 60000
            queueLimit: 0,
            enableKeepAlive: true,
            keepAliveInitialDelay: 0
        };
    }

    async connect() {
        this.connectionPromise = mysql.createPool(this.getConnectionParams());
        this.connection = await this.connectionPromise;
    }

    async checkConnection() {
        await this.connectionPromise;
    }

    async disconnect() {
        this.connection.end();
    }
}
