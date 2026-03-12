use tui_engine_renderer::buffer::Buffer;
use tui_engine_renderer::diff::compute_diff;
use tui_engine_renderer::painter::{clip::ClipRect, paint_tree};
use tui_engine_renderer::protocol::ProtocolMessage;

fn parse_and_render(json: &str, width: u16, height: u16) -> Buffer {
    let msg: ProtocolMessage = serde_json::from_str(json).unwrap();
    let root = match msg {
        ProtocolMessage::Render { root } => root,
        _ => panic!("expected render message"),
    };
    let mut buf = Buffer::new(width, height);
    let clip = ClipRect::full(width, height);
    paint_tree(&mut buf, &root, &clip);
    buf
}

#[test]
fn simple_text_renders_at_position() {
    let json = r#"{
        "type": "render",
        "root": {
            "kind": "text",
            "layout": { "x": 5, "y": 2, "width": 13, "height": 1 },
            "content": "Hello, world!",
            "wrap": "wrap"
        }
    }"#;
    let buf = parse_and_render(json, 80, 24);
    assert_eq!(buf.cell(5, 2).unwrap().grapheme, "H");
    assert_eq!(buf.cell(6, 2).unwrap().grapheme, "e");
    assert_eq!(buf.cell(17, 2).unwrap().grapheme, "!");
    assert_eq!(buf.cell(4, 2).unwrap().grapheme, " ");
}

#[test]
fn box_border_renders_correctly() {
    let json = r#"{
        "type": "render",
        "root": {
            "kind": "box",
            "layout": { "x": 0, "y": 0, "width": 10, "height": 3 },
            "padding": { "top": 0, "right": 0, "bottom": 0, "left": 0 },
            "border": {
                "top": 1, "right": 1, "bottom": 1, "left": 1,
                "style": "single",
                "color": null, "topColor": null, "rightColor": null,
                "bottomColor": null, "leftColor": null,
                "dimColor": false, "topDimColor": false, "rightDimColor": false,
                "bottomDimColor": false, "leftDimColor": false
            },
            "background": null,
            "overflow": "visible",
            "children": []
        }
    }"#;
    let buf = parse_and_render(json, 80, 24);
    assert_eq!(buf.cell(0, 0).unwrap().grapheme, "┌");
    assert_eq!(buf.cell(9, 0).unwrap().grapheme, "┐");
    assert_eq!(buf.cell(0, 2).unwrap().grapheme, "└");
    assert_eq!(buf.cell(9, 2).unwrap().grapheme, "┘");
    assert_eq!(buf.cell(5, 0).unwrap().grapheme, "─");
    assert_eq!(buf.cell(0, 1).unwrap().grapheme, "│");
}

#[test]
fn diff_detects_changes() {
    let json1 = r#"{
        "type": "render",
        "root": {
            "kind": "text",
            "layout": { "x": 0, "y": 0, "width": 5, "height": 1 },
            "content": "Hello",
            "wrap": "wrap"
        }
    }"#;
    let json2 = r#"{
        "type": "render",
        "root": {
            "kind": "text",
            "layout": { "x": 0, "y": 0, "width": 5, "height": 1 },
            "content": "World",
            "wrap": "wrap"
        }
    }"#;
    let buf1 = parse_and_render(json1, 80, 24);
    let buf2 = parse_and_render(json2, 80, 24);
    let diff = compute_diff(&buf1, &buf2);
    assert!(!diff.is_empty());
    assert_eq!(diff[0].y, 0);
}

#[test]
fn no_diff_for_identical_frames() {
    let json = r#"{
        "type": "render",
        "root": {
            "kind": "text",
            "layout": { "x": 0, "y": 0, "width": 5, "height": 1 },
            "content": "Hello",
            "wrap": "wrap"
        }
    }"#;
    let buf1 = parse_and_render(json, 80, 24);
    let buf2 = parse_and_render(json, 80, 24);
    let diff = compute_diff(&buf1, &buf2);
    assert!(diff.is_empty());
}

#[test]
fn overflow_hidden_clips_children() {
    let json = r#"{
        "type": "render",
        "root": {
            "kind": "box",
            "layout": { "x": 0, "y": 0, "width": 5, "height": 3 },
            "padding": { "top": 0, "right": 0, "bottom": 0, "left": 0 },
            "border": { "top": 0, "right": 0, "bottom": 0, "left": 0, "style": null, "color": null, "topColor": null, "rightColor": null, "bottomColor": null, "leftColor": null, "dimColor": false, "topDimColor": false, "rightDimColor": false, "bottomDimColor": false, "leftDimColor": false },
            "background": null,
            "overflow": "hidden",
            "children": [
                {
                    "kind": "text",
                    "layout": { "x": 0, "y": 0, "width": 20, "height": 1 },
                    "content": "This is too long to fit",
                    "wrap": "wrap"
                }
            ]
        }
    }"#;
    let buf = parse_and_render(json, 80, 24);
    assert_eq!(buf.cell(0, 0).unwrap().grapheme, "T");
    assert_eq!(buf.cell(4, 0).unwrap().grapheme, " ");
    assert_eq!(buf.cell(5, 0).unwrap().grapheme, " ");
}

#[test]
fn ansi_colored_text_sets_cell_fg() {
    let json = r#"{
        "type": "render",
        "root": {
            "kind": "text",
            "layout": { "x": 0, "y": 0, "width": 20, "height": 1 },
            "content": "\u001b[31mred\u001b[0m normal",
            "wrap": "wrap"
        }
    }"#;
    let buf = parse_and_render(json, 80, 24);
    assert_eq!(buf.cell(0, 0).unwrap().grapheme, "r");
    assert_eq!(
        buf.cell(0, 0).unwrap().fg,
        Some(crossterm::style::Color::DarkRed)
    );
    assert_eq!(buf.cell(3, 0).unwrap().grapheme, " ");
    assert_eq!(buf.cell(3, 0).unwrap().fg, None);
    assert_eq!(buf.cell(4, 0).unwrap().grapheme, "n");
    assert_eq!(buf.cell(4, 0).unwrap().fg, None);
}

#[test]
fn nested_box_with_border_and_text() {
    let json = r#"{
        "type": "render",
        "root": {
            "kind": "box",
            "layout": { "x": 0, "y": 0, "width": 20, "height": 5 },
            "padding": { "top": 0, "right": 0, "bottom": 0, "left": 0 },
            "border": { "top": 1, "right": 1, "bottom": 1, "left": 1, "style": "round", "color": null, "topColor": null, "rightColor": null, "bottomColor": null, "leftColor": null, "dimColor": false, "topDimColor": false, "rightDimColor": false, "bottomDimColor": false, "leftDimColor": false },
            "background": null,
            "overflow": "visible",
            "children": [
                {
                    "kind": "text",
                    "layout": { "x": 1, "y": 1, "width": 5, "height": 1 },
                    "content": "Hello",
                    "wrap": "wrap"
                }
            ]
        }
    }"#;
    let buf = parse_and_render(json, 80, 24);
    assert_eq!(buf.cell(0, 0).unwrap().grapheme, "╭");
    assert_eq!(buf.cell(19, 0).unwrap().grapheme, "╮");
    assert_eq!(buf.cell(1, 1).unwrap().grapheme, "H");
    assert_eq!(buf.cell(5, 1).unwrap().grapheme, "o");
}

#[test]
fn box_with_background_fills_cells() {
    let json = r##"{
        "type": "render",
        "root": {
            "kind": "box",
            "layout": { "x": 2, "y": 1, "width": 4, "height": 2 },
            "padding": { "top": 0, "right": 0, "bottom": 0, "left": 0 },
            "border": { "top": 0, "right": 0, "bottom": 0, "left": 0, "style": null, "color": null, "topColor": null, "rightColor": null, "bottomColor": null, "leftColor": null, "dimColor": false, "topDimColor": false, "rightDimColor": false, "bottomDimColor": false, "leftDimColor": false },
            "background": "#ff0000",
            "overflow": "visible",
            "children": []
        }
    }"##;
    let buf = parse_and_render(json, 80, 24);
    assert_eq!(
        buf.cell(2, 1).unwrap().bg,
        Some(crossterm::style::Color::Rgb { r: 255, g: 0, b: 0 })
    );
    assert_eq!(
        buf.cell(5, 2).unwrap().bg,
        Some(crossterm::style::Color::Rgb { r: 255, g: 0, b: 0 })
    );
    assert_eq!(buf.cell(1, 1).unwrap().bg, None);
    assert_eq!(buf.cell(6, 1).unwrap().bg, None);
}

#[test]
fn emit_diff_roundtrip() {
    use tui_engine_renderer::ansi::emit_diff;

    let json1 = r#"{
        "type": "render",
        "root": {
            "kind": "text",
            "layout": { "x": 0, "y": 0, "width": 5, "height": 1 },
            "content": "Hello",
            "wrap": "wrap"
        }
    }"#;
    let json2 = r#"{
        "type": "render",
        "root": {
            "kind": "text",
            "layout": { "x": 0, "y": 0, "width": 5, "height": 1 },
            "content": "World",
            "wrap": "wrap"
        }
    }"#;
    let buf1 = parse_and_render(json1, 80, 24);
    let buf2 = parse_and_render(json2, 80, 24);
    let diff = compute_diff(&buf1, &buf2);

    let mut output = Vec::new();
    emit_diff(&mut output, &diff).unwrap();
    let s = String::from_utf8(output).unwrap();
    assert!(s.contains("W"));
    assert!(s.contains("o"));
    assert!(s.contains("r"));
    assert!(s.contains("l"));
    assert!(s.contains("d"));
}
