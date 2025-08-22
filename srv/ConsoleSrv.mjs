export class consoleSrv {
    static getLogLevel() {
        let current = process.env.LOGLEVEL;
        if (!current) {
            current = "error";
        }
        return current;
    }
    static info(...args) {
        this.log(...args);
    }
    static log(...args) {
        const level = consoleSrv.getLogLevel();
        if (["info"].indexOf(level) >= 0) {
            console.log(...args);
        }
    }
    static warning(...args) {
        const level = consoleSrv.getLogLevel();
        if (["warning", "info"].indexOf(level) >= 0) {
            console.warn(...args);
        }
    }
    static error(...args) {
        const level = consoleSrv.getLogLevel();
        if (["error", "warning", "info"].indexOf(level) >= 0) {
            console.error(...args);
        }
    }
    static setColor(color) {
        const MAP = {
            "red": "\x1b[31m",
            "green": "\x1b[32m",
            "blue": "\x1b[34m",
            "reset": "\x1b[0m",
            "cyan": "\x1b[36m",
            "magenta": "\x1b[35m",
            "yeloow": "\x1b[33m",
        };
        if (color in MAP) {
            color = MAP[color];
        }
        console.log(color);
    }
    static resetColor() {
        this.setColor("reset");
    }
}