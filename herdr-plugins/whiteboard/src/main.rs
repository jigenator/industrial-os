mod app;
mod board;
mod markdown;
mod palette;
mod ui;

use app::{App, Status};
use ratatui::crossterm::event::{self, DisableBracketedPaste, DisableMouseCapture, EnableBracketedPaste, EnableMouseCapture};
use ratatui::crossterm::execute;
use std::io::{self, BufRead, IsTerminal, Write};
use std::ffi::OsString;
use std::process::{Command, ExitCode, Stdio};
use std::{env, thread};
use std::time::{Duration, Instant};

const CLIPBOARD_TIMEOUT: Duration = Duration::from_secs(2);

fn main() -> ExitCode {
    let path = board::board_path(env::args_os().nth(1), |k| env::var(k).ok());
    // Load before taking over the terminal, and never replace a board that failed to load.
    let board = match board::Board::load(&path) {
        Ok(board) => board,
        Err(e) => return fail(&format!("cannot open the board at {}: {e}", path.display())),
    };
    let mut app = App::new(board, path);

    // ratatui's panic hook restores the screen, then calls this one to stop mouse and paste reporting.
    let hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        let _ = execute!(io::stdout(), DisableMouseCapture, DisableBracketedPaste);
        hook(info);
    }));
    let mut terminal = ratatui::init();
    let result =
        execute!(io::stdout(), EnableMouseCapture, EnableBracketedPaste).and_then(|()| run(&mut terminal, &mut app));
    let _ = execute!(io::stdout(), DisableMouseCapture, DisableBracketedPaste);
    ratatui::restore();
    match result {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => fail(&format!("terminal error: {e}")),
    }
}

fn run(terminal: &mut ratatui::DefaultTerminal, app: &mut App) -> io::Result<()> {
    while !app.quit {
        terminal.draw(|frame| ui::render(frame, app))?;
        app.handle(event::read()?);
        let copied = !app.clipboard_outbox.is_empty();
        for text in app.clipboard_outbox.drain(..) {
            write!(io::stdout(), "\x1b]52;c;{}\x07", base64(text.as_bytes()))?;
            let commands = clipboard_commands(env::var_os("WHITEBOARD_CLIPBOARD_CMD"));
            let _ = copy_to_system_clipboard(text, commands);
        }
        io::stdout().flush()?;
        // COPIED confirms the internal buffer and sent OSC request, not clipboard acknowledgement.
        if copied && !matches!(app.status, Status::Error(_)) {
            app.status = Status::Copied;
        }
    }
    Ok(())
}

/// The override is one executable path, never shell syntax, and disables real clipboard fallbacks.
fn clipboard_commands(override_command: Option<OsString>) -> Vec<Command> {
    if let Some(command) = override_command {
        return vec![Command::new(command)];
    }
    let mut commands = Vec::new();
    if cfg!(target_os = "macos") {
        commands.push(Command::new("pbcopy"));
    }
    commands.push(Command::new("wl-copy"));
    let mut xclip = Command::new("xclip");
    xclip.args(["-selection", "clipboard"]);
    commands.push(xclip);
    commands
}

fn copy_to_system_clipboard(text: String, commands: Vec<Command>) -> io::Result<thread::JoinHandle<()>> {
    // Pipe writes can block too; keep spawn, write and reap off the input/render thread.
    thread::Builder::new().name("clipboard".into()).spawn(move || {
        for mut command in commands {
            let Ok(mut child) = command.stdin(Stdio::piped()).stdout(Stdio::null()).stderr(Stdio::null()).spawn()
            else {
                continue;
            };
            let deadline = Instant::now() + CLIPBOARD_TIMEOUT;
            let Some(mut stdin) = child.stdin.take() else {
                let _ = child.kill();
                let _ = child.wait();
                continue;
            };
            // The supervisor must remain able to kill a helper that never reads stdin.
            let text = text.clone();
            let Ok(writer) =
                thread::Builder::new().name("clipboard-stdin".into()).spawn(move || stdin.write_all(text.as_bytes()))
            else {
                let _ = child.kill();
                let _ = child.wait();
                return;
            };
            let status = loop {
                match child.try_wait() {
                    Ok(Some(status)) => break Some(status),
                    Ok(None) if Instant::now() < deadline => thread::sleep(Duration::from_millis(10)),
                    _ => {
                        let _ = child.kill();
                        let _ = child.wait();
                        break None;
                    }
                }
            };
            let wrote = writer.join().is_ok_and(|result| result.is_ok());
            if wrote && status.is_some_and(|status| status.success()) {
                return;
            }
        }
    })
}

fn base64(bytes: &[u8]) -> String {
    const DIGITS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::new();
    for chunk in bytes.chunks(3) {
        let a = chunk[0] as usize;
        let b = chunk.get(1).copied().unwrap_or(0) as usize;
        let c = chunk.get(2).copied().unwrap_or(0) as usize;
        out.push(DIGITS[a >> 2] as char);
        out.push(DIGITS[(a & 3) << 4 | b >> 4] as char);
        out.push(if chunk.len() > 1 { DIGITS[(b & 15) << 2 | c >> 6] as char } else { '=' });
        out.push(if chunk.len() > 2 { DIGITS[c & 63] as char } else { '=' });
    }
    out
}

/// Reports a failure. In a Herdr pane the pane closes when the process exits, so wait for Enter
/// to keep the message readable.
fn fail(message: &str) -> ExitCode {
    eprintln!("whiteboard: {message}");
    if io::stdin().is_terminal() {
        eprintln!("Press Enter to close.");
        let _ = io::stdin().lock().read_line(&mut String::new());
    }
    ExitCode::FAILURE
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::{Path, PathBuf};

    fn temp_dir(label: &str) -> PathBuf {
        let dir = env::temp_dir().join(format!("wb-clipboard-{label}-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn file_clipboard(path: &Path) -> Command {
        let mut command = Command::new("/bin/sh");
        command.args(["-c", "cat > \"$1\"", "clipboard-test"]).arg(path);
        command
    }

    #[test]
    fn review_nonzero_clipboard_helper_tries_the_next_command() {
        let dir = temp_dir("review-nonzero");
        let output = dir.join("text");
        let mut failure = Command::new("/bin/sh");
        failure.args(["-c", "exit 7"]);
        copy_to_system_clipboard("日本".into(), vec![failure, file_clipboard(&output)]).unwrap().join().unwrap();
        let actual = fs::read_to_string(&output);
        fs::remove_dir_all(dir).unwrap();
        assert_eq!(actual.unwrap(), "日本");
    }

    #[test]
    fn review_clipboard_timeout_covers_a_blocked_pipe_and_reaps_the_helper() {
        let dir = temp_dir("review-timeout");
        let output = dir.join("text");
        let pid_file = dir.join("pid");
        let mut blocked = Command::new("/bin/sh");
        blocked.args(["-c", "echo $$ > \"$1\"; exec sleep 3", "clipboard-test"]).arg(&pid_file);
        let text = "日".repeat(100_000);
        let started = std::time::Instant::now();
        copy_to_system_clipboard(text.clone(), vec![blocked, file_clipboard(&output)]).unwrap().join().unwrap();
        let elapsed = started.elapsed();
        let actual = fs::read_to_string(&output);
        let pid = fs::read_to_string(&pid_file).unwrap();
        let alive = Command::new("/bin/kill")
            .args(["-0", pid.trim()])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .unwrap()
            .success();
        fs::remove_dir_all(dir).unwrap();
        assert!(!alive, "timed-out helper was not killed and reaped");
        assert!(elapsed < std::time::Duration::from_millis(2800), "{elapsed:?}");
        assert_eq!(actual.unwrap(), text);
    }

    #[test]
    fn base64_covers_padding_and_utf8() {
        for (text, encoded) in [("", ""), ("f", "Zg=="), ("fo", "Zm8="), ("foo", "Zm9v"), ("日本", "5pel5pys")] {
            assert_eq!(base64(text.as_bytes()), encoded);
        }
    }

    #[test]
    fn clipboard_command_order_and_override_do_not_invoke_a_shell() {
        let commands = clipboard_commands(None);
        let names: Vec<_> = commands.iter().map(|c| c.get_program()).collect();
        let expected =
            if cfg!(target_os = "macos") { vec!["pbcopy", "wl-copy", "xclip"] } else { vec!["wl-copy", "xclip"] };
        assert_eq!(names, expected);
        assert_eq!(commands.last().unwrap().get_args().collect::<Vec<_>>(), ["-selection", "clipboard"]);
        let commands = clipboard_commands(Some("/tmp/path with spaces/clipboard-writer".into()));
        assert_eq!(commands.len(), 1);
        assert_eq!(commands[0].get_program(), "/tmp/path with spaces/clipboard-writer");
        assert_eq!(commands[0].get_args().len(), 0);
    }

    #[test]
    fn missing_command_falls_back_and_writes_exact_utf8_then_closes_stdin() {
        let dir = temp_dir("fallback");
        let output = dir.join("text");
        let text = "日本\nhello\n";
        let commands = vec![Command::new(dir.join("missing-command")), file_clipboard(&output)];
        copy_to_system_clipboard(text.into(), commands).unwrap().join().unwrap();
        assert_eq!(fs::read_to_string(&output).unwrap(), text);
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn missing_override_never_uses_real_clipboard() {
        let dir = temp_dir("override-failure");
        let commands = clipboard_commands(Some(dir.join("missing-override").into_os_string()));
        assert_eq!(commands.len(), 1);
        copy_to_system_clipboard("ignored".into(), commands).unwrap().join().unwrap();
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn blocked_clipboard_pipe_does_not_block_the_caller() {
        let dir = temp_dir("blocked");
        let release = dir.join("release");
        let output = dir.join("text");
        let mut command = Command::new("/bin/sh");
        command
            .args(["-c", "while [ ! -e \"$1\" ]; do sleep 0.01; done; cat > \"$2\"", "clipboard-test"])
            .arg(&release)
            .arg(&output);
        let text = "日".repeat(100_000); // More than a pipe can hold while its reader waits.
        let worker = copy_to_system_clipboard(text.clone(), vec![command]).unwrap();
        let finished_before_release = worker.is_finished();
        fs::write(release, "").unwrap();
        worker.join().unwrap();
        assert!(!finished_before_release);
        assert_eq!(fs::read_to_string(output).unwrap(), text);
        fs::remove_dir_all(dir).unwrap();
    }
}
