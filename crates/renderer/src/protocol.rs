/// JSON protocol types matching `src/protocol/types.ts`.
///
/// Every struct here deserializes the exact JSON shape produced by the
/// TypeScript serializer so the two sides stay in lock-step.
use serde::Deserialize;

/// Absolute pixel position and size of a widget.
#[derive(Debug, Clone, Deserialize)]
pub struct Layout {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// Inner spacing applied inside a box widget.
#[derive(Debug, Clone, Deserialize)]
pub struct Padding {
    pub top: f64,
    pub right: f64,
    pub bottom: f64,
    pub left: f64,
}

/// Custom box-drawing characters for a border.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BoxStyleWire {
    pub top_left: String,
    pub top: String,
    pub top_right: String,
    pub right: String,
    pub bottom_right: String,
    pub bottom: String,
    pub bottom_left: String,
    pub left: String,
}

/// Border style — either a preset name like `"single"`, a custom
/// [`BoxStyleWire`] object, or absent (`null` in JSON → `None`).
#[derive(Debug, Clone, Deserialize)]
#[serde(untagged)]
pub enum BorderStyleInner {
    Preset(String),
    Custom(BoxStyleWire),
}

/// Border widths, style, and per-side color overrides.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Border {
    pub top: f64,
    pub right: f64,
    pub bottom: f64,
    pub left: f64,
    pub style: Option<BorderStyleInner>,
    pub color: Option<String>,
    pub top_color: Option<String>,
    pub right_color: Option<String>,
    pub bottom_color: Option<String>,
    pub left_color: Option<String>,
    pub dim_color: bool,
    pub top_dim_color: bool,
    pub right_dim_color: bool,
    pub bottom_dim_color: bool,
    pub left_dim_color: bool,
}

/// Content overflow strategy for a box widget.
#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Overflow {
    Visible,
    Hidden,
}

/// Data payload for a `kind: "box"` widget node.
#[derive(Debug, Clone, Deserialize)]
pub struct BoxNodeData {
    pub layout: Layout,
    pub padding: Padding,
    pub border: Border,
    pub background: Option<String>,
    pub overflow: Overflow,
    pub children: Vec<WidgetNode>,
}

/// Data payload for a `kind: "text"` widget node.
#[derive(Debug, Clone, Deserialize)]
pub struct TextNodeData {
    pub layout: Layout,
    pub content: String,
    pub wrap: String,
}

/// A widget in the render tree, discriminated by `kind`.
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "kind")]
pub enum WidgetNode {
    #[serde(rename = "box")]
    Box(BoxNodeData),
    #[serde(rename = "text")]
    Text(TextNodeData),
}

/// Top-level message received from the TypeScript engine, discriminated
/// by `type`.
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type")]
pub enum ProtocolMessage {
    #[serde(rename = "render")]
    Render { root: WidgetNode },
    #[serde(rename = "error")]
    Error {
        message: String,
        code: Option<String>,
    },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deserialize_render_message_with_box() {
        let json = r##"{
            "type": "render",
            "root": {
                "kind": "box",
                "layout": { "x": 0, "y": 0, "width": 80, "height": 24 },
                "padding": { "top": 1, "right": 2, "bottom": 1, "left": 2 },
                "border": {
                    "top": 1, "right": 1, "bottom": 1, "left": 1,
                    "style": "single",
                    "color": null,
                    "topColor": "#ff0000",
                    "rightColor": null,
                    "bottomColor": null,
                    "leftColor": null,
                    "dimColor": false,
                    "topDimColor": false,
                    "rightDimColor": false,
                    "bottomDimColor": false,
                    "leftDimColor": false
                },
                "background": "#1a1a2e",
                "overflow": "visible",
                "children": []
            }
        }"##;
        let msg: ProtocolMessage = serde_json::from_str(json).unwrap();
        match msg {
            ProtocolMessage::Render { root } => match root {
                WidgetNode::Box(b) => {
                    assert_eq!(b.layout.width, 80.0);
                    assert_eq!(b.padding.top, 1.0);
                    assert!(matches!(
                        b.border.style,
                        Some(BorderStyleInner::Preset(ref s)) if s == "single"
                    ));
                    assert_eq!(b.background.as_deref(), Some("#1a1a2e"));
                    assert_eq!(b.overflow, Overflow::Visible);
                }
                _ => panic!("expected box"),
            },
            _ => panic!("expected render message"),
        }
    }

    #[test]
    fn deserialize_text_node() {
        let json = r#"{
            "type": "render",
            "root": {
                "kind": "text",
                "layout": { "x": 5, "y": 3, "width": 20, "height": 1 },
                "content": "Hello, \u001b[31mworld\u001b[0m!",
                "wrap": "wrap"
            }
        }"#;
        let msg: ProtocolMessage = serde_json::from_str(json).unwrap();
        match msg {
            ProtocolMessage::Render { root } => match root {
                WidgetNode::Text(t) => {
                    assert_eq!(t.layout.x, 5.0);
                    assert!(t.content.contains("world"));
                    assert_eq!(t.wrap, "wrap");
                }
                _ => panic!("expected text"),
            },
            _ => panic!("expected render message"),
        }
    }

    #[test]
    fn deserialize_custom_border_style() {
        let json = r#"{
            "type": "render",
            "root": {
                "kind": "box",
                "layout": { "x": 0, "y": 0, "width": 10, "height": 3 },
                "padding": { "top": 0, "right": 0, "bottom": 0, "left": 0 },
                "border": {
                    "top": 1, "right": 1, "bottom": 1, "left": 1,
                    "style": {
                        "topLeft": "+", "top": "-", "topRight": "+",
                        "right": "|", "bottomRight": "+", "bottom": "-",
                        "bottomLeft": "+", "left": "|"
                    },
                    "color": null, "topColor": null, "rightColor": null,
                    "bottomColor": null, "leftColor": null,
                    "dimColor": false, "topDimColor": false, "rightDimColor": false,
                    "bottomDimColor": false, "leftDimColor": false
                },
                "background": null,
                "overflow": "hidden",
                "children": []
            }
        }"#;
        let msg: ProtocolMessage = serde_json::from_str(json).unwrap();
        match msg {
            ProtocolMessage::Render { root } => match root {
                WidgetNode::Box(b) => {
                    assert!(matches!(b.border.style, Some(BorderStyleInner::Custom(_))));
                    assert_eq!(b.overflow, Overflow::Hidden);
                }
                _ => panic!("expected box"),
            },
            _ => panic!("expected render message"),
        }
    }

    #[test]
    fn deserialize_null_border_style() {
        let json = r#"{
            "type": "render",
            "root": {
                "kind": "box",
                "layout": { "x": 0, "y": 0, "width": 10, "height": 3 },
                "padding": { "top": 0, "right": 0, "bottom": 0, "left": 0 },
                "border": {
                    "top": 0, "right": 0, "bottom": 0, "left": 0,
                    "style": null,
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
        let msg: ProtocolMessage = serde_json::from_str(json).unwrap();
        match msg {
            ProtocolMessage::Render { root } => match root {
                WidgetNode::Box(b) => {
                    assert!(b.border.style.is_none());
                }
                _ => panic!("expected box"),
            },
            _ => panic!("expected render message"),
        }
    }

    #[test]
    fn deserialize_error_message() {
        let json = r#"{"type":"error","message":"something broke","code":"E001"}"#;
        let msg: ProtocolMessage = serde_json::from_str(json).unwrap();
        match msg {
            ProtocolMessage::Error { message, code } => {
                assert_eq!(message, "something broke");
                assert_eq!(code.as_deref(), Some("E001"));
            }
            _ => panic!("expected error"),
        }
    }

    #[test]
    fn deserialize_nested_children() {
        let json = r#"{
            "type": "render",
            "root": {
                "kind": "box",
                "layout": { "x": 0, "y": 0, "width": 80, "height": 24 },
                "padding": { "top": 0, "right": 0, "bottom": 0, "left": 0 },
                "border": { "top": 0, "right": 0, "bottom": 0, "left": 0, "style": null, "color": null, "topColor": null, "rightColor": null, "bottomColor": null, "leftColor": null, "dimColor": false, "topDimColor": false, "rightDimColor": false, "bottomDimColor": false, "leftDimColor": false },
                "background": null,
                "overflow": "visible",
                "children": [
                    {
                        "kind": "text",
                        "layout": { "x": 0, "y": 0, "width": 13, "height": 1 },
                        "content": "Hello, world!",
                        "wrap": "wrap"
                    },
                    {
                        "kind": "box",
                        "layout": { "x": 0, "y": 1, "width": 40, "height": 3 },
                        "padding": { "top": 0, "right": 1, "bottom": 0, "left": 1 },
                        "border": { "top": 1, "right": 1, "bottom": 1, "left": 1, "style": "round", "color": null, "topColor": null, "rightColor": null, "bottomColor": null, "leftColor": null, "dimColor": false, "topDimColor": false, "rightDimColor": false, "bottomDimColor": false, "leftDimColor": false },
                        "background": null,
                        "overflow": "visible",
                        "children": [
                            {
                                "kind": "text",
                                "layout": { "x": 2, "y": 2, "width": 6, "height": 1 },
                                "content": "Nested",
                                "wrap": "truncate"
                            }
                        ]
                    }
                ]
            }
        }"#;
        let msg: ProtocolMessage = serde_json::from_str(json).unwrap();
        match msg {
            ProtocolMessage::Render { root } => match root {
                WidgetNode::Box(b) => {
                    assert_eq!(b.children.len(), 2);
                    assert!(matches!(&b.children[0], WidgetNode::Text(_)));
                    assert!(matches!(&b.children[1], WidgetNode::Box(_)));
                }
                _ => panic!("expected box"),
            },
            _ => panic!("expected render"),
        }
    }
}
