import { expect, test } from "bun:test";
import { Effect, Deferred } from "effect";
import { TestClock } from "effect/testing";
import { makeScheduler } from "../src/scheduler.ts";
import { SourceConfig, Config, Act, decode, fail } from "../src/contract.ts";
import { Capture } from "../src/command.ts";
import { boundedServer } from "../src/socket-limits.ts";
import { Socket, SocketServer } from "effect/socket";
import { NetAddress } from "effect/net";

const config = decode(SourceConfig, {
  id: "fake",
  label: "Fake",
  tag: "F",
  type: "command",
  fetch: ["true"],
});
test("actions share source and global admission; disabled in-flight slot never re-arms", async () => {
  await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const gate = yield* Deferred.make<void>();
        const s = yield* makeScheduler(() => Deferred.await(gate));
        s.configure([config], 1);
        const action = yield* s.withSlot("fake", Deferred.await(gate)).pipe(Effect.forkScoped);
        void action;
        yield* Effect.yieldNow;
        expect((yield* s.refresh("fake").pipe(Effect.result))._tag).toBe("Failure");
        s.configure([], 1);
        yield* Deferred.succeed(gate, undefined);
        yield* Effect.yieldNow;
        expect(s.active()).toBe(0);
        expect(s.nextAt("fake", 0)).toBeUndefined();
        expect((yield* s.withSlot("fake", Effect.void).pipe(Effect.result))._tag).toBe("Failure");
      }),
    ).pipe(Effect.provide(TestClock.layer())),
  );
});
test("capture consumes arbitrary chunks while keeping a finite prefix", () => {
  const capture = new Capture(128);
  for (let i = 0; i < 10000; i++) capture.accept(Buffer.alloc(64, 120));
  expect(capture.size).toBe(640000);
  expect(capture.text().length).toBe(128);
  expect(capture.log().length).toBeLessThanOrEqual(128);
});
test("socket limits interrupt an excessive stream without custom JSON framing", async () => {
  const writer: Socket.Writer = { write: () => Effect.void, writeAll: () => Effect.void };
  const socket = Socket.make({
    writer: Effect.succeed(writer),
    reader: Effect.succeed({
      pull: Effect.succeed([new Uint8Array(1024 * 1024 + 1)]),
      upgrade: () => Effect.void,
    }),
  });
  let read = false;
  const server: SocketServer.SocketServer["Service"] = {
    address: NetAddress.unixPathAddress("/tmp/test.sock"),
    run: (handler) => handler(socket).pipe(Effect.orDie, Effect.andThen(Effect.never)),
  };
  const limited = boundedServer(server);
  const result = await Effect.runPromiseExit(
    Effect.scoped(
      limited.run((socket) =>
        Effect.gen(function* () {
          const reader = yield* socket.reader;
          yield* reader.pull;
          read = true;
        }),
      ),
    ),
  );
  expect(result._tag).toBe("Failure");
  expect(read).toBe(false);
});
test("input validation bounds concurrency, env-free planned commands and session injection", () => {
  expect(() =>
    decode(SourceConfig, { id: "fake", label: "Fake", tag: "F", type: "command", planned: true }),
  ).not.toThrow();
  expect(() =>
    decode(SourceConfig, { id: "fake", label: "Fake", tag: "F", type: "command" }),
  ).toThrow();
  expect(() => decode(Config, { roots: [], concurrency: 21 })).toThrow();
  expect(() =>
    decode(Act, { do: "look", actor: "agent", agent: "session]\n- [ ] injected" }),
  ).toThrow();
  expect(() => decode(SourceConfig, { ...config, env: { "BAD=KEY": "value" } })).toThrow();
  expect(() => decode(SourceConfig, { ...config, fetch: ["invalid\0argv"] })).toThrow();
  expect(fail("conflict", "changed").message).toBe("changed");
});
