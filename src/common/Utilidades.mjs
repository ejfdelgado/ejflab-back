
export class Utilidades {
  static leerRefererPath(myrequest) {
    let urlTotal = Utilidades.leerHeader(myrequest, [
      //"referer",
      "X-Referer",
    ]);
    let elhost = Utilidades.leerHeader(myrequest, [
      //"host",
      //"Host",
      "X-Host",
    ]);
    if (urlTotal == null || elhost == null) {
      return "";
    }
    urlTotal = urlTotal.replace(/^https?:\/\//ig, "");
    elhost = elhost.replace(/^https?:\/\//ig, "");

    let elreferer = urlTotal;
    const elindice = elreferer.indexOf(elhost) + elhost.length;
    let temp = urlTotal.substr(elindice);
    let indiceQuery = temp.indexOf("?");
    if (indiceQuery >= 0) {
      temp = temp.substr(0, indiceQuery);
    }
    indiceQuery = temp.indexOf("#");
    if (indiceQuery >= 0) {
      temp = temp.substr(0, indiceQuery);
    }
    temp = temp.replace(/[\/]$/, "");
    return temp;
  }
  static leerHeader(myrequest, lista) {
    for (let i = 0; i < lista.length; i++) {
      const a = lista[i];
      const val = myrequest.header(a);
      if (["", null, undefined].indexOf(val) < 0) {
        return val;
      }
      return null;
    }
  }
}
