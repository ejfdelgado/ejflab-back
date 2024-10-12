
import { Firestore } from '@google-cloud/firestore'

const firestore = new Firestore();
firestore.settings({
    ignoreUndefinedProperties: true
});

export class MyStore {
    // https://www.npmjs.com/package/@google-cloud/firestore
    static async runTransaction(theFunction) {
        /**
         * Con las bibliotecas cliente de Cloud Firestore, puede agrupar 
         * varias operaciones en una sola transacción. Las transacciones 
         * son útiles cuando desea actualizar el valor de un campo según 
         * su valor actual o el valor de algún otro campo. Una transacción 
         * consta de cualquier cantidad de operaciones get() seguidas de 
         * cualquier cantidad de operaciones de escritura, como set() , 
         * update() o delete() . En el caso de una edición simultánea, 
         * Cloud Firestore vuelve a ejecutar toda la transacción. 
         * Por ejemplo, si una transacción lee documentos y otro cliente 
         * modifica cualquiera de esos documentos, Cloud Firestore vuelve 
         * a intentar la transacción. Esta función garantiza que la 
         * transacción se ejecute con datos actualizados y coherentes.
         */
        return await firestore.runTransaction(theFunction);
    }

    static getBatch() {
        /**
         * Si no necesita leer ningún documento en su conjunto de operaciones, 
         * puede ejecutar varias operaciones de escritura como un solo lote que 
         * contiene cualquier combinación de operaciones set() , update() o delete() . 
         * Un lote de escrituras se completa de forma atómica y puede escribir en 
         * varios documentos.
         */
        return firestore.batch();
    }

    static async readByIds(collection, ids, firestoreInstance = null) {
        const lista = [];
        const theJson = {};
        if (ids.length == 0) {
            return theJson;
        }
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            lista.push(firestore.doc(`${process.env.ENV ? process.env.ENV : "pro"}-${collection}/${id}`));
        }
        let response;
        if (firestoreInstance == null) {
            response = await firestore.getAll(...lista);
        } else {
            response = await firestoreInstance.getAll(...lista);
        }
        for (let j = 0; j < response.length; j++) {
            const doc = response[j];
            const data = doc.data();
            if (data) {
                data.id = doc.id;
                theJson[data.id] = data;
            }
        }
        return theJson;
    }

    // Si no encuentra retorna undefined
    static async readById(collection, id, firestoreInstance = null) {
        const document = firestore.doc(`${process.env.ENV ? process.env.ENV : "pro"}-${collection}/${id}`);
        let doc;
        if (firestoreInstance == null) {
            doc = await document.get();
        } else {
            doc = await firestoreInstance.get(document);
        }
        const theJson = doc.data();
        if (theJson) {
            theJson.id = id;
        }
        return theJson;
    }

    static async create(collection, payload, firestoreInstance = null) {
        const elDoc = await firestore.collection(`${process.env.ENV ? process.env.ENV : "pro"}-${collection}`).add(payload);
        if (firestoreInstance == null) {
            payload.id = elDoc.id;
            return payload;
        } else {
            // Please check it later, could not work
            firestoreInstance.add(elDoc, payload);
        }
    }

    static async createById(collection, id, payload, firestoreInstance = null) {
        const document = firestore.doc(`${process.env.ENV ? process.env.ENV : "pro"}-${collection}/${id}`);
        if (firestoreInstance == null) {
            await document.set(payload);
        } else {
            firestoreInstance.set(document, payload);// no retorna promesa, sino la misma instancia
        }
        return document;
    }

    static async updateOrCreateById(collection, id, payload, firestoreInstance = null) {
        const localKey = `${process.env.ENV ? process.env.ENV : "pro"}-${collection}/${id}`;
        const document = firestore.doc(localKey);
        if (firestoreInstance == null) {
            await document.set(payload, { merge: true });
        } else {
            firestoreInstance.set(document, payload, { merge: true });// no retorna promesa, sino la misma instancia
        }
    }

    static async updateById(collection, id, payload, firestoreInstance = null) {
        const document = firestore.doc(`${process.env.ENV ? process.env.ENV : "pro"}-${collection}/${id}`);
        if (firestoreInstance == null) {
            await document.update(payload);
        } else {
            firestoreInstance.update(document, payload);// no retorna promesa, sino la misma instancia
        }
    }

    static async deleteById(collection, id, firestoreInstance = null) {
        const document = firestore.doc(`${process.env.ENV ? process.env.ENV : "pro"}-${collection}/${id}`);
        if (firestoreInstance == null) {
            await document.delete();
        } else {
            firestoreInstance.delete(document);// no retorna promesa, sino la misma instancia
        }
    }

    static async paginate(collection, orderColumns, offset = 0, pageSize = 20, where = [], firestoreInstance = null, select = []) {
        const collectionReference = firestore.collection(`${process.env.ENV ? process.env.ENV : "pro"}-${collection}`);
        let theQuery = collectionReference;
        for (let i = 0; i < orderColumns.length; i++) {
            const orderColumn = orderColumns[i];
            theQuery = theQuery.orderBy(orderColumn.name, orderColumn.dir);
        }

        for (let i = 0; i < where.length; i++) {
            const aWhere = where[i];
            theQuery = theQuery.where(aWhere.key, aWhere.oper, aWhere.value)
        }
        let documents;

        theQuery = theQuery
            .offset(offset)
            .limit(pageSize);

        if (select.length > 0) {
            theQuery = theQuery.select(...select);
        }

        if (firestoreInstance == null) {
            documents = await theQuery.get();
        } else {
            documents = await firestoreInstance.get(theQuery);
        }

        const data = documents.docs.map((d) => {
            const temp = d.data();
            temp.id = d.id;
            return temp;
        });
        return data;
    }
}


