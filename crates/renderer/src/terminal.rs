use std::io::{self, IsTerminal, Write};

use crossterm::{
    cursor,
    execute,
    terminal::{
        self, EnterAlternateScreen, LeaveAlternateScreen,
        enable_raw_mode, disable_raw_mode,
    },
};

/// Opens the TTY device for rendering output (separate from stdout which is
/// used for NDJSON protocol messages).
///
/// - Unix: opens `/dev/tty`
/// - Windows: opens `CONOUT$`
///
/// Returns `None` if the device cannot be opened (headless / CI mode).
fn open_tty() -> Option<std::fs::File> {
    #[cfg(unix)]
    {
        std::fs::OpenOptions::new()
            .write(true)
            .open("/dev/tty")
            .ok()
    }
    #[cfg(windows)]
    {
        std::fs::OpenOptions::new()
            .write(true)
            .open("CONOUT$")
            .ok()
    }
    #[cfg(not(any(unix, windows)))]
    {
        None
    }
}

/// A crossterm terminal handle.
///
/// When a real TTY is available (`is_tty == true`), this enters raw mode and
/// the alternate screen, and all rendering writes go through the TTY device
/// (keeping stdout free for NDJSON protocol messages).
///
/// When no TTY is available (`is_tty == false`, headless / CI mode), raw mode
/// and alternate-screen setup are skipped and the writer is a no-op sink.
pub struct Terminal {
    writer: Box<dyn Write + Send>,
    raw_mode_enabled: bool,
    alt_screen_entered: bool,
    pub is_tty: bool,
}

impl Terminal {
    /// Enter raw mode, switch to alternate screen, hide cursor (TTY mode).
    /// If no TTY is available, initialise in headless mode without any of that.
    pub fn init() -> io::Result<Self> {
        // Detect TTY via stderr (stdin + stdout are piped in child-process mode).
        let is_tty = std::io::stderr().is_terminal();

        if is_tty {
            // Try to open the TTY device for rendering writes.
            if let Some(tty_file) = open_tty() {
                enable_raw_mode()?;
                let mut writer: Box<dyn Write + Send> = Box::new(io::BufWriter::new(tty_file));
                execute!(writer, EnterAlternateScreen, cursor::Hide)?;
                return Ok(Self {
                    writer,
                    raw_mode_enabled: true,
                    alt_screen_entered: true,
                    is_tty: true,
                });
            }
            // TTY detected but couldn't open device — fall through to headless.
        }

        // Headless mode: no raw mode, no alternate screen.
        eprintln!("tui-engine-renderer: no TTY detected, running in headless mode");
        let null_writer = open_null_writer();
        Ok(Self {
            writer: null_writer,
            raw_mode_enabled: false,
            alt_screen_entered: false,
            is_tty: false,
        })
    }

    /// Returns a mutable reference to the boxed writer.
    /// `Box<dyn Write + Send>` is `Sized` and implements `Write`, so you can
    /// pass `term.writer()` directly to functions requiring `&mut impl Write`.
    pub fn writer(&mut self) -> &mut Box<dyn Write + Send> {
        &mut self.writer
    }

    pub fn size() -> io::Result<(u16, u16)> {
        terminal::size()
    }

    /// Restore terminal state. Safe to call multiple times (idempotent).
    pub fn cleanup(&mut self) -> io::Result<()> {
        if !self.is_tty {
            return Ok(());
        }
        if self.alt_screen_entered {
            execute!(self.writer, cursor::Show, LeaveAlternateScreen)?;
            self.alt_screen_entered = false;
        }
        if self.raw_mode_enabled {
            disable_raw_mode()?;
            self.raw_mode_enabled = false;
        }
        Ok(())
    }
}

impl Drop for Terminal {
    fn drop(&mut self) {
        let _ = self.cleanup();
    }
}

/// Install a panic hook that restores terminal state before printing the panic.
/// Must be called before `Terminal::init()` so the hook can run cleanup
/// independently of the `Terminal` instance.
pub fn install_panic_hook() {
    let original_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |panic_info| {
        // Only attempt cleanup if we have a TTY.
        if std::io::stderr().is_terminal() {
            if let Some(mut tty) = open_tty() {
                let _ = execute!(tty, cursor::Show, LeaveAlternateScreen);
            }
            let _ = disable_raw_mode();
        }
        original_hook(panic_info);
    }));
}

/// Open a null/no-op writer for headless mode.
fn open_null_writer() -> Box<dyn Write + Send> {
    #[cfg(unix)]
    {
        if let Ok(f) = std::fs::OpenOptions::new().write(true).open("/dev/null") {
            return Box::new(io::BufWriter::new(f));
        }
    }
    #[cfg(windows)]
    {
        if let Ok(f) = std::fs::OpenOptions::new().write(true).open("NUL") {
            return Box::new(io::BufWriter::new(f));
        }
    }
    // Ultimate fallback: a Vec<u8> that discards everything.
    Box::new(io::sink())
}
