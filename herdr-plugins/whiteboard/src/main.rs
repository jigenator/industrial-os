mod app;
mod board;
mod markdown;
mod palette;
mod ui;

use app::App;
use ratatui::crossterm::event::{self, DisableBracketedPaste, DisableMouseCapture, EnableBracketedPaste, EnableMouseCapture};
use ratatui::crossterm::execute;
use std::io::{self, BufRead, IsTerminal};
use std::{env, process::ExitCode};

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
    }
    Ok(())
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
