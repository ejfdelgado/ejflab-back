import sgMail from "@sendgrid/mail";
import { MyConstants } from "@ejfdelgado/ejflab-common/src/MyConstants.js";
import { MainHandler } from "./MainHandler.mjs";
import { MyTemplate } from "@ejfdelgado/ejflab-common/src/MyTemplate.js";
import { General } from "./common/General.mjs";
import MyDatesBack from "@ejfdelgado/ejflab-common/src/MyDatesBack.mjs";
import * as sortifyModule from "@ejfdelgado/ejflab-common/src/sortify.js";

const sortify = sortifyModule.default;

export class EmailHandler {
  static async send(req, res) {
    const useDebug = false;
    console.log(`Using SEND_GRID_VARIABLE ${JSON.stringify(process.env.SEND_GRID_VARIABLE.substring(0, 7))}...`);
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

    console.log(`Using EMAIL_SENDER ${JSON.stringify(MyConstants.EMAIL_SENDER)}`);
    //console.log(JSON.stringify(body.params, null, 4));
    //console.log(JSON.stringify(contenidoFinal, null, 4));

    if (useDebug) {
      res.status(200).set({ 'content-type': 'text/html; charset=utf-8' }).send(contenidoFinal).end();
    } else {
      let answer = {};
      try {
        answer = await sgMail.send(msg);
      } catch (err) {
        console.log(sortify(err));
        throw err;
      }
      res.status(200).json(answer).end();
    }
  }
}
