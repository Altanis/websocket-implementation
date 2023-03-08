import { IncomingMessage, Server } from "http";
import { Duplex } from "stream";

/** Magic key for authenticating WebSocket connections. */
export const GUID_MAGIC = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
/** RegExp which tests for the vailidity of WebSocket key. */
export const KEY_TESTER = /^[A-Za-z0-9+/]{22}==$/;

/** Options passed into constructor when instantiating WSS. */
export interface Options {
    /** The maximum payload able to be sent. */
    maxPayload?: number | 10485760; // 10 * 1024 * 1024 (10MB)
    /** The maximum amount of pending in queue. */
    backlog?: number | 128 /** standard for most OS */;
    /** Middleware before accepting a client connection. */
    verifyClient?: (
        information: { request: IncomingMessage, socket: Duplex, head: Buffer },
        cb: (verify: boolean, code?: number, reason?: string) => void
    ) => void | undefined;
    /** Callback to be executed when listening. */
    listeningCb?: () => void;

    /** The port for the server to bind to. */
    port: number;
    /** An HTTP Server to bind to. */
    server?: Server;
    /** Hostname where to bind the server to. */
    host?: string;
};