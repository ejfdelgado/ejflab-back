import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import { General } from "./common/General.mjs";
import { InesperadoException } from "./MyError.mjs";
import { IdGen } from "../srcJs/IdGen.js";

export class ExecFolder {
    constructor() {
        // Debe crear una carpeta aleatoria
        this.folderName = IdGen.num2ord(new Date().getTime());
        this.folderPath = `/tmp/ejflabs/${this.folderName}/`;
        fs.mkdirSync(this.folderPath, { recursive: true });
    }
    destroyFolder() {
        fs.rmSync(this.folderPath, { recursive: true, force: true });
    }
    static async removeDir(path) {
        return new Promise((resolve, reject) => {
            try {
                if (fs.existsSync(path)) {
                    const files = fs.readdirSync(path)
                    if (files.length > 0) {
                        files.forEach(function (filename) {
                            if (fs.statSync(path + "/" + filename).isDirectory()) {
                                removeDir(path + "/" + filename)
                            } else {
                                fs.unlinkSync(path + "/" + filename)
                            }
                        })
                    }
                    fs.rmdirSync(path);
                }
                resolve();
            } catch (err) {
                reject(err);
            }
        });
    }
    writeTextFile(fileName, content) {
        const folderPath = this.folderPath;
        return new Promise((resolve, reject) => {
            try {
                const path = `${folderPath}${fileName}`;
                fs.writeFileSync(path, content);
                resolve(path);
            } catch (err) {
                reject(err);
            }
        });
    }
    readTextFile(fileName) {
        const folderPath = this.folderPath;
        return new Promise((resolve, reject) => {
            try {
                const ruta = `${folderPath}${fileName}`;
                const data = fs.readFileSync(ruta, 'utf8');
                resolve(data);
            } catch (err) {
                reject(err);
            }
        });
    }
    static async copyDir(src, dest) {
        return new Promise(async (resolve, reject) => {
            const copy = async (copySrc, copyDest) => {
                return new Promise(async (resolve2, reject2) => {
                    try {
                        const list = fs.readdirSync(copySrc);
                        const promesas = [];
                        list.forEach(async (item) => {
                            const ss = path.resolve(copySrc, item);
                            try {
                                const stat = fs.statSync(ss);
                                const curSrc = path.resolve(copySrc, item);
                                const curDest = path.resolve(copyDest, item);
                                if (stat.isFile()) {
                                    promesas.push(new Promise((resolve3, reject3) => {
                                        const stream = fs.createReadStream(curSrc)
                                            .pipe(fs.createWriteStream(curDest));
                                        stream.on('error', reject3);
                                        stream.on('finish', resolve3);
                                    }));
                                } else if (stat.isDirectory()) {
                                    fs.mkdirSync(curDest, { recursive: true });
                                    await copy(curSrc, curDest);
                                }
                            } catch (err2) {
                                reject2(err2);
                            }
                        });
                        try {
                            await Promise.all(promesas);
                            resolve2();
                        } catch (err3) {
                            reject2(err3);
                        }
                    } catch (err1) {
                        reject2(err1);
                    }
                });
            };

            try {
                await createFolderIfNotExists(dest);
                await copy(src, dest);
                resolve();
            } catch (err0) {
                reject(err0);
            }
        });
    }
}

export class MyShell {

    //http://localhost:8081/srv/shell?cmd=solvePnP&payload={"v2": [[282, 274], [397, 227], [577, 271], [462, 318], [270, 479], [450, 523], [566, 475]], "v3": [[0.5, 0.5, -0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5], [0.5, -0.5, -0.5], [-0.5, -0.5, -0.5], [-0.5, -0.5, 0.5]]}
    //http://localhost:8081/srv/shell?cmd=ls%20-la
    static async run(req, res, next) {
        const cmd = General.readParam(req, "cmd");
        const payload = General.readParam(req, "payload");
        const dato = await MyShell.runLocal(cmd, payload);
        res.setHeader('content-type', 'text/plain');
        res.end(dato);
    }
    static async runCommand(command, workingDirectory = "./") {
        return new Promise((resolve, reject) => {
            console.log(`Running ${command} at ${workingDirectory}`);
            exec(command, {
                cwd: workingDirectory
            }, function (err, stdout, stderr) {
                console.log(stdout);
                if (err !== null) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }
    static existsExecutable(execPath) {
        try {
            if (fs.lstatSync(execPath).isFile()) {
                return true;
            }
        } catch (err) { }
        return false;
    }
    //MyShell.getBinDir()
    static getBinDir() {
        const DIR = process.env.BIN_DIR || "bin-docker";
        return DIR;
    }
    static async runLocal(command, payload = null) {
        const args = command.split(/\s+/g);
        const command1 = args.splice(0, 1)[0];
        let execPath = path.join(process.cwd(), `/${MyShell.getBinDir()}/${command1}`);
        if (!MyShell.existsExecutable(execPath)) {
            execPath = command1;
        }
        if (payload !== null) {
            args.push(payload);
        }
        const dirPath = path.join(process.cwd(), `/${MyShell.getBinDir()}/libs`);
        const options = { env: { LD_LIBRARY_PATH: dirPath } };
        const ls = spawn(execPath, args, options);

        return new Promise((resolve, reject) => {
            let total = "";
            let isError = false;
            ls.stdout.on("data", data => {
                total += data.toString();
            });

            ls.stderr.on("data", data => {
                //console.log(`stderr: ${data}`);
                //reject(new Error(data));
                total += data.toString();
                isError = true;
            });

            ls.on('error', (error) => {
                //console.log(`error: ${error.message}`);
                reject(error);
            });

            ls.on("close", code => {
                //console.log(`child process exited with code ${code}`);
                if (isError) {
                    reject(total);
                } else {
                    let parsed = {};
                    try {
                        parsed = JSON.parse(total);
                    } catch (err) { }
                    if (typeof parsed.error == "string") {
                        reject(new InesperadoException(parsed.error));
                    }
                    resolve(total);
                }
            });
        });

    }
}