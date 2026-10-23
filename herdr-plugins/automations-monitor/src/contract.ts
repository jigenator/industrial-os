// The data contract: Effect Schemas for the parts of `tatsu automations pipelines --json` and
// `tatsu automations schedules --json` (schema version 2) that the monitor shows. Fields not declared here,
// including every path, run ID and log reference, are never decoded and so can never reach the screen.
// Contract and field list: ../docs/architecture.md#data-contract.
import { Schema, SchemaTransformation } from 'effect';

export const SCHEMA_VERSION = 2;

// Times the CLI prints: ISO 8601 UTC with optional milliseconds, decoded to epoch milliseconds. An impossible
// date parses to NaN, which Finite rejects.
const Time = Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/)).pipe(
  Schema.decodeTo(Schema.Finite, SchemaTransformation.transform({
    decode: (s: string) => Date.parse(s),
    encode: (n: number) => new Date(n).toISOString(),
  })),
);
const OptionalTime = Schema.NullOr(Time);
const Count = Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0));
const Capacity = Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0));
// Display words the CLI documents as enums. They are decoded as bounded identifiers rather than enums so a
// new reason added within version 2 is shown verbatim instead of failing the whole read.
const Word = Schema.String.check(Schema.isPattern(/^[A-Za-z0-9_-]{1,64}$/));
const Name = Schema.String.check(Schema.isPattern(/^[a-z0-9][a-z0-9_-]{0,63}$/));

const RunnerState = Schema.Literals(['stopped', 'starting', 'running', 'draining', 'unreachable']);
const Observation = Schema.Literals(['live', 'recorded', 'absent']);

const Runner = Schema.Struct({
  state: RunnerState,
  observation: Observation,
  recorded_at: OptionalTime,
  problems: Schema.Array(Word),
  service: Schema.Struct({ environment_drift: Schema.Array(Word) }),
});

const DefinitionState = Schema.Struct({ state: Schema.Literals(['valid', 'invalid', 'missing']) });

const Pipeline = Schema.Struct({
  name: Name,
  scope: Schema.NullOr(Schema.Literals(['personal', 'pool'])),
  definition_state: DefinitionState,
  enabled: Schema.Boolean,
  slots: Schema.NullOr(Capacity),
  active_slots: Count,
  blocked_reasons: Schema.Array(Word),
});

export const PHASES = ['claiming', 'verifying', 'starting', 'running', 'cancelling', 'finalizing', 'terminal'] as const;
export const OUTCOMES = ['succeeded', 'failed', 'cancelled', 'interrupted', 'dropped'] as const;

const Run = Schema.Struct({
  pipeline: Name,
  // Free text in the schema (minLength 1); bounded here and sanitized again where it is drawn.
  issue_identifier: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(64)),
  phase: Schema.Literals(PHASES),
  outcome: Schema.NullOr(Schema.Literals(OUTCOMES)),
  reason: Schema.NullOr(Word),
  admitted_at: Time,
  claimed_at: OptionalTime,
  verified_at: OptionalTime,
  started_at: OptionalTime,
  ended_at: OptionalTime,
});

const Machine = Schema.Struct({
  name: Schema.String.check(Schema.isPattern(/^[a-z][A-Za-z0-9]{0,63}$/)),
  slots: Capacity,
  active_slots: Count,
});

const Polling = Schema.Struct({
  interval_seconds: Capacity,
  next_poll_at: OptionalTime,
  blocked_reasons: Schema.Array(Word),
});

export const PipelinesData = Schema.Struct({
  runner: Runner,
  machine: Schema.NullOr(Machine),
  polling: Polling,
  pipelines: Schema.Array(Pipeline),
  runs: Schema.Array(Run),
});

const Timing = Schema.Union([
  Schema.Struct({ kind: Schema.Literal('interval'), everyMinutes: Capacity }),
  Schema.Struct({ kind: Schema.Literal('daily'), timesUtc: Schema.Array(Schema.String.check(Schema.isPattern(/^(?:[01]\d|2[0-3]):[0-5]\d$/))) }),
]);

const Schedule = Schema.Struct({
  id: Name,
  definition: DefinitionState,
  enabled: Schema.Boolean,
  pause_reason: Schema.NullOr(Word),
  timing: Schema.NullOr(Timing),
  next_scheduled_at: OptionalTime,
  active_run: Schema.NullOr(Schema.Struct({ phase: Word, admitted_at: Time, started_at: OptionalTime })),
  last_result: Schema.NullOr(Schema.Struct({ outcome: Schema.Literals(['succeeded', 'failed', 'cancelled', 'interrupted']), reason: Word, ended_at: Time })),
});

// The schedules runner carries the same status as the pipelines runner, but the published JSON schema only
// pins `service`; the rest is read when present and shown as unknown otherwise.
export const SchedulesData = Schema.Struct({
  runner: Schema.Struct({
    state: Schema.optionalKey(RunnerState),
    observation: Schema.optionalKey(Observation),
    service: Schema.Struct({ environment_drift: Schema.Array(Word) }),
  }),
  schedules: Schema.Array(Schedule),
});

export type PipelinesData = typeof PipelinesData.Type;
export type SchedulesData = typeof SchedulesData.Type;
export type PipelineRecord = PipelinesData['pipelines'][number];
export type RunRecord = PipelinesData['runs'][number];
export type ScheduleRecord = SchedulesData['schedules'][number];
export type RunnerState = typeof RunnerState.Type;
export type Outcome = (typeof OUTCOMES)[number];
export type Phase = (typeof PHASES)[number];

// The error envelope the CLI prints instead of `data`.
export const ErrorEnvelope = Schema.Struct({
  error: Schema.Struct({ code: Schema.String.check(Schema.isPattern(/^[A-Z][A-Z0-9_]{0,127}$/)), message: Schema.optionalKey(Schema.Unknown) }),
});
