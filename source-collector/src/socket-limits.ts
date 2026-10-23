import { Effect } from "effect";
import { Socket, SocketServer } from "effect/socket";

/** Trusted same-user IPC still has finite admission and per-connection work. */
export function boundedServer(
  server: SocketServer.SocketServer["Service"],
): SocketServer.SocketServer["Service"] {
  let connections = 0;
  return {
    address: server.address,
    run: (handler) =>
      server.run((socket) =>
        Effect.scoped(
          Effect.gen(function* () {
            const writer = yield* socket.writer;
            if (connections >= 64) {
              yield* writer.write(new Socket.CloseEvent()).pipe(Effect.ignore);
              return;
            }
            connections++;
            yield* Effect.addFinalizer(() =>
              Effect.sync(() => {
                connections--;
              }),
            );
            let bytes = 0,
              frames = 0;
            const reader = socket.reader.pipe(
              Effect.map((reader) => ({
                ...reader,
                pull: reader.pull.pipe(
                  Effect.flatMap((chunks) => {
                    for (const chunk of chunks) {
                      bytes += typeof chunk === "string" ? Buffer.byteLength(chunk) : chunk.length;
                      for (const value of chunk) if (value === 10 || value === "\n") frames++;
                    }
                    return bytes > 1024 * 1024 || frames > 1024
                      ? writer
                          .write(new Socket.CloseEvent())
                          .pipe(Effect.ignore, Effect.andThen(Effect.interrupt))
                      : Effect.succeed(chunks);
                  }),
                ),
              })),
            );
            yield* handler(Socket.make({ reader, writer: socket.writer })).pipe(
              Effect.timeoutOption("2 minutes"),
            );
          }),
        ),
      ),
  };
}
