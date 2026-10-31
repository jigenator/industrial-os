"""Real pane executable in an isolated PTY and fake engine. No live services."""
import copy
import fcntl
import json
import os
from pathlib import Path
import pty
import select
import signal
import socket
import struct
import subprocess
import tempfile
import termios
import threading
import time

ROOT = Path(__file__).resolve().parents[1]
BUN = subprocess.check_output(["bun", "-p", "process.execPath"], text=True).strip()
SNAPSHOT = json.loads(subprocess.check_output([
    "bun", "-e", 'import {fixture} from "./test/fixture.ts"; console.log(JSON.stringify(fixture()))'
], cwd=ROOT))


def exercise(exit_key, code, motion=False):
    with tempfile.TemporaryDirectory(prefix="df-pty-", dir="/tmp") as home:
        path = home + "/feed.sock"
        server = socket.socket(socket.AF_UNIX)
        server.bind(path)
        server.listen()
        server.settimeout(0.1)
        requests = []
        stopped = threading.Event()

        def serve():
            while not stopped.is_set():
                try:
                    conn, _ = server.accept()
                except socket.timeout:
                    continue
                try:
                    data = b""
                    while b"\n" not in data:
                        part = conn.recv(4096)
                        if not part:
                            break
                        data += part
                    if not data:
                        continue
                    request = json.loads(data)
                    requests.append(request)
                    result = copy.deepcopy(SNAPSHOT) if request["method"] == "get" else {"rev": 4}
                    conn.sendall((json.dumps({"jsonrpc": "2.0", "id": request["id"], "result": result}) + "\n").encode())
                finally:
                    conn.close()

        thread = threading.Thread(target=serve)
        thread.start()
        master, slave = pty.openpty()
        before = termios.tcgetattr(slave)
        fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", 54, 118, 0, 0))
        env = {**os.environ, "SOURCE_COLLECTOR_HOME": home, "HOME": home,
               "HERDR_SOCKET_PATH": home + "/not-herdr.sock", "TERM": "xterm-256color",
               "DISPATCH_FEED_SOURCES": "env-only"}
        child = subprocess.Popen([BUN, "bin/dispatch-feed.ts", "--sources", " reviews, scratch, ,reviews "] + ([] if motion else ["--motion-off"]), cwd=ROOT,
                                 env=env, stdin=slave, stdout=slave, stderr=slave, close_fds=True)
        capture = bytearray()

        def drain(duration=0.2):
            until = time.monotonic() + duration
            while time.monotonic() < until:
                if select.select([master], [], [], 0.03)[0]:
                    try:
                        capture.extend(os.read(master, 65536))
                    except OSError:
                        return
        try:
            drain(0.8)
            assert b"\x1b[?1049h" in capture and b"\x1b[?1003h" in capture, repr(capture[:1000])
            assert b"WIP / NOT CONNECTED" in capture and b"rendering failed" not in capture
            if not motion:
                assert b"PULL REQUESTS" in capture
            # With motion off the real pane is idle between events (five-second poll not due).
            length = len(capture)
            drain(0.2)
            assert (len(capture) > length if motion else len(capture) == length), "animation/idle scheduling mismatch"
            os.write(master, b"j\x1b[<35;3;12M\x1b[<0;3;12M")
            drain()
            os.write(master, b"a\x1b[200~PTY\ntask\x1b[201~\r")
            drain(0.4)
            assert any(r.get("params", {}).get("do") == "todo.add" and r["params"].get("text") == "PTY task" for r in requests)
            assert all(r["params"].get("actor") == "you" for r in requests if r["method"] == "act")
            assert all(r["params"] == {"sources": ["reviews", "scratch", "reviews"]} for r in requests if r["method"] == "get")
            assert all(r["params"].get("source") == "scratch" for r in requests if r.get("params", {}).get("do") == "todo.add")
            fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", 12, 40, 0, 0))
            child.send_signal(signal.SIGWINCH)
            drain()
            fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", 1, 1, 0, 0))
            child.send_signal(signal.SIGWINCH)
            drain()
            os.write(master, exit_key)
            drain(0.4)
            assert child.wait(timeout=3) == code
            assert termios.tcgetattr(slave) == before, "terminal attributes not restored"
            assert b"\x1b[?1003l" in capture and b"\x1b[?1006l" in capture
            assert b"\x1b[?2004h" in capture and b"\x1b[?2004l" in capture
            assert capture.endswith(b"\x1b[?1049l"), "alternate screen not restored"
        finally:
            if child.poll() is None:
                child.kill()
                child.wait()
            os.close(master)
            os.close(slave)
            stopped.set()
            thread.join(timeout=2)
            server.close()


exercise(b"q", 0)
exercise(b"\x03", 130)
exercise(b"q", 0, motion=True)
print("PTY SMOKE OK: fake socket, input, hover/click, add, idle, resize, q/Ctrl-C, restoration")
