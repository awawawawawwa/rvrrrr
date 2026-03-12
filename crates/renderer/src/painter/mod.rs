pub mod box_painter;
pub mod clip;
pub mod text_painter;

use crate::buffer::Buffer;
use crate::protocol::{Overflow, WidgetNode};
use clip::ClipRect;

/// Paint a widget tree into the buffer, respecting clip rects for overflow: hidden.
pub fn paint_tree(buf: &mut Buffer, node: &WidgetNode, clip: &ClipRect) {
    match node {
        WidgetNode::Box(box_node) => {
            box_painter::paint_box(buf, box_node, clip);

            let child_clip = if box_node.overflow == Overflow::Hidden {
                let bx = box_node.layout.x.round() as u16;
                let by = box_node.layout.y.round() as u16;
                let bw = box_node.layout.width.round() as u16;
                let bh = box_node.layout.height.round() as u16;

                let content_clip = ClipRect::new(bx, by, bw, bh);
                match clip.intersect(&content_clip) {
                    Some(clipped) => clipped,
                    None => return,
                }
            } else {
                *clip
            };

            for child in &box_node.children {
                paint_tree(buf, child, &child_clip);
            }
        }
        WidgetNode::Text(text_node) => {
            text_painter::paint_text(buf, text_node, clip);
        }
    }
}
