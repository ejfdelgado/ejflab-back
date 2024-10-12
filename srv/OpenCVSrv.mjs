import { General } from "./common/General.mjs";
import { ExecFolder, MyShell } from "./MyShell.mjs";

export class OpenCVSrv {
    static async solvePnPLocal(payload) {
        const cmd = "solvePnP";
        const points3d = payload.points3d;
        let folder = null;
        if (points3d) {
            folder = new ExecFolder();
            payload.points3dPath = await folder.writeTextFile("points3d.json", JSON.stringify(points3d));
            delete payload.points3d;
        }
        const payloadTxt = JSON.stringify(payload);
        const dato = await MyShell.runLocal(cmd, payloadTxt);
        if (folder) {
            folder.destroyFolder();
        }
        return dato;
    }
    static async solvePnP(req, res, next) {
        const payload = General.readParam(req, "payload");
        const dato = await OpenCVSrv.solvePnPLocal(payload);
        res.setHeader('content-type', 'text/json');
        res.end(dato);
    }
}