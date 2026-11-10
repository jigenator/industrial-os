"""Isolated real POSIX PTY, not Herdr. Python standard library only, launched by node --test."""
import os, pty, termios, fcntl, struct, select, subprocess, time, signal, json, shutil, tempfile, re

# The background gradient gives neighbouring cells their own colors, so words are matched without SGR codes.
def plain(data):
    return re.sub(rb'\x1b\[[0-9;]*m', b'', data)

def size(fd,w,h):
    fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack('HHHH',h,w,0,0))

def drain(fd,seconds=.12):
    data=b''
    until=time.monotonic()+seconds
    while time.monotonic()<until:
        ready,_,_=select.select([fd],[],[],max(0,until-time.monotonic()))
        if ready:
            try:
                part=os.read(fd,262144)
                if not part: break
                data+=part
            except OSError: break
    return data

# Each run edits its own copy of the example lesson, so the bundled file never changes.
work=tempfile.mkdtemp(prefix='lesson-smoke-')
example='lesson-maker/examples/browser-caching.lesson'
restored=True
pair=False
ixonDisabled=True
for mode in ['quit','SIGINT','SIGTERM','SIGHUP','ctrl-c','pair']:
    master,slave=pty.openpty()
    size(slave,140,40)
    before=termios.tcgetattr(slave)
    # No Pi here: the chat must say so instead of reaching a model.
    env=dict(os.environ,TERM='xterm-256color',TERM_PROGRAM='isolated-pty',LESSON_MAKER_PI=os.path.join(work,'no-pi'))
    env.pop('NO_COLOR',None)
    lesson=os.path.join(work,mode,'browser-caching.lesson.json')
    os.makedirs(os.path.dirname(lesson))
    shutil.copy(example+'.json',lesson)
    shutil.copytree(example+'.assets',lesson[:-5]+'.assets')
    args=['node','lesson-maker/main.mjs']+([] if mode=='quit' else ['--images='+('kitty' if mode=='pair' else 'text')])+[lesson]
    proc=subprocess.Popen(args,stdin=slave,stdout=slave,stderr=slave,env=env)
    captured=drain(master,.45)
    assert proc.poll() is None, captured[-1000:]
    active=termios.tcgetattr(slave)
    ixonDisabled=ixonDisabled and not bool(active[0]&termios.IXON)
    assert not (active[3]&termios.ICANON)
    if mode=='quit':
        # Tab into the first form box (the speaker notes) and type; Ctrl-G leaves it (saving) for the composer. Printable q stays literal.
        os.write(master,b'\t typed q?')
        captured+=drain(master,.2)
        assert b'TYPE FIELD' in plain(captured)
        os.write(master,b'\x07')
        captured+=drain(master,.2)
        os.write(master,b'qvm012?\r')
        captured+=drain(master,.2)
        assert b'Saved' in plain(captured), 'saved'
        assert b'AI unavailable' in plain(captured), 'ai'
        # Back to the box, Esc leaves it so ? opens help; Esc closes help.
        os.write(master,b'\x07')
        captured+=drain(master)
        os.write(master,b'\x1b')
        captured+=drain(master)
        os.write(master,b'?')
        captured+=drain(master)
        assert b'KEYS AND MOUSE' in plain(captured).upper()
        os.write(master,b'\x1b')
        captured+=drain(master)
        size(slave,60,18);os.kill(proc.pid,signal.SIGWINCH)
        captured+=drain(master)
        assert b'Window too small' in plain(captured)
        size(slave,140,40);os.kill(proc.pid,signal.SIGWINCH)
        captured+=drain(master)
        # Everything is saved as it happens, so q quits at once.
        os.write(master,b'q')
    elif mode=='pair':
        # Initial S-1 (position 2) -> comparison (position 10).
        os.write(master,b']'*8)
        captured+=drain(master,.3)
        pair=captured.count(b'a=T,f=100')>=2
        # Composer keystrokes must not re-transmit graphics.
        os.write(master,b'\x07typing')
        typing=drain(master)
        assert b'a=T' not in typing
        os.write(master,b'\x03')
    elif mode=='ctrl-c':
        # A real SGR click on a lesson-plan tab in the top bar switches view before Ctrl-C.
        os.write(master,b'\x1b[<0;35;1M\x1b[<0;35;1m')
        assert b'every slide follows it' in plain(drain(master,.3))
        os.write(master,b'\x03')
    else: os.kill(proc.pid,getattr(signal,mode))
    captured+=drain(master,.2)
    proc.wait(timeout=4)
    assert proc.returncode==0,(mode,proc.returncode,captured[-1000:])
    after=termios.tcgetattr(slave)
    restored=restored and before==after
    assert b'\x1b[?2004l' in captured and b'\x1b[?1049l' in captured
    # Click reporting is requested on start and released on every exit path.
    assert b'\x1b[?1003h\x1b[?1006h\x1b[>1u' in captured and b'\x1b[?1006l\x1b[?1003l' in captured
    assert b'\x1b[<u\x1b[?1049l' in captured
    if mode=='pair': assert b'a=d,d=I' in captured
    if mode=='quit':
        saved=json.load(open(lesson))
        notes=saved['sections'][0]['slides'][0]['speakerNotes']
        assert notes.endswith(' typed q?'), notes
    os.close(master);os.close(slave)
shutil.rmtree(work)
assert restored and pair and ixonDisabled
print(json.dumps(dict(runs=6,restored=restored,pair=pair,ixonDisabled=ixonDisabled)))
