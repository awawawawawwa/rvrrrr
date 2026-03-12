use crate::buffer::Buffer;
use crate::painter::clip::ClipRect;
use crate::protocol::TextNodeData;
use crossterm::style::Color;
use unicode_width::UnicodeWidthChar;

struct AnsiState {
    fg: Option<Color>,
    bg: Option<Color>,
    bold: bool,
    italic: bool,
    underline: bool,
    strikethrough: bool,
    dim: bool,
    inverse: bool,
}

impl Default for AnsiState {
    fn default() -> Self {
        Self {
            fg: None,
            bg: None,
            bold: false,
            italic: false,
            underline: false,
            strikethrough: false,
            dim: false,
            inverse: false,
        }
    }
}

pub fn paint_text(buf: &mut Buffer, node: &TextNodeData, clip: &ClipRect) {
    let x0 = node.layout.x.round() as u16;
    let y0 = node.layout.y.round() as u16;
    let w = node.layout.width.round() as u16;
    let h = node.layout.height.round() as u16;

    if w == 0 || h == 0 {
        return;
    }

    let mut state = AnsiState::default();
    let mut col = x0;
    let mut row = y0;

    let chars: Vec<char> = node.content.chars().collect();
    let len = chars.len();
    let mut i = 0;

    while i < len {
        if row >= y0 + h {
            break;
        }

        let ch = chars[i];

        if ch == '\n' {
            col = x0;
            row += 1;
            i += 1;
            continue;
        }

        if ch == '\x1b' && i + 1 < len && chars[i + 1] == '[' {
            i = parse_ansi_csi(&chars, i, &mut state);
            continue;
        }

        let char_width = ch.width().unwrap_or(0) as u16;
        if char_width == 0 {
            i += 1;
            continue;
        }

        if col + char_width > x0 + w {
            col = x0;
            row += 1;
            if row >= y0 + h {
                break;
            }
        }

        if clip.contains(col, row) {
            if let Some(cell) = buf.cell_mut(col, row) {
                cell.grapheme.clear();
                cell.grapheme.push(ch);
                cell.fg = state.fg;
                cell.bg = state.bg;
                cell.bold = state.bold;
                cell.italic = state.italic;
                cell.underline = state.underline;
                cell.strikethrough = state.strikethrough;
                cell.dim = state.dim;
                cell.inverse = state.inverse;
            }
        }

        if char_width == 2 && clip.contains(col + 1, row) {
            if let Some(cell) = buf.cell_mut(col + 1, row) {
                cell.grapheme.clear();
                cell.fg = state.fg;
                cell.bg = state.bg;
                cell.bold = state.bold;
                cell.italic = state.italic;
                cell.underline = state.underline;
                cell.strikethrough = state.strikethrough;
                cell.dim = state.dim;
                cell.inverse = state.inverse;
            }
        }

        col += char_width;
        i += 1;
    }
}

/// Parse a CSI escape sequence starting at position `start` (the `\x1b` character).
/// Updates the ANSI state and returns the index after the sequence.
fn parse_ansi_csi(chars: &[char], start: usize, state: &mut AnsiState) -> usize {
    let mut i = start + 2; // skip \x1b[
    let mut params: Vec<u16> = Vec::new();
    let mut current_param: Option<u16> = None;

    while i < chars.len() {
        let ch = chars[i];
        match ch {
            '0'..='9' => {
                let digit = (ch as u16) - ('0' as u16);
                current_param = Some(current_param.unwrap_or(0) * 10 + digit);
                i += 1;
            }
            ';' => {
                params.push(current_param.unwrap_or(0));
                current_param = None;
                i += 1;
            }
            '\x40'..='\x7e' => {
                params.push(current_param.unwrap_or(0));
                apply_sgr(ch, &params, state);
                return i + 1;
            }
            _ => {
                return i + 1;
            }
        }
    }
    i
}

fn apply_sgr(final_byte: char, params: &[u16], state: &mut AnsiState) {
    if final_byte != 'm' {
        return;
    }
    if params.is_empty() || (params.len() == 1 && params[0] == 0) {
        *state = AnsiState::default();
        return;
    }

    let mut i = 0;
    while i < params.len() {
        match params[i] {
            0 => *state = AnsiState::default(),
            1 => state.bold = true,
            2 => state.dim = true,
            3 => state.italic = true,
            4 => state.underline = true,
            7 => state.inverse = true,
            9 => state.strikethrough = true,
            22 => {
                state.bold = false;
                state.dim = false;
            }
            23 => state.italic = false,
            24 => state.underline = false,
            27 => state.inverse = false,
            29 => state.strikethrough = false,
            30 => state.fg = Some(Color::Black),
            31 => state.fg = Some(Color::DarkRed),
            32 => state.fg = Some(Color::DarkGreen),
            33 => state.fg = Some(Color::DarkYellow),
            34 => state.fg = Some(Color::DarkBlue),
            35 => state.fg = Some(Color::DarkMagenta),
            36 => state.fg = Some(Color::DarkCyan),
            37 => state.fg = Some(Color::White),
            38 => {
                if let Some(color) = parse_extended_color(params, &mut i) {
                    state.fg = Some(color);
                }
            }
            39 => state.fg = None,
            40 => state.bg = Some(Color::Black),
            41 => state.bg = Some(Color::DarkRed),
            42 => state.bg = Some(Color::DarkGreen),
            43 => state.bg = Some(Color::DarkYellow),
            44 => state.bg = Some(Color::DarkBlue),
            45 => state.bg = Some(Color::DarkMagenta),
            46 => state.bg = Some(Color::DarkCyan),
            47 => state.bg = Some(Color::White),
            48 => {
                if let Some(color) = parse_extended_color(params, &mut i) {
                    state.bg = Some(color);
                }
            }
            49 => state.bg = None,
            90 => state.fg = Some(Color::DarkGrey),
            91 => state.fg = Some(Color::Red),
            92 => state.fg = Some(Color::Green),
            93 => state.fg = Some(Color::Yellow),
            94 => state.fg = Some(Color::Blue),
            95 => state.fg = Some(Color::Magenta),
            96 => state.fg = Some(Color::Cyan),
            97 => state.fg = Some(Color::White),
            100 => state.bg = Some(Color::DarkGrey),
            101 => state.bg = Some(Color::Red),
            102 => state.bg = Some(Color::Green),
            103 => state.bg = Some(Color::Yellow),
            104 => state.bg = Some(Color::Blue),
            105 => state.bg = Some(Color::Magenta),
            106 => state.bg = Some(Color::Cyan),
            107 => state.bg = Some(Color::White),
            _ => {}
        }
        i += 1;
    }
}

/// Parse 256-color (5;n) and truecolor (2;r;g;b) extended color sequences.
fn parse_extended_color(params: &[u16], i: &mut usize) -> Option<Color> {
    if *i + 1 >= params.len() {
        return None;
    }
    match params[*i + 1] {
        5 => {
            if *i + 2 < params.len() {
                let n = params[*i + 2] as u8;
                *i += 2;
                Some(Color::AnsiValue(n))
            } else {
                None
            }
        }
        2 => {
            if *i + 4 < params.len() {
                let r = params[*i + 2] as u8;
                let g = params[*i + 3] as u8;
                let b = params[*i + 4] as u8;
                *i += 4;
                Some(Color::Rgb { r, g, b })
            } else {
                None
            }
        }
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::buffer::Buffer;
    use crate::protocol::{Layout, TextNodeData};

    fn make_text_node(x: f64, y: f64, w: f64, h: f64, content: &str) -> TextNodeData {
        TextNodeData {
            layout: Layout {
                x,
                y,
                width: w,
                height: h,
            },
            content: content.to_string(),
            wrap: "wrap".to_string(),
        }
    }

    #[test]
    fn plain_text_at_position() {
        let mut buf = Buffer::new(20, 5);
        let node = make_text_node(3.0, 1.0, 5.0, 1.0, "Hello");
        let clip = ClipRect::full(20, 5);
        paint_text(&mut buf, &node, &clip);

        assert_eq!(buf.cell(3, 1).unwrap().grapheme, "H");
        assert_eq!(buf.cell(4, 1).unwrap().grapheme, "e");
        assert_eq!(buf.cell(7, 1).unwrap().grapheme, "o");
        assert_eq!(buf.cell(2, 1).unwrap().grapheme, " ");
    }

    #[test]
    fn ansi_red_sets_fg() {
        let mut buf = Buffer::new(20, 5);
        let node = make_text_node(0.0, 0.0, 20.0, 1.0, "\x1b[31mred\x1b[0m");
        let clip = ClipRect::full(20, 5);
        paint_text(&mut buf, &node, &clip);

        assert_eq!(buf.cell(0, 0).unwrap().grapheme, "r");
        assert_eq!(buf.cell(0, 0).unwrap().fg, Some(Color::DarkRed));
        assert_eq!(buf.cell(2, 0).unwrap().grapheme, "d");
        assert_eq!(buf.cell(2, 0).unwrap().fg, Some(Color::DarkRed));
    }

    #[test]
    fn ansi_bold_sets_style() {
        let mut buf = Buffer::new(20, 5);
        let node = make_text_node(0.0, 0.0, 20.0, 1.0, "\x1b[1mbold\x1b[0m");
        let clip = ClipRect::full(20, 5);
        paint_text(&mut buf, &node, &clip);

        assert!(buf.cell(0, 0).unwrap().bold);
        assert_eq!(buf.cell(0, 0).unwrap().grapheme, "b");
    }

    #[test]
    fn newline_moves_to_next_row() {
        let mut buf = Buffer::new(20, 5);
        let node = make_text_node(0.0, 0.0, 20.0, 3.0, "AB\nCD");
        let clip = ClipRect::full(20, 5);
        paint_text(&mut buf, &node, &clip);

        assert_eq!(buf.cell(0, 0).unwrap().grapheme, "A");
        assert_eq!(buf.cell(1, 0).unwrap().grapheme, "B");
        assert_eq!(buf.cell(0, 1).unwrap().grapheme, "C");
        assert_eq!(buf.cell(1, 1).unwrap().grapheme, "D");
    }

    #[test]
    fn clipped_text_not_written() {
        let mut buf = Buffer::new(20, 5);
        let node = make_text_node(0.0, 0.0, 20.0, 1.0, "Hello");
        let clip = ClipRect::new(2, 0, 2, 1); // only columns 2-3 visible
        paint_text(&mut buf, &node, &clip);

        assert_eq!(buf.cell(0, 0).unwrap().grapheme, " "); // clipped
        assert_eq!(buf.cell(1, 0).unwrap().grapheme, " "); // clipped
        assert_eq!(buf.cell(2, 0).unwrap().grapheme, "l");
        assert_eq!(buf.cell(3, 0).unwrap().grapheme, "l");
        assert_eq!(buf.cell(4, 0).unwrap().grapheme, " "); // clipped
    }

    #[test]
    fn truecolor_ansi_sequence() {
        let mut buf = Buffer::new(20, 5);
        let node = make_text_node(0.0, 0.0, 20.0, 1.0, "\x1b[38;2;255;128;0mX\x1b[0m");
        let clip = ClipRect::full(20, 5);
        paint_text(&mut buf, &node, &clip);

        assert_eq!(buf.cell(0, 0).unwrap().grapheme, "X");
        assert_eq!(
            buf.cell(0, 0).unwrap().fg,
            Some(Color::Rgb {
                r: 255,
                g: 128,
                b: 0
            })
        );
    }
}
