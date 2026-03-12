use std::io::Write;

use crossterm::{
    cursor::MoveTo,
    style::{Attribute, Color, ResetColor, SetAttribute, SetBackgroundColor, SetForegroundColor},
    QueueableCommand,
};

use crate::diff::CellRun;

/// Emit ANSI escape sequences for the given diff runs to the writer.
/// Tracks last-emitted style state to minimize redundant escape sequences.
pub fn emit_diff<W: Write>(writer: &mut W, runs: &[CellRun]) -> std::io::Result<()> {
    let mut last_fg: Option<Color> = None;
    let mut last_bg: Option<Color> = None;
    let mut last_bold = false;
    let mut last_italic = false;
    let mut last_underline = false;
    let mut last_strikethrough = false;
    let mut last_dim = false;
    let mut last_inverse = false;

    for run in runs {
        writer.queue(MoveTo(run.x, run.y))?;

        for cell in &run.cells {
            let style_changed = cell.bold != last_bold
                || cell.italic != last_italic
                || cell.underline != last_underline
                || cell.strikethrough != last_strikethrough
                || cell.dim != last_dim
                || cell.inverse != last_inverse;

            if style_changed {
                writer.queue(SetAttribute(Attribute::Reset))?;
                last_fg = None;
                last_bg = None;

                if cell.bold {
                    writer.queue(SetAttribute(Attribute::Bold))?;
                }
                if cell.italic {
                    writer.queue(SetAttribute(Attribute::Italic))?;
                }
                if cell.underline {
                    writer.queue(SetAttribute(Attribute::Underlined))?;
                }
                if cell.strikethrough {
                    writer.queue(SetAttribute(Attribute::CrossedOut))?;
                }
                if cell.dim {
                    writer.queue(SetAttribute(Attribute::Dim))?;
                }
                if cell.inverse {
                    writer.queue(SetAttribute(Attribute::Reverse))?;
                }

                last_bold = cell.bold;
                last_italic = cell.italic;
                last_underline = cell.underline;
                last_strikethrough = cell.strikethrough;
                last_dim = cell.dim;
                last_inverse = cell.inverse;
            }

            if cell.fg != last_fg {
                match cell.fg {
                    Some(color) => {
                        writer.queue(SetForegroundColor(color))?;
                    }
                    None => {
                        writer.queue(ResetColor)?;
                        last_bg = None;
                    }
                };
                last_fg = cell.fg;
            }

            if cell.bg != last_bg {
                match cell.bg {
                    Some(color) => {
                        writer.queue(SetBackgroundColor(color))?;
                    }
                    None => {
                        if last_bg.is_some() {
                            writer.queue(SetBackgroundColor(Color::Reset))?;
                        }
                    }
                };
                last_bg = cell.bg;
            }

            if !cell.grapheme.is_empty() {
                write!(writer, "{}", cell.grapheme)?;
            }
        }
    }

    if last_bold
        || last_italic
        || last_underline
        || last_strikethrough
        || last_dim
        || last_inverse
        || last_fg.is_some()
        || last_bg.is_some()
    {
        writer.queue(SetAttribute(Attribute::Reset))?;
        writer.queue(ResetColor)?;
    }

    writer.flush()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::buffer::Cell;
    use crate::diff::CellRun;

    #[test]
    fn emit_empty_runs_produces_no_output() {
        let mut output = Vec::new();
        emit_diff(&mut output, &[]).unwrap();
        assert!(output.is_empty());
    }

    #[test]
    fn emit_single_cell_produces_output() {
        let runs = vec![CellRun {
            x: 0,
            y: 0,
            cells: vec![Cell {
                grapheme: "X".to_string(),
                fg: None,
                bg: None,
                bold: false,
                italic: false,
                underline: false,
                strikethrough: false,
                dim: false,
                inverse: false,
            }],
        }];
        let mut output = Vec::new();
        emit_diff(&mut output, &runs).unwrap();
        let s = String::from_utf8(output).unwrap();
        assert!(s.contains("X"));
    }

    #[test]
    fn emit_colored_cell_includes_color_sequence() {
        let runs = vec![CellRun {
            x: 5,
            y: 3,
            cells: vec![Cell {
                grapheme: "A".to_string(),
                fg: Some(Color::DarkRed),
                bg: None,
                bold: false,
                italic: false,
                underline: false,
                strikethrough: false,
                dim: false,
                inverse: false,
            }],
        }];
        let mut output = Vec::new();
        emit_diff(&mut output, &runs).unwrap();
        let s = String::from_utf8(output).unwrap();
        assert!(s.contains("A"));
        assert!(s.contains("\x1b["), "should contain ANSI escape sequences");
    }
}
