import http from "node:http";
import crypto from "node:crypto";
import { Duplex, EventEmitter } from "node:stream";

import { GUID_MAGIC, KEY_TESTER, Options } from "./Const";

export default class Server extends EventEmitter {
    /** The raw server being represented. */
    private server: http.Server;
    /** The options passed into constructor. */
    private options: Options;

    public constructor(options: Options) {
        super();

        this.options = options;
        this.server = options.server || http.createServer((request, response) => {
            const body = http.STATUS_CODES[426];

            response.writeHead(426, {
                "Content-Length": body!.length,
                "Content-Type": "text/plain"
            });
            
            response.end();
        });

        this.server.listen(options.port, options.host, options.backlog, options.listeningCb);
        this.handle();
    }

    /** Aborts a connection. */
    private abort(socket: Duplex, code: number, message?: string) {
        message = message || http.STATUS_CODES[code];
        if (!message) throw new Error("InternalError: Could not verify HTTP Status Code."); 
            
        const headers = {
            Connection: "close",
            "Content-Type": "text/html",
            "Content-Length": Buffer.byteLength(message!)
        };

        socket.end(
            `HTTP ${code} ${http.STATUS_CODES[code]}\r\n` +
            Object.keys(headers).map(h => `${h}: ${headers[h]}`) +
            "\r\n\r\n" +
            message
        );
    }

    /** Handles any events on the Server. */
    private handle() {
        this.server.on("listening", this.emit.bind(this, "listening"));
        this.server.on("error", this.emit.bind(this, "error"));
        this.server.on("upgrade", (request, socket, head) => {
            socket.on("error", () => socket.destroy());

            let key = request.headers["Sec-WebSocket-Key"];
            const version = request.headers["Sec-WebSocket-Version"];

            if (typeof key === "object") key = key[0];

            if (request.method !== "GET") this.abort(socket, 405, "Invalid HTTP method.");
            else if (request.headers["upgrade"]?.toLowerCase() !== "websocket") this.abort(socket, 400, "Invalid 'upgrade' header.");
            else if (!key || !KEY_TESTER.test(key)) this.abort(socket, 400, "Invalid 'Sec-WebSocket-Key' header.");
            else if (version !== "13") this.abort(socket, 400, "Invalid 'Sec-WebSocket-Version header.");

            // TODO(Altanis): request.headers["Sec-WebSocket-Protocol"]
            if (this.options.verifyClient) {
                this.options.verifyClient({ request, socket, head }, (verify, code = 401, reason) => {
                    // two options: immediately complete upgrade then disconnect if !verify, or wait for cb to complete
                    if (!verify) this.abort(socket, code, reason);
                    else {
                        if (!socket.readable || !socket.writable) return socket.destroy(); // FIN frame sent already.
                        const hash = crypto.createHash("sha1").update(key + GUID_MAGIC).digest("base64");

                        const headers = [
                            "HTTP/1.1 101 Switching Protocols",
                            "Upgrade: websocket",
                            "Connection: Upgrade",
                            `Sec-WebSocket-Accept: ${hash}`
                        ];

                        this.emit("headers", headers, request);
                        socket.write(headers.concat('\r\n').join('\r\n'));
                        
                        // CONTINUE FROM HERE
                    }
                });
            }
        });
    }
}