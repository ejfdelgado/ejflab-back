class MyError extends Error {
    constructor(message, httpCode) {
        super(message);
        this.name = "MyError";
        this.httpCode = httpCode;
    }
}

class NoAutorizadoException extends MyError {
    constructor(message) {
        super(message, 401);
    }
}
class NoExisteException extends MyError {
    constructor(message) {
        super(message, 204);
    }
}
class ParametrosIncompletosException extends MyError {
    constructor(message) {
        super(message, 400);
    }
}
class NoHayUsuarioException extends MyError {
    constructor(message) {
        super(message, 401);
    }
}
class MalaPeticionException extends MyError {
    constructor(message) {
        super(message, 400);
    }
}
class InesperadoException extends MyError {
    constructor(message) {
        super(message, 500);
    }
}

export {
    MyError,
    NoAutorizadoException,
    NoExisteException,
    ParametrosIncompletosException,
    NoHayUsuarioException,
    MalaPeticionException,
    InesperadoException
}