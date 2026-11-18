// A stand-in for the app's fs/promises: a drawing is "written" at once and nothing touches the disk.
export const written = new Map();
export const mkdir = async () => {}, unlink = async () => {};
// A test sets `refuse.list` for the app's answer to a folder outside the user's home: it throws at the call, it does not reject.
export const refuse = { list: false };
export const readdir = (path) => { if (refuse.list) throw new TypeError(`\`${path}\` is outside every granted read root`); return Promise.resolve([]); };
export const writeFile = async (path, text) => { written.set(path, text); };
