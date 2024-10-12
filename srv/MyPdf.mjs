import fs from "fs";
import puppeteer from 'puppeteer';
import { General } from "./common/General.mjs";

export class MyPdf {
    static async localRender(template) {
        const source = fs.readFileSync(`./src/assets/templates/pdf/${template}`, { encoding: "utf8" });
        const browser = await puppeteer.launch({
            headless: 'new',
            executablePath: '/usr/bin/google-chrome',
            args: [
                "--no-sandbox",
                "--disable-gpu",
            ]
        });
        const page = await browser.newPage();
        await page.setContent(source);
        await page.emulateMediaType('print');
        const pdf = await page.pdf({
            margin: { top: '100px', right: '50px', bottom: '100px', left: '50px' },
            printBackground: true,
            format: 'letter',
        });
        await browser.close();
        return pdf;
    }

    static async render(req, res, next) {
        const template = General.readParam(req, "template");
        const pdf = await MyPdf.localRender(template);
        res.writeHead(200, {
            "Content-Type": "application/pdf",
            "Content-disposition": "inline"
        });
        res.end(pdf);
    }
}