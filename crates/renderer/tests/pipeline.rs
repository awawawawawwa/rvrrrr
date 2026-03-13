use tui_engine_renderer::ansi::emit_diff;
use tui_engine_renderer::buffer::Buffer;
use tui_engine_renderer::diff::compute_diff;
use tui_engine_renderer::painter::{clip::ClipRect, paint_tree};
use tui_engine_renderer::protocol::InMessage;

#[test]
fn full_pipeline_two_frames() {
    let frame1 = r#"{"type":"render","frameId":1,"root":{"kind":"box","layout":{"x":0,"y":0,"width":20,"height":5},"padding":{"top":0,"right":0,"bottom":0,"left":0},"border":{"top":1,"right":1,"bottom":1,"left":1,"style":"single","color":null,"topColor":null,"rightColor":null,"bottomColor":null,"leftColor":null,"dimColor":false,"topDimColor":false,"rightDimColor":false,"bottomDimColor":false,"leftDimColor":false},"background":null,"overflow":"visible","children":[{"kind":"text","layout":{"x":1,"y":1,"width":18,"height":1},"content":"Hello","wrap":"wrap"}]}}"#;

    let frame2 = r#"{"type":"render","frameId":2,"root":{"kind":"box","layout":{"x":0,"y":0,"width":20,"height":5},"padding":{"top":0,"right":0,"bottom":0,"left":0},"border":{"top":1,"right":1,"bottom":1,"left":1,"style":"single","color":null,"topColor":null,"rightColor":null,"bottomColor":null,"leftColor":null,"dimColor":false,"topDimColor":false,"rightDimColor":false,"bottomDimColor":false,"leftDimColor":false},"background":null,"overflow":"visible","children":[{"kind":"text","layout":{"x":1,"y":1,"width":18,"height":1},"content":"World","wrap":"wrap"}]}}"#;

    let mut current = Buffer::new(20, 5);
    let mut previous = Buffer::new(20, 5);
    let clip = ClipRect::full(20, 5);

    let msg1: InMessage = serde_json::from_str(frame1).unwrap();
    if let InMessage::Render { root, .. } = msg1 {
        current.clear();
        paint_tree(&mut current, &root, &clip);
        let runs = compute_diff(&previous, &current);
        assert!(!runs.is_empty());
        let mut output = Vec::new();
        emit_diff(&mut output, &runs).unwrap();
        assert!(!output.is_empty());
        std::mem::swap(&mut current, &mut previous);
    }

    let msg2: InMessage = serde_json::from_str(frame2).unwrap();
    if let InMessage::Render { root, .. } = msg2 {
        current.clear();
        paint_tree(&mut current, &root, &clip);
        let runs = compute_diff(&previous, &current);
        assert!(!runs.is_empty());
        let total_cells: usize = runs.iter().map(|r| r.cells.len()).sum();
        assert!(total_cells < 20, "diff should be minimal, got {} cells", total_cells);
        let mut output = Vec::new();
        emit_diff(&mut output, &runs).unwrap();
        assert!(!output.is_empty());
    }
}

#[test]
fn identical_frames_produce_empty_diff() {
    let frame = r#"{"type":"render","frameId":1,"root":{"kind":"text","layout":{"x":0,"y":0,"width":10,"height":1},"content":"Same text!","wrap":"wrap"}}"#;

    let mut buf1 = Buffer::new(20, 5);
    let mut buf2 = Buffer::new(20, 5);
    let clip = ClipRect::full(20, 5);

    let msg: InMessage = serde_json::from_str(frame).unwrap();
    if let InMessage::Render { ref root, .. } = msg {
        paint_tree(&mut buf1, root, &clip);
        paint_tree(&mut buf2, root, &clip);
    }

    let runs = compute_diff(&buf1, &buf2);
    assert!(runs.is_empty(), "identical buffers should produce no diff");
}

#[test]
fn error_message_parses_without_crash() {
    let json = r#"{"type":"error","message":"something broke","code":"E001"}"#;
    let msg: InMessage = serde_json::from_str(json).unwrap();
    match msg {
        InMessage::Error { message, code } => {
            assert_eq!(message, "something broke");
            assert_eq!(code.as_deref(), Some("E001"));
        }
        _ => panic!("expected error message"),
    }
}

#[test]
fn malformed_json_returns_parse_error() {
    let bad_json = r#"{"type":"render","root":INVALID}"#;
    let result: Result<InMessage, _> = serde_json::from_str(bad_json);
    assert!(result.is_err());
}

#[test]
fn empty_line_is_not_valid_json() {
    let result: Result<InMessage, _> = serde_json::from_str("");
    assert!(result.is_err());
}
