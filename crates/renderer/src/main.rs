use std::io::Write;

use futures::StreamExt;
use tokio::io::{AsyncBufReadExt, BufReader};

use tui_engine_renderer::ansi::emit_diff;
use tui_engine_renderer::buffer::Buffer;
use tui_engine_renderer::diff::compute_diff;
use tui_engine_renderer::input::map_crossterm_event;
use tui_engine_renderer::painter::{clip::ClipRect, paint_tree};
use tui_engine_renderer::protocol::{InMessage, OutMessage};
use tui_engine_renderer::terminal::{self, Terminal};

/// Write a single `OutMessage` as an NDJSON line to `stdout`.
///
/// Uses synchronous stdout (locked) because all NDJSON writes happen from the
/// single async task — no concurrent writers — and the lock is released after
/// each line.
fn write_ndjson(msg: &OutMessage) -> std::io::Result<()> {
    let mut line = serde_json::to_string(msg)
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
    line.push('\n');
    let stdout = std::io::stdout();
    let mut lock = stdout.lock();
    lock.write_all(line.as_bytes())?;
    lock.flush()?;
    Ok(())
}

#[tokio::main]
async fn main() {
    terminal::install_panic_hook();

    if let Err(e) = run().await {
        eprintln!("tui-engine-renderer fatal: {e}");
        std::process::exit(1);
    }
}

async fn run() -> std::io::Result<()> {
    let mut term = Terminal::init()?;
    let is_tty = term.is_tty;

    // Determine terminal size. In headless mode crossterm may not be able to
    // query the size, so fall back to a sensible default.
    let (init_w, init_h) = Terminal::size().unwrap_or((80, 24));
    let mut current = Buffer::new(init_w, init_h);
    let mut previous = Buffer::new(init_w, init_h);

    // Send the ready signal — JS side waits for this before sending frames.
    write_ndjson(&OutMessage::Ready)?;

    // --- async event loop ---------------------------------------------------

    let stdin = tokio::io::stdin();
    let mut lines = BufReader::new(stdin).lines();

    if is_tty {
        // Full bidirectional mode: multiplex stdin NDJSON + crossterm events.
        let mut event_stream = crossterm::event::EventStream::new();

        loop {
            tokio::select! {
                // Branch 1: next NDJSON line from parent on stdin.
                line_result = lines.next_line() => {
                    match line_result {
                        Ok(Some(line)) => {
                            if line.is_empty() {
                                continue;
                            }
                            match serde_json::from_str::<InMessage>(&line) {
                                Ok(msg) => {
                                    if !handle_in_message(
                                        msg,
                                        &mut term,
                                        &mut current,
                                        &mut previous,
                                    )? {
                                        break; // Shutdown requested
                                    }
                                }
                                Err(e) => {
                                    eprintln!("tui-engine-renderer: JSON parse error: {e}");
                                    let _ = write_ndjson(&OutMessage::Error {
                                        message: format!("JSON parse error: {e}"),
                                    });
                                }
                            }
                        }
                        Ok(None) => {
                            // stdin EOF — parent process has exited (BRDG-02).
                            eprintln!("tui-engine-renderer: stdin EOF, exiting");
                            break;
                        }
                        Err(e) => {
                            eprintln!("tui-engine-renderer: stdin read error: {e}");
                            break;
                        }
                    }
                }

                // Branch 2: crossterm terminal key/mouse events.
                event_result = event_stream.next() => {
                    match event_result {
                        Some(Ok(event)) => {
                            if let Some(input_event) = map_crossterm_event(event) {
                                let _ = write_ndjson(&OutMessage::Input { event: input_event });
                            }
                        }
                        Some(Err(e)) => {
                            eprintln!("tui-engine-renderer: crossterm event error: {e}");
                        }
                        None => {
                            // Event stream ended.
                            break;
                        }
                    }
                }
            }
        }
    } else {
        // Headless mode: stdin NDJSON only — no terminal event stream.
        loop {
            match lines.next_line().await {
                Ok(Some(line)) => {
                    if line.is_empty() {
                        continue;
                    }
                    match serde_json::from_str::<InMessage>(&line) {
                        Ok(msg) => {
                            if !handle_in_message(
                                msg,
                                &mut term,
                                &mut current,
                                &mut previous,
                            )? {
                                break;
                            }
                        }
                        Err(e) => {
                            eprintln!("tui-engine-renderer: JSON parse error: {e}");
                            let _ = write_ndjson(&OutMessage::Error {
                                message: format!("JSON parse error: {e}"),
                            });
                        }
                    }
                }
                Ok(None) => {
                    eprintln!("tui-engine-renderer: stdin EOF, exiting");
                    break;
                }
                Err(e) => {
                    eprintln!("tui-engine-renderer: stdin read error: {e}");
                    break;
                }
            }
        }
    }

    term.cleanup()?;
    Ok(())
}

/// Process a single `InMessage`. Returns `Ok(true)` to continue the loop,
/// `Ok(false)` to break (shutdown), or an `Err` for fatal IO errors.
fn handle_in_message(
    msg: InMessage,
    term: &mut Terminal,
    current: &mut Buffer,
    previous: &mut Buffer,
) -> std::io::Result<bool> {
    match msg {
        InMessage::Render { root, frame_id } => {
            // Sync terminal size (best-effort in headless mode).
            if let Ok((new_w, new_h)) = Terminal::size() {
                if new_w != current.width || new_h != current.height {
                    current.resize(new_w, new_h);
                    previous.resize(new_w, new_h);
                }
            }

            current.clear();
            let clip = ClipRect::full(current.width, current.height);
            paint_tree(current, &root, &clip);

            let runs = compute_diff(previous, current);
            emit_diff(term.writer(), &runs)?;
            // Flush the TTY writer so the frame appears immediately.
            term.writer().flush()?;

            std::mem::swap(current, previous);

            write_ndjson(&OutMessage::Rendered { frame_id })?;
        }
        InMessage::Resize { width, height } => {
            current.resize(width, height);
            previous.resize(width, height);
        }
        InMessage::Shutdown => {
            return Ok(false);
        }
        InMessage::Error { message, code } => {
            let code_str = code.as_deref().unwrap_or("UNKNOWN");
            eprintln!("tui-engine-renderer: protocol error [{code_str}]: {message}");
        }
    }
    Ok(true)
}
