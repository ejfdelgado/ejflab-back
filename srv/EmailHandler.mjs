import sgMail from "@sendgrid/mail";
import { MyConstants } from "@ejfdelgado/ejflab-common/src/MyConstants.js";
import { MainHandler } from "./MainHandler.mjs";
import { MyTemplate } from "@ejfdelgado/ejflab-common/src/MyTemplate.js";
import { General } from "./common/General.mjs";
import MyDatesBack from "@ejfdelgado/ejflab-common/src/MyDatesBack.mjs";
import * as sortifyModule from "@ejfdelgado/ejflab-common/src/sortify.js";
import { MyFileService } from "./MyFileService.mjs";

const sortify = sortifyModule.default;

export class EmailHandler {
  static async send(req, res) {
    let debug = false;
    const body = General.readParam(req, "body");
    debug = General.readParam(req, "debug", "0", false) != "0";
    let templateSource = General.readParam(req, "source", "local", false);
    if (debug) {
      console.log(`Using: SEND_GRID_VARIABLE ${JSON.stringify(process.env.SEND_GRID_VARIABLE.substring(0, 7))}...`);
    }
    sgMail.setApiKey(
      process.env.SEND_GRID_VARIABLE
    );
    let contenido = '<body style="font-family: sans-serif;">Misconfigured</body>';
    if (templateSource == "local") {
      contenido = await MainHandler.resolveLocalFile({
        files: [body.template],
      });
    } else if (templateSource == "bucket-private") {
      const normalizedTemplate = body.template.replace(/^\s*\//, "");
      const { data } = await MyFileService.read(normalizedTemplate);
      contenido = { data: data.toString() }
    }
    if (debug) {
      console.log(contenido);
    }
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
    if (debug) {
      console.log(JSON.stringify(body.params, null, 4));
    }
    const contenidoFinal = renderer.render(
      contenido.data,//template
      body.params//params
    );
    let to = body.to;
    if (!to) {
      to = [MyConstants.EMAIL_SENDER];
    } else if (to instanceof Array && to.length == 0) {
      to.push(MyConstants.EMAIL_SENDER);
    } else if (typeof to == "string") {
      to = [to];
    }
    const msg = {
      to,
      from: MyConstants.EMAIL_SENDER,
      subject: body.subject,
      html: contenidoFinal,
    };

    if (body.replyTo) {
      msg.replyTo = body.replyTo;
      if (debug) {
        console.log(`replyTo: ${msg.replyTo}`);
      }
    }

    if (debug) {
      console.log(`Using EMAIL_SENDER ${JSON.stringify(MyConstants.EMAIL_SENDER)}`);
      //console.log(JSON.stringify(body.params, null, 4));
      //console.log(JSON.stringify(contenidoFinal, null, 4));
    }

    if (debug) {
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
