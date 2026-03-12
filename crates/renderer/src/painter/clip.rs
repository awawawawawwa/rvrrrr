/// An axis-aligned clip rectangle in absolute terminal coordinates.
#[derive(Debug, Clone, Copy)]
pub struct ClipRect {
    pub x: u16,
    pub y: u16,
    pub width: u16,
    pub height: u16,
}

impl ClipRect {
    pub fn new(x: u16, y: u16, width: u16, height: u16) -> Self {
        Self { x, y, width, height }
    }

    /// Create from full terminal dimensions (no clipping).
    pub fn full(width: u16, height: u16) -> Self {
        Self { x: 0, y: 0, width, height }
    }

    /// Returns the intersection of two clip rects, or `None` if they don't overlap.
    pub fn intersect(&self, other: &ClipRect) -> Option<ClipRect> {
        let x1 = self.x.max(other.x);
        let y1 = self.y.max(other.y);
        let x2 = (self.x + self.width).min(other.x + other.width);
        let y2 = (self.y + self.height).min(other.y + other.height);
        if x1 < x2 && y1 < y2 {
            Some(ClipRect { x: x1, y: y1, width: x2 - x1, height: y2 - y1 })
        } else {
            None
        }
    }

    /// Check if a point is inside this clip rect.
    pub fn contains(&self, x: u16, y: u16) -> bool {
        x >= self.x && x < self.x + self.width && y >= self.y && y < self.y + self.height
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn full_contains_all() {
        let clip = ClipRect::full(80, 24);
        assert!(clip.contains(0, 0));
        assert!(clip.contains(79, 23));
        assert!(!clip.contains(80, 0));
        assert!(!clip.contains(0, 24));
    }

    #[test]
    fn intersection_overlapping() {
        let a = ClipRect::new(0, 0, 10, 10);
        let b = ClipRect::new(5, 5, 10, 10);
        let c = a.intersect(&b).unwrap();
        assert_eq!(c.x, 5);
        assert_eq!(c.y, 5);
        assert_eq!(c.width, 5);
        assert_eq!(c.height, 5);
    }

    #[test]
    fn intersection_non_overlapping() {
        let a = ClipRect::new(0, 0, 5, 5);
        let b = ClipRect::new(10, 10, 5, 5);
        assert!(a.intersect(&b).is_none());
    }

    #[test]
    fn intersection_adjacent_is_none() {
        let a = ClipRect::new(0, 0, 5, 5);
        let b = ClipRect::new(5, 0, 5, 5);
        assert!(a.intersect(&b).is_none());
    }

    #[test]
    fn intersection_contained() {
        let outer = ClipRect::new(0, 0, 20, 20);
        let inner = ClipRect::new(5, 5, 5, 5);
        let c = outer.intersect(&inner).unwrap();
        assert_eq!(c.x, 5);
        assert_eq!(c.y, 5);
        assert_eq!(c.width, 5);
        assert_eq!(c.height, 5);
    }

    #[test]
    fn contains_boundary() {
        let clip = ClipRect::new(10, 10, 5, 5);
        assert!(clip.contains(10, 10));
        assert!(clip.contains(14, 14));
        assert!(!clip.contains(15, 10));
        assert!(!clip.contains(10, 15));
        assert!(!clip.contains(9, 10));
    }
}
