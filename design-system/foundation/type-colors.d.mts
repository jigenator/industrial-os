export const TYPE_COLORS: Readonly<Record<'type.pr' | 'type.todo' | 'type.linear' | 'type.msg' | 'type.email', `#${string}`>>;
export function typeColor(token?: unknown): `#${string}`;
