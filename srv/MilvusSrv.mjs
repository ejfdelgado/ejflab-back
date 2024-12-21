import fs from "fs";
import { MilvusClient, DataType } from "@zilliz/milvus2-sdk-node";
import { encode, decode } from "@msgpack/msgpack";
import { General } from "./common/General.mjs";
import { CommandMilvus } from "@ejfdelgado/ejflab-common/src/flowchart/steps/CommandMilvus.js";
import { SimpleObj } from "@ejfdelgado/ejflab-common/src/SimpleObj.js";
import { MyError } from "./MyError.mjs";

export class MilvusSrv {
    // MilvusSrv.checkErrors(res);
    static checkErrors(res) {
        let status = res;
        if ("status" in status) {
            status = status.status;
        }
        if (status.error_code != "Success") {
            throw new Error(status.reason);
        }
    }
    static connect() {
        const uri = process.env.MILVUS_URI;
        console.log(`Milvus uri ${uri}`);
        const parts = /^\s*(https?):\/\/([^:]+):(\d+)\s*$/i.exec(uri)
        const scheme = parts[1];
        const host = parts[2];
        const port = parts[3];
        const client = new MilvusClient(uri);
        return {
            scheme,
            host,
            port,
            client
        }
    }
    static async releaseConnection(client) {
        console.log("Milvus disconnect");
        await client.closeConnection();
    }
    static async existsDatabase(client, name) {
        const res = await client.listDatabases();
        return res.db_names.indexOf(name) >= 0;
    }
    static async existsCollection(client, name) {
        const resListCollections = await client.listCollections();
        MilvusSrv.checkErrors(resListCollections);
        const { data } = resListCollections;
        return data.indexOf(name) >= 0;
    }
    static async introspect(client) {
        const res = await client.listDatabases();
        MilvusSrv.checkErrors(res);
        const databases = res.db_names;
        const response = { dbs: [] };
        for (let i = 0; i < databases.length; i++) {
            const database = databases[i];
            console.log(`- Database: ${database}`);
            const myDb = {
                name: database,
                collections: []
            };
            response.dbs.push(myDb);
            const resUseDatabase = await client.useDatabase({ db_name: database });
            MilvusSrv.checkErrors(resUseDatabase);
            const resListCollections = await client.listCollections();
            MilvusSrv.checkErrors(resListCollections);
            const { data } = resListCollections;
            for (let j = 0; j < data.length; j++) {
                const collection = data[j];
                console.log(`    - Collection: ${collection.name}`);
                myDb.collections.push({ name: collection.name });
            }
        }
        return response;
    }
    static async dropDatabaseTemp(client) {
        const res = await client.listDatabases();
        MilvusSrv.checkErrors(res);
        const databases = res.db_names;
        for (let i = 0; i < databases.length; i++) {
            const database = databases[i];
            if (database.startsWith("temp_")) {
                await MilvusSrv.dropDatabase(client, database)
            }
        }
    }

    static async describeCollectionOfDatabase(client, db_name, collection_name) {
        const resUseDatabase1 = await client.useDatabase({ db_name: db_name });
        MilvusSrv.checkErrors(resUseDatabase1);
        const description = await client.describeCollection({ collection_name: collection_name });
        return description;
    }

    static async dropCollectionOfDatabase(client, db_name, collection_name) {
        const resUseDatabase1 = await client.useDatabase({ db_name: db_name });
        MilvusSrv.checkErrors(resUseDatabase1);
        await MilvusSrv.dropCollection(client, collection_name);
        return true;
    }

    static async dropCollection(client, collection_name) {
        console.log(`Drop collection ${collection_name}...`);
        const resHasCollection = await client.hasCollection({ collection_name });
        MilvusSrv.checkErrors(resHasCollection);
        if (!resHasCollection.value) {
            console.log(`Drop collection ${collection_name} NOT EXISTS...`);
            return false;
        }
        const resDrop = await client.dropCollection({ collection_name });
        MilvusSrv.checkErrors(resDrop);
        console.log(`Drop collection ${collection_name}... OK`);
        return true;
    }
    static async dropDatabase(client, name) {
        console.log(`Drop database ${name}...`);
        const resUseDatabase1 = await client.useDatabase({ db_name: name });
        MilvusSrv.checkErrors(resUseDatabase1);
        const resListCollections = await client.listCollections();
        MilvusSrv.checkErrors(resListCollections);
        const { data } = resListCollections;
        for (let j = 0; j < data.length; j++) {
            const collection = data[j];
            await MilvusSrv.dropCollection(client, collection.name);
        }
        const resDropDatabase = await client.dropDatabase({ db_name: name });
        MilvusSrv.checkErrors(resDropDatabase);
    }
    static async useDatabase(client, name, recreate = false) {
        console.log(`Use database ${name} recreate? ${recreate}...`);
        if (!await MilvusSrv.existsDatabase(client, name)) {
            console.log(`Creating '${name}' database...`);
            const resCreate = await client.createDatabase({ db_name: name });
            MilvusSrv.checkErrors(resCreate);
        } else {
            if (recreate) {
                console.log(`Recreating '${name}' database...`);
                await MilvusSrv.dropDatabase(client, name);
                const resCreate = await client.createDatabase({ db_name: name });
                MilvusSrv.checkErrors(resCreate);
            } else {
                console.log(`Using old '${name}' database...`);
            }
        }
        const resUseDatabase2 = await client.useDatabase({ db_name: name });
        MilvusSrv.checkErrors(resUseDatabase2);
        console.log(`Use database ${name} recreate? ${recreate}... OK`);
    }
    static getDataType(text) {
        const parts = text.split(".");
        return DataType[parts[1]];
    }
    static async createCollectionWithSchema(client, myJson, recreate = false) {
        // Translate data types
        const myCopy = JSON.parse(JSON.stringify(myJson));
        const collection_name = myCopy.collection_name;
        console.log(`createCollectionWithSchema... ${collection_name}`);
        const exists = await this.existsCollection(client, collection_name);
        if (exists) {
            if (recreate) {
                // Erase
                await MilvusSrv.dropCollection(client, collection_name);
            } else {
                // Do nothing
                console.log(`Using old collection ${collection_name}`);
                return;
            }
        }
        const { fields } = myCopy;
        for (let i = 0; i < fields.length; i++) {
            const field = fields[i];
            field.data_type = MilvusSrv.getDataType(field.data_type);
        }
        const res = await client.createCollection(myCopy);
        MilvusSrv.checkErrors(res);
    }
    /*
    action:
    database.create
    database.recreate
    collection.create
    collection.destroy
    introspect
    database.destroy
    database.destroy_temp
    */
    static async admin(req, res, next) {
        //this.context.getSuperContext().getMilvusClient();
        const context = {
            getSuperContext: () => {
                return {
                    getMilvusClient: () => {
                        return MilvusSrv;
                    }
                };
            },
            data: {
                configuration: {}
            },
        };
        const id = '';
        const commandName = 'milvus';
        const argsTxt = '';
        const command = new CommandMilvus(context, id, commandName, argsTxt);
        const action = General.readParam(req, "action", null);
        const db = General.readParam(req, "db", null);
        let collection = General.readParam(req, "collection", null);
        if (action == "collection.create") {
            // Read configuration file...
            const json = General.readParam(req, "json", null);
            const jsonTxt = fs.readFileSync(json, { encoding: "utf8" });
            const jsonParsed = JSON.parse(jsonTxt);
            const path = General.readParam(req, "path", null);
            const configuration = SimpleObj.getValue(jsonParsed, path, null);
            context.data.configuration = configuration;
            collection = "configuration";
        }
        command.args = [action, db, collection];
        const answer = await command.computation();
        const response = {
            args: command.args,
            answer: answer,
            status: "ok",
        };
        res.status(200).send(response);
    }
    static async ping(req, res, next) {
        const { client } = MilvusSrv.connect();
        const databases = await client.listDatabases();
        MilvusSrv.checkErrors(databases);
        const response = {
            databases,
            status: "ok",
        };
        res.status(200).send(response);
    }
    static async insert(req, res, next) {
        console.log("Milvus insert...");
        const { client } = MilvusSrv.connect();
        let code = 200;
        const response = {
            status: "ok"
        };
        let decoded = null;
        try {
            // get the request
            const buffer = req.body;
            decoded = decode(buffer);
            const {
                db_name,
                collection_name,
                data
            } = decoded;
            await MilvusSrv.useDatabase(client, db_name, false);
            let dataArray = data;
            if (!(dataArray instanceof Array)) {
                dataArray = [dataArray];
            }
            await client.insert({
                collection_name: collection_name,
                data: dataArray
            });
            console.log("Milvus insert... OK");
        } catch (err) {
            console.log("Error inserting");
            console.log(decoded);
            console.log(err);
            code = 500;
            response.status = "error";
            response.message = err.message;
        } finally {
            await client.closeConnection();
            res.status(code).send(response);
        }
    }
    static async search(req, res, next) {
        const { client } = MilvusSrv.connect();
        let code = 200;
        const response = {
            status: "ok"
        };
        try {
            // get the request
            const buffer = req.body;
            const decoded = decode(buffer);
            // Connect to database
            let {
                db_name,
                collection_name,
                embeed,
                paging,
                search_params,
                output_fields,
                consistency_level,
            } = decoded;
            console.log(`Using database ${db_name}`);
            await MilvusSrv.useDatabase(client, db_name, false);
            if (!search_params) {
                search_params = {
                    "metric_type": "IP",
                    "topk": paging['limit'],// here is redundant!
                    "params": JSON.stringify({ nprobe: 1024 }),
                };
            }
            if (!output_fields) {
                output_fields = ['id', 'document_id', 'face_path', 'millis', 'x1', 'y1', 'x2', 'y2', 'ref_id'];
            }
            if (!consistency_level) {
                consistency_level = "Strong";
            }
            const searchPayload = {
                collection_name: collection_name,
                data: [embeed],//??
                limit: paging['limit'],
                offset: paging['offset'],
                consistency_level: consistency_level,
                search_params: search_params,
                output_fields: output_fields
            };
            const results = await client.search(searchPayload);
            if (results.status.code != 0) {
                throw new MyError(results.status.error_code + ". " + results.status.reason)
            }
            //console.log(JSON.stringify(results, null, 4));
            response.results = [results.results.map((entity) => {
                return {
                    id: entity.id,
                    distance: entity.score,//is it the same?
                    entity
                };
            })];
        } catch (err) {
            console.log(err);
            code = 500;
            response.status = "error";
            response.message = err.message;
        } finally {
            await client.closeConnection();
            res.status(code).send(response);
        }
    }
}