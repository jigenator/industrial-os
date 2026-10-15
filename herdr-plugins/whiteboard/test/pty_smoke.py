"""Runs the built board through its Herdr pane entrypoint in a pseudo-terminal, with raw SGR
mouse and key input, and checks the saved board file.

Usage, from herdr-plugins/whiteboard after `cargo build --release --locked`:
    python3 test/pty_smoke.py
No Herdr server is contacted: the Herdr variables point at a temporary directory.
"""
import fcntl, json, os, pty, select, shutil, struct, tempfile, termios, time

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
state = tempfile.mkdtemp(prefix="wb-smoke-")
env = {
    "PATH": os.environ["PATH"],
    "TERM": "xterm-256color",
    "HERDR_PLUGIN_STATE_DIR": state,
    "HERDR_SOCKET_PATH": "/nonexistent/herdr.sock",
    "HERDR_WORKSPACE_ID": "w-smoke",
}
out = b""


def start():
    pid, fd = pty.fork()
    if pid == 0:
        os.chdir(root)
        os.execve("/bin/sh", ["sh", "bin/whiteboard.sh", "pane"], env)
    fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", 30, 100, 0, 0))
    return pid, fd


def pump(fd, seconds):
    global out
    end = time.time() + seconds
    while time.time() < end:
        if select.select([fd], [], [], 0.05)[0]:
            try:
                out += os.read(fd, 65536)
            except OSError:
                return


def send(fd, data, wait=0.15):
    os.write(fd, data.encode())
    pump(fd, wait)


# SGR mouse: button;col;row (1-based); M press or drag, m release; +32 marks a drag.
def click(fd, c, r):
    send(fd, f"\x1b[<0;{c};{r}M", 0.02)
    send(fd, f"\x1b[<0;{c};{r}m", 0.02)


def drag(fd, path):
    (c, r), *rest = path
    send(fd, f"\x1b[<0;{c};{r}M", 0.02)
    for c, r in rest:
        send(fd, f"\x1b[<32;{c};{r}M", 0.05)
    send(fd, f"\x1b[<0;{c};{r}m", 0.02)


def finish(pid, fd):
    _, status = os.waitpid(pid, 0)
    pump(fd, 0.1)
    assert os.waitstatus_to_exitcode(status) == 0, status


try:
    pid, fd = start()
    pump(fd, 0.8)
    assert b"\x1b[?1000h" in out and b"\x1b[?1006h" in out, "mouse capture not enabled"
    assert b"empty board" in out, "empty state not shown"
    click(fd, 17, 1)  # + NOTE, toolbar columns 15-22
    send(fd, "hello note")
    send(fd, "\x1b", 0.3)
    # A 100x30 terminal has canvas rows 2-29; the note opens at world (38, 11), screen (39, 13).
    drag(fd, [(41, 14), (51, 18), (61, 20)])
    click(fd, 5, 25)
    click(fd, 5, 25)  # double-click empty space: free text
    send(fd, "free text")
    send(fd, "\x1b", 0.2)
    send(fd, "\t", 0.1)  # keyboard path: select the first item and move it
    send(fd, "\x1b[C\x1b[C", 0.2)
    # Second note: readline inserts at the logical-line start, not at the end.
    click(fd, 17, 1)
    assert b"\x1b[?2004h" in out, "bracketed paste not enabled"
    send(fd, "world\x01hello ")
    # Bracketed and raw line-feed pastes both keep their line breaks.
    send(fd, "\x05\x1b[200~\nline\r\nb\x1b[201~\nc")
    send(fd, "\x1b", 0.3)
    # Separate the notes, then drag the first note's right border onto the second.
    drag(fd, [(41, 14), (11, 6)])
    drag(fd, [(84, 19), (51, 17), (11, 6)])
    send(fd, "q", 0.5)
    finish(pid, fd)
    assert b"\x1b[?1000l" in out, "mouse capture not disabled on exit"
    assert b"\x1b[?2004l" in out, "bracketed paste not disabled on exit"

    sessions = os.listdir(os.path.join(state, "boards"))
    assert len(sessions) == 1 and sessions[0] != "default", sessions
    board = os.path.join(state, "boards", sessions[0], "w-smoke.json")
    saved = json.load(open(board))
    items = saved["items"]
    note = next(i for i in items if i["text"] == "hello note")
    text = next(i for i in items if i["kind"] == "text")
    assert note["text"] == "hello note" and (note["x"], note["y"]) == (58 + 2, 17), note
    assert text["text"] == "free text" and (text["x"], text["y"]) == (4, 23), text

    second = next(i for i in items if i["text"].startswith("hello world"))
    assert second["text"] == "hello world\nline\nb\nc", second
    assert saved["arrows"] == [{"from": note["id"], "to": second["id"]}], saved
    assert len({i["id"] for i in items}) == 3 and all(i["id"] for i in items)

    # Reopening the same workspace shows the saved board.
    out = b""
    pid, fd = start()
    pump(fd, 0.8)
    assert b"hello note" in out and b"empty board" not in out
    send(fd, "q", 0.5)
    finish(pid, fd)
    print("PTY SMOKE OK")
finally:
    shutil.rmtree(state, ignore_errors=True)
