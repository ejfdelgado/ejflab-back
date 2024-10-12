import sgMail from "@sendgrid/mail";
import { MyConstants } from "../srcJs/MyConstants.js";
import { MainHandler } from "./MainHandler.mjs";
import { MyTemplate } from "../srcJs/MyTemplate.js";
import { General } from "./common/General.mjs";
import MyDatesBack from "../srcJs/MyDatesBack.mjs";

export class EmailHandler {
  static async send(req, res) {
    const useDebug = false;
    sgMail.setApiKey(
      process.env.SEND_GRID_VARIABLE
    );
    const body = General.readParam(req, "body");
    const contenido = await MainHandler.resolveLocalFile({
      files: [body.template],
    });
    const renderer = new MyTemplate();
    renderer.registerFunction("formatDate", (millis) => {
      try {
        return MyDatesBack.formatDateCompleto(new Date(millis));
      } catch (err) {
        return `${millis}`;
      }
    });
    renderer.registerFunction("porcentaje1", (por) => {
      return (100 * por).toFixed(1) + " %";
    });
    if (useDebug) {
      console.log(JSON.stringify(body.params, null, 4));
    }
    const contenidoFinal = renderer.render(
      contenido.data,//template
      body.params//params
    );
    const msg = {
      to: body.to,
      from: MyConstants.EMAIL_SENDER,
      subject: body.subject,
      html: contenidoFinal,
    };

    //console.log(JSON.stringify(body.params, null, 4));
    //console.log(JSON.stringify(contenidoFinal, null, 4));

    if (useDebug) {
      res.status(200).set({ 'content-type': 'text/html; charset=utf-8' }).send(contenidoFinal).end();
    } else {
      let answer = {};
      answer = await sgMail.send(msg);
      res.status(200).json(answer).end();
    }
  }
}
