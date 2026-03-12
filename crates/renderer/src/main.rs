use tui_engine_renderer::protocol::ProtocolMessage;

fn main() {
    let test_json = r#"{"type":"render","root":{"kind":"box","layout":{"x":0,"y":0,"width":80,"height":24},"padding":{"top":0,"right":0,"bottom":0,"left":0},"border":{"top":0,"right":0,"bottom":0,"left":0,"style":null,"color":null,"topColor":null,"rightColor":null,"bottomColor":null,"leftColor":null,"dimColor":false,"topDimColor":false,"rightDimColor":false,"bottomDimColor":false,"leftDimColor":false},"background":null,"overflow":"visible","children":[]}}"#;
    let msg: ProtocolMessage = serde_json::from_str(test_json).expect("deserialization failed");
    eprintln!("Parsed message: {msg:?}");
}
