use std::io::{self, BufRead};

use tui_engine_renderer::ansi::emit_diff;
use tui_engine_renderer::buffer::Buffer;
use tui_engine_renderer::diff::compute_diff;
use tui_engine_renderer::painter::{clip::ClipRect, paint_tree};
use tui_engine_renderer::protocol::ProtocolMessage;
use tui_engine_renderer::terminal::{self, Terminal};

fn main() {
    terminal::install_panic_hook();
    if let Err(e) = run() {
        eprintln!("tui-engine-renderer error: {e}");
        std::process::exit(1);
    }
}

fn run() -> io::Result<()> {
    let mut term = Terminal::init()?;

    ctrlc::set_handler({
        move || {
            let mut stdout = io::stdout();
            let _ = crossterm::execute!(
                stdout,
                crossterm::cursor::Show,
                crossterm::terminal::LeaveAlternateScreen
            );
            let _ = crossterm::terminal::disable_raw_mode();
            std::process::exit(0);
        }
    })
    .expect("failed to set signal handler");

    let (width, height) = Terminal::size()?;
    let mut current = Buffer::new(width, height);
    let mut previous = Buffer::new(width, height);

    let stdin = io::stdin();
    let reader = stdin.lock();

    for line_result in reader.lines() {
        let line = match line_result {
            Ok(line) => line,
            Err(_) => break,
        };

        if line.is_empty() {
            continue;
        }

        let msg: ProtocolMessage = match serde_json::from_str(&line) {
            Ok(msg) => msg,
            Err(e) => {
                eprintln!("JSON parse error: {e}");
                continue;
            }
        };

        match msg {
            ProtocolMessage::Render { root } => {
                let (new_w, new_h) = Terminal::size()?;
                if new_w != current.width || new_h != current.height {
                    current.resize(new_w, new_h);
                    previous.resize(new_w, new_h);
                }

                current.clear();
                let clip = ClipRect::full(current.width, current.height);
                paint_tree(&mut current, &root, &clip);

                let runs = compute_diff(&previous, &current);
                emit_diff(term.writer(), &runs)?;

                std::mem::swap(&mut current, &mut previous);
            }
            ProtocolMessage::Error { message, code } => {
                let code_str = code.as_deref().unwrap_or("UNKNOWN");
                eprintln!("Protocol error [{code_str}]: {message}");
            }
        }
    }

    term.cleanup()?;
    Ok(())
}
