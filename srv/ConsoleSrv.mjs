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
}