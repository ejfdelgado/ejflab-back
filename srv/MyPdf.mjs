import fs from "fs";
import puppeteer from 'puppeteer';
import { General } from "./common/General.mjs";
import { MyTemplate } from "@ejfdelgado/ejflab-common/src/MyTemplate.js";
import { CsvFormatterFilters } from "@ejfdelgado/ejflab-common/src/CsvFormatterFilters.js";
import { MyUtilities } from '@ejfdelgado/ejflab-common/src/MyUtilities.js';
import { MyDatesBack } from '@ejfdelgado/ejflab-common/src/MyDatesBack.mjs';

export class MyPdf {
    static async localRender(template, model = {}, format = "pdf", extra = [], configuration, launch) {
        const source = fs.readFileSync(`./src/assets/templates/pdf/${template}`, { encoding: "utf8" });
        if (!model.extra) {
            model.extra = {};
        }
        const renderer = new MyTemplate();
        renderer.registerFunction("json", CsvFormatterFilters.json);
        renderer.registerFunction("epoch2date", (value, ...args) => {
            return MyDatesBack.formatDateCompleto(new Date(value), ...args);
        });
        for (let i = 0; i < extra.length; i++) {
            const extraFile = extra[i];
            const path = MyUtilities.removeRepeatedSlash(`./src/assets/templates/pdf/${extraFile.path}`);
            const exists = fs.existsSync(path);
            if (exists) {
                if (extraFile.base64) {
                    const data = fs.readFileSync(path);
                    const base64String = data.toString('base64');
                    model.extra[extraFile.alias] = "base64," + base64String;
                } else {
                    // It is used as text
                    const text = fs.readFileSync(path, { encoding: "utf8" });
                    model.extra[extraFile.alias] = renderer.render(text, model);
                }
            } else {
                model.extra[extraFile.alias] = "";
            }
        }
        const rendered = renderer.render(source, model);
        if (format == "html") {
            return rendered;
        }
        if (!launch) {
            launch = {
                headless: 'new',
                executablePath: '/usr/bin/google-chrome',
                args: [
                    "--no-sandbox",
                    "--disable-gpu",
                ]
            };
        }
        const browser = await puppeteer.launch(launch);
        if (!configuration) {
            configuration = {
                margin: { top: '100px', right: '50px', bottom: '100px', left: '50px' },
                printBackground: true,
                format: 'letter',
            }
        }

        let itHasHeaderOrFooter = false;
        if (!configuration.headerTemplate) {
            if (model.extra.header_html) {
                configuration.headerTemplate = model.extra.header_html;
                itHasHeaderOrFooter = true;
            }
        }
        if (!configuration.footerTemplate) {
            if (model.extra.footer_html) {
                configuration.footerTemplate = model.extra.footer_html;
                itHasHeaderOrFooter = true;
            }
        }
        configuration.displayHeaderFooter = itHasHeaderOrFooter;
        if (itHasHeaderOrFooter) {
            if (!configuration.footerTemplate) {
                configuration.footerTemplate = '';
            }
            if (!configuration.headerTemplate) {
                configuration.headerTemplate = '';
            }
        }

        const page = await browser.newPage();
        await page.setContent(rendered);
        await page.emulateMediaType('print');
        const pdf = await page.pdf(configuration);
        await browser.close();
        return pdf;
    }

    static async render(req, res, next) {
        const template = General.readParam(req, "template");
        const format = General.readParam(req, "format", "pdf");
        const fileName = General.readParam(req, "format", "fileName");
        const body = req.body;
        const rendered = await MyPdf.localRender(template, body, format);
        if (format == "html") {
            res.writeHead(200, {
                "Content-Type": "text/html",
                "Content-disposition": `inline; filename="${fileName}.html"`
            });
            res.end(rendered);
        } else {
            res.writeHead(200, {
                "Content-Type": "application/pdf",
                "Content-disposition": `inline; filename="${fileName}.pdf"`
            });
            res.end(rendered);
        }
    }
}