import { MongoClient, ObjectId } from 'mongodb'
import * as noqlModule from '@synatic/noql';
import * as sortifyModule from "@ejfdelgado/ejflab-common/src/sortify.js";

const SQLParser = noqlModule.default;
const sortify = sortifyModule.default;

export class MongoSrv {
    static getURI() {
        let usr = process.env.MONGO_USR;
        let pass = process.env.MONGO_PASS;
        let uri = process.env.MONGO_URI;
        //console.log(`MONGO_URI=${uri}`);
        let completeUri = `mongodb+srv://${usr}:${pass}@${uri}/test?retryWrites=true&writeConcern=majority`;
        completeUri = `mongodb://${usr}:${pass}@${uri}`;
        return completeUri;
    }
    static releaseMongo(mongoFun) {
        return async (req, res, next) => {
            const { client } = req.data.mongo;
            try {
                await mongoFun(req, res, next);
            } catch (err) {
                throw err;
            } finally {
                console.log("Closing Mongo...");
                await client.close();
                console.log("Closing Mongo... OK");
            }
        }
    }
    static useMongo() {
        return async (req, res, next) => {
            const connectionString = MongoSrv.getURI();
            const client = await MongoClient.connect(connectionString);
            await client.connect();
            const dbName = req.params['db'];

            const body = req.body;
            let collectionName = null;
            let parsedSQL = null;
            if (body) {
                let where = body.where;
                if (where) {
                    if (typeof where == "string") {
                        //console.log(`Parsing ${where}`);
                        // Clean weird whitespaces...
                        where = where.replace(/\s/g, " ");
                        parsedSQL = SQLParser.parseSQL(where);
                        collectionName = parsedSQL.collection;
                    } else {
                        const { collection } = where;
                        collectionName = collection;
                        parsedSQL = where;
                    }
                }
            }

            if (!collectionName) {
                collectionName = req.params['collection'];
            }

            const database = client.db(dbName);
            const collection = database.collection(collectionName);
            //console.log(`Using Mongo db: ${dbName} collection: ${collectionName}`);
            if (!req.data) {
                req.data = {};
            }
            req.data.mongo = {
                client,
                database,
                collection,
                parsedSQL,
                collectionName,
                dbName
            };
            await next();
        };
    }
    // https://www.mongodb.com/docs/drivers/node/current/quick-reference/
    static async write(req, res, next) {
        const { client, database, collection, dbName, collectionName } = req.data.mongo;
        const body = req.body;
        let procesed = null;
        procesed = await MongoSrv.create(collection, body);
        if (procesed) {
            console.log(`Mongo inserted ${dbName}/${collectionName} x ${procesed.insertedCount}`);
        }
        const response = {
            status: "ok",
            procesed
        };
        res.status(200).send(response);
    }
    static async writeLocal(dbName, collectionName, payload) {
        return await MongoSrv.commandLocal(dbName, collectionName, payload, "write");
    }
    static async readLocal(dbName, payload) {
        return await MongoSrv.commandLocal(dbName, null, payload, "read");
    }
    static async deleteLocal(dbName, payload) {
        return await MongoSrv.commandLocal(dbName, null, payload, "delete");
    }
    static async updateLocal(dbName, payload) {
        return await MongoSrv.commandLocal(dbName, null, payload, "update");
    }
    static async indexLocal(dbName, collectionName, payload) {
        return await MongoSrv.commandLocal(dbName, collectionName, payload, "index");
    }
    static async createLocal(dbName, collectionName, payload) {
        return await MongoSrv.commandLocal(dbName, collectionName, payload, "create");
    }
    static async commandLocal(dbName, collectionName, payload, type) {
        const req = {
            params: {
                db: dbName,
                collection: collectionName,
            },
            body: payload,
        };
        //console.log(`commandLocal ${JSON.stringify(req)}`);
        return new Promise((resolve, reject) => {
            const res = {
                status: (code) => {
                    //console.log(`status ${code}`);
                    if (code == 200) {
                        return {
                            send: (response) => {
                                //console.log(`send ${JSON.stringify(response)}`);
                                resolve(response);
                            }
                        }
                    } else {
                        return {
                            send: (response) => {
                                reject(response);
                            }
                        }
                    }
                }
            };
            //console.log("useMongo...");
            MongoSrv.useMongo()(req, res, async () => {
                //console.log("useMongo... OK");
                if (type == "write") {
                    MongoSrv.write(req, res);
                } else if (type == "read") {
                    MongoSrv.read(req, res);
                } else if (type == "delete") {
                    MongoSrv.delete(req, res);
                } else if (type == "update") {
                    MongoSrv.update(req, res);
                } else if (type == "index") {
                    MongoSrv.index(req, res);
                } else if (type == "create") {
                    MongoSrv.createCollection(req, res);
                }
            });
        });
    }
    // Payload could be array or object
    static async create(collection, payload) {
        let localPayload = [];
        if (payload instanceof Array) {
            localPayload = payload;
        } else {
            localPayload.push(payload);
        }
        if (localPayload.length == 0) {
            return null;
        } else {
            return await collection.insertMany(localPayload);
        }
    }
    // Only works at the first level
    static fixId(query) {
        if (!query) {
            return;
        }
        const llaves = Object.keys(query);
        for (let i = 0; i < llaves.length; i++) {
            const llave = llaves[i];
            if (llave == "_id") {
                const opers = query[llave];
                const oper = Object.keys(opers)[0];
                const value = opers[oper];
                //console.log(`${llave} ${oper} ${value}`);
                if (typeof value == "string" || typeof value == "number") {
                    opers[oper] = new ObjectId(value);
                } else if (value instanceof Array) {
                    opers[oper] = value.map((single) => {
                        return new ObjectId(single);
                    });
                }
            }
        }
    }
    static async read(req, res, next) {
        const { client, database, collection, parsedSQL } = req.data.mongo;
        let list = [];
        //console.log(JSON.stringify(parsedSQL, null, 4));
        const projection = {};
        if (parsedSQL.projection) {
            const keyNames = Object.keys(parsedSQL.projection);
            keyNames.forEach((keyName) => {
                projection[keyName] = 1;
            });
        }
        MongoSrv.fixId(parsedSQL.query);
        if (parsedSQL.type === 'query') {
            //console.log(JSON.stringify(parsedSQL.query, null, 4));
            list = await collection
                .find(parsedSQL.query || {})
                .project(projection)
                .skip(parsedSQL.skip || 0)
                .limit(parsedSQL.limit || 50)
                .toArray();
        } else if (parsedSQL.type === 'aggregate') {
            list = await collection
                .aggregate(parsedSQL.pipeline)
                .toArray();
        }

        list.forEach((element) => {
            element["_id"] = element["_id"].toString("utf8");
        });

        const response = {
            status: "ok",
            list
        };
        res.status(200).send(response);
    }
    static async delete(req, res, next) {
        const { client, database, collection, parsedSQL } = req.data.mongo;

        MongoSrv.fixId(parsedSQL.query);
        let procesed = null;
        if (parsedSQL.type === 'query') {
            procesed = await collection.deleteMany(parsedSQL.query || {},);
        }

        const response = {
            status: "ok",
            procesed
        };
        res.status(200).send(response);
    }
    static async update(req, res, next) {
        const { client, database, collection, parsedSQL } = req.data.mongo;
        const { update } = req.body;
        MongoSrv.fixId(parsedSQL.query);
        let procesed = null;
        if (parsedSQL.type === 'query') {
            const llaves = Object.keys(update);
            const updateData = { $set: {} };
            llaves.forEach((llave) => {
                const valor = update[llave];
                updateData["$set"][llave] = valor;
            });
            procesed = await collection.updateMany(parsedSQL.query || {}, updateData);
        }

        const response = {
            status: "ok",
            procesed
        };
        res.status(200).send(response);
    }
    static async index(req, res, next) {
        const { client, database, collection, parsedSQL } = req.data.mongo;
        const indexes = req.body;

        /*
        let oldIndexesIterator = await collection.listIndexes();
        let oldIndexes = oldIndexesIterator.toArray();
        console.log(JSON.stringify(oldIndexes));
        */

        for (let i = 0; i < indexes.length; i++) {
            const { val, opt } = indexes[i];
            const indexResponse = await collection.createIndex(val, opt);
            console.log(indexResponse);
        }

        /*
        oldIndexesIterator = await collection.listIndexes();
        oldIndexes = oldIndexesIterator.toArray();
        console.log(JSON.stringify(oldIndexes));
        */

        const response = {
            status: "ok",
        };
        res.status(200).send(response);
    }
    static async createCollection(req, res, next) {
        const { client, database, collection, parsedSQL } = req.data.mongo;
        const config = req.body;
        console.log(collection);
        //client.createCollection()
        const response = {
            status: "ok",
        };
        res.status(200).send(response);
    }

    static async ping(req, res, next) {
        const connectionString = MongoSrv.getURI();
        const client = await MongoClient.connect(connectionString);
        await client.connect();
        const admin = client.db("admin");
        const result = await admin.command({ listDatabases: 1, nameOnly: true });
        const response = {
            result,
            status: "ok",
        };
        res.status(200).send(response);
    }
}