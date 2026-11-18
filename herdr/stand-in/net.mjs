// A stand-in for the app's net: no socket is ever opened. A test reads `asked` for what the mod tried to reach.
export const asked = [];
export const connect = async (host, port) => { asked.push([host, port]); throw new Error("the stand-in opens no socket"); };
