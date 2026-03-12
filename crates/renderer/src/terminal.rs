use std::io::{self, stdout, BufWriter, Stdout};

use crossterm::{
    cursor,
    execute,
    terminal::{
        self, EnterAlternateScreen, LeaveAlternateScreen,
        enable_raw_mode, disable_raw_mode,
    },
};

pub struct Terminal {
    writer: BufWriter<Stdout>,
    raw_mode_enabled: bool,
    alt_screen_entered: bool,
}

impl Terminal {
    /// Enter raw mode, switch to alternate screen, hide cursor.
    pub fn init() -> io::Result<Self> {
        enable_raw_mode()?;
        let mut writer = BufWriter::new(stdout());
        execute!(writer, EnterAlternateScreen, cursor::Hide)?;

        Ok(Self {
            writer,
            raw_mode_enabled: true,
            alt_screen_entered: true,
        })
    }

    pub fn writer(&mut self) -> &mut BufWriter<Stdout> {
        &mut self.writer
    }

    pub fn size() -> io::Result<(u16, u16)> {
        terminal::size()
    }

    /// Restore terminal state. Safe to call multiple times (idempotent).
    pub fn cleanup(&mut self) -> io::Result<()> {
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
        let mut stdout = stdout();
        let _ = execute!(stdout, cursor::Show, LeaveAlternateScreen);
        let _ = disable_raw_mode();
        original_hook(panic_info);
    }));
}
