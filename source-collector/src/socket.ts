import { Effect, FileSystem, Layer } from "effect";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { BunSocket } from "@effect/platform-bun";
import { Api, fail } from "./contract.ts";
import { join } from "node:path";

// Transport wiring is local; schemas and wire semantics live only in contract.ts.
export const request = <A, E, R>(
  root: string,
  use: (
    api: import("effect/rpc/RpcClient").FromGroup<
      typeof Api,
      import("effect/rpc/RpcClientError").RpcClientError
    >,
  ) => Effect.Effect<A, E, R>,
) =>
  Effect.scoped(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      if (!(yield* fs.exists(join(root, "feed.sock"))))
        return yield* Effect.fail(fail("engine_not_running", "engine not running"));
      const api = yield* RpcClient.make(Api);
      return yield* use(api);
    }),
  ).pipe(
    Effect.provide(
      RpcClient.layerProtocolSocket().pipe(
        // one request-scoped connection, bounded handshake and response
        Layer.provide(BunSocket.layerNet({ path: join(root, "feed.sock") })),
        Layer.provide(RpcSerialization.layerNdJsonRpc({ maxBufferSize: 8 * 1024 * 1024 })),
      ),
    ),
    Effect.timeout("15 seconds"),
    Effect.mapError(clientError),
  );
function clientError(e: unknown): import("./contract.ts").CollectorError {
  if (e && typeof e === "object" && "_tag" in e) {
    if (e._tag === "CollectorError") return e as import("./contract.ts").CollectorError;
    if (
      e._tag === "SocketError" ||
      (e._tag === "RpcClientError" &&
        "reason" in e &&
        e.reason &&
        typeof e.reason === "object" &&
        "_tag" in e.reason &&
        e.reason._tag === "SocketOpenError")
    )
      return fail("engine_not_running", "engine not running");
  }
  return fail(
    "outcome_unknown",
    "RPC did not complete; a mutation may have applied. Do not retry blindly",
  );
}
