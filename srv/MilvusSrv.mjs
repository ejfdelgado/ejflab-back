import { MilvusClient, DataType } from "@zilliz/milvus2-sdk-node";

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
        for (let i = 0; i < databases.length; i++) {
            const database = databases[i];
            console.log(`- Database: ${database}`);
            const resUseDatabase = await client.useDatabase({ db_name: database });
            MilvusSrv.checkErrors(resUseDatabase);
            const resListCollections = await client.listCollections();
            MilvusSrv.checkErrors(resListCollections);
            const { data } = resListCollections;
            for (let j = 0; j < data.length; j++) {
                const collection = data[j];
                console.log(`    - Collection: ${collection.name}`);
            }
        }
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
}