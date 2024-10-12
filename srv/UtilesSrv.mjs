
export class UtilesSrv {
  static async fecha(req, res) {
    const ans = {};
    ans["unixtime"] = new Date().getTime();
    res.status(200).json(ans).end();
  }
}
