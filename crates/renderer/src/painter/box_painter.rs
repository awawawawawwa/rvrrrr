use crate::buffer::Buffer;
use crate::borders::{preset_border, BorderCharsOwned};
use crate::colors::parse_color;
use crate::painter::clip::ClipRect;
use crate::protocol::{BorderStyleInner, BoxNodeData};

/// Paint a box node into the buffer within the given clip rect.
pub fn paint_box(buf: &mut Buffer, node: &BoxNodeData, clip: &ClipRect) {
    let x = node.layout.x.round() as u16;
    let y = node.layout.y.round() as u16;
    let w = node.layout.width.round() as u16;
    let h = node.layout.height.round() as u16;

    if w == 0 || h == 0 {
        return;
    }

    let bg = node.background.as_deref().and_then(parse_color);

    if let Some(bg_color) = bg {
        for row in y..y.saturating_add(h) {
            for col in x..x.saturating_add(w) {
                if clip.contains(col, row) {
                    if let Some(cell) = buf.cell_mut(col, row) {
                        cell.bg = Some(bg_color);
                    }
                }
            }
        }
    }

    paint_borders(buf, node, x, y, w, h, clip, bg);
}

fn paint_borders(
    buf: &mut Buffer,
    node: &BoxNodeData,
    x: u16,
    y: u16,
    w: u16,
    h: u16,
    clip: &ClipRect,
    bg: Option<crossterm::style::Color>,
) {
    let border = &node.border;
    let has_border =
        border.top > 0.0 || border.right > 0.0 || border.bottom > 0.0 || border.left > 0.0;
    if !has_border {
        return;
    }

    match &border.style {
        Some(BorderStyleInner::Preset(name)) => {
            if let Some(chars) = preset_border(name) {
                paint_border_chars(
                    buf, node, x, y, w, h, clip, bg, chars.top_left, chars.top,
                    chars.top_right, chars.right, chars.bottom_right, chars.bottom,
                    chars.bottom_left, chars.left,
                );
            }
        }
        Some(BorderStyleInner::Custom(wire)) => {
            let owned = BorderCharsOwned::from(wire);
            paint_border_chars(
                buf, node, x, y, w, h, clip, bg, &owned.top_left, &owned.top,
                &owned.top_right, &owned.right, &owned.bottom_right, &owned.bottom,
                &owned.bottom_left, &owned.left,
            );
        }
        None => {}
    }
}

#[allow(clippy::too_many_arguments)]
fn paint_border_chars(
    buf: &mut Buffer,
    node: &BoxNodeData,
    x: u16,
    y: u16,
    w: u16,
    h: u16,
    clip: &ClipRect,
    bg: Option<crossterm::style::Color>,
    tl: &str,
    t: &str,
    tr: &str,
    r: &str,
    br: &str,
    b: &str,
    bl: &str,
    l: &str,
) {
    let border = &node.border;

    let border_fg = border.color.as_deref().and_then(parse_color);
    let top_fg = border
        .top_color
        .as_deref()
        .and_then(parse_color)
        .or(border_fg);
    let right_fg = border
        .right_color
        .as_deref()
        .and_then(parse_color)
        .or(border_fg);
    let bottom_fg = border
        .bottom_color
        .as_deref()
        .and_then(parse_color)
        .or(border_fg);
    let left_fg = border
        .left_color
        .as_deref()
        .and_then(parse_color)
        .or(border_fg);

    let top_dim = border.top_dim_color || border.dim_color;
    let right_dim = border.right_dim_color || border.dim_color;
    let bottom_dim = border.bottom_dim_color || border.dim_color;
    let left_dim = border.left_dim_color || border.dim_color;

    let mut set =
        |col: u16, row: u16, ch: &str, fg: Option<crossterm::style::Color>, dim: bool| {
            if clip.contains(col, row) {
                if let Some(cell) = buf.cell_mut(col, row) {
                    cell.grapheme.clear();
                    cell.grapheme.push_str(ch);
                    cell.fg = fg;
                    cell.bg = bg;
                    cell.dim = dim;
                }
            }
        };

    let x_end = x + w - 1;
    let y_end = y + h - 1;

    if border.top > 0.0 && h > 0 {
        if border.left > 0.0 && w > 1 {
            set(x, y, tl, top_fg, top_dim);
        }
        let col_start = x + if border.left > 0.0 { 1 } else { 0 };
        let col_end = x_end.saturating_sub(if border.right > 0.0 { 1 } else { 0 });
        for col in col_start..=col_end {
            set(col, y, t, top_fg, top_dim);
        }
        if border.right > 0.0 && w > 1 {
            set(x_end, y, tr, top_fg, top_dim);
        }
    }

    if border.bottom > 0.0 && h > 1 {
        if border.left > 0.0 && w > 1 {
            set(x, y_end, bl, bottom_fg, bottom_dim);
        }
        let col_start = x + if border.left > 0.0 { 1 } else { 0 };
        let col_end = x_end.saturating_sub(if border.right > 0.0 { 1 } else { 0 });
        for col in col_start..=col_end {
            set(col, y_end, b, bottom_fg, bottom_dim);
        }
        if border.right > 0.0 && w > 1 {
            set(x_end, y_end, br, bottom_fg, bottom_dim);
        }
    }

    if border.left > 0.0 {
        let start_row = y + if border.top > 0.0 { 1 } else { 0 };
        let end_row = y_end.saturating_sub(if border.bottom > 0.0 { 1 } else { 0 });
        for row in start_row..=end_row {
            set(x, row, l, left_fg, left_dim);
        }
    }

    if border.right > 0.0 && w > 1 {
        let start_row = y + if border.top > 0.0 { 1 } else { 0 };
        let end_row = y_end.saturating_sub(if border.bottom > 0.0 { 1 } else { 0 });
        for row in start_row..=end_row {
            set(x_end, row, r, right_fg, right_dim);
        }
    }
}
