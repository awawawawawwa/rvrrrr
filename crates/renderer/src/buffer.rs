/// Cell-based terminal buffer for double-buffered rendering.
///
/// A [`Buffer`] is a flat `Vec<Cell>` in row-major order.  The diff
/// engine compares the current buffer against the previous one and
/// only emits crossterm commands for cells that changed.
use crossterm::style::Color;

/// A single terminal cell holding one grapheme cluster and its style.
#[derive(Debug, Clone, PartialEq)]
pub struct Cell {
    pub grapheme: String,
    pub fg: Option<Color>,
    pub bg: Option<Color>,
    pub bold: bool,
    pub italic: bool,
    pub underline: bool,
    pub strikethrough: bool,
    pub dim: bool,
    pub inverse: bool,
}

impl Default for Cell {
    fn default() -> Self {
        Self {
            grapheme: " ".to_string(),
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

impl Cell {
    /// Reset this cell to a blank space with no styling.
    pub fn reset(&mut self) {
        self.grapheme.clear();
        self.grapheme.push(' ');
        self.fg = None;
        self.bg = None;
        self.bold = false;
        self.italic = false;
        self.underline = false;
        self.strikethrough = false;
        self.dim = false;
        self.inverse = false;
    }
}

/// Row-major grid of [`Cell`]s representing the terminal screen.
pub struct Buffer {
    pub width: u16,
    pub height: u16,
    cells: Vec<Cell>,
}

impl Buffer {
    /// Create a buffer filled with default (blank) cells.
    pub fn new(width: u16, height: u16) -> Self {
        let size = (width as usize) * (height as usize);
        Self {
            width,
            height,
            cells: vec![Cell::default(); size],
        }
    }

    /// Get an immutable reference to the cell at `(x, y)`, or `None`
    /// if coordinates are out of bounds.
    pub fn cell(&self, x: u16, y: u16) -> Option<&Cell> {
        if x < self.width && y < self.height {
            Some(&self.cells[self.index(x, y)])
        } else {
            None
        }
    }

    /// Get a mutable reference to the cell at `(x, y)`, or `None` if
    /// coordinates are out of bounds.
    pub fn cell_mut(&mut self, x: u16, y: u16) -> Option<&mut Cell> {
        if x < self.width && y < self.height {
            let idx = self.index(x, y);
            Some(&mut self.cells[idx])
        } else {
            None
        }
    }

    /// Reset every cell in the buffer to the default blank state.
    pub fn clear(&mut self) {
        for cell in &mut self.cells {
            cell.reset();
        }
    }

    /// Resize the buffer and clear all cells.
    pub fn resize(&mut self, width: u16, height: u16) {
        self.width = width;
        self.height = height;
        let size = (width as usize) * (height as usize);
        self.cells.resize(size, Cell::default());
        self.clear();
    }

    /// Read-only access to the underlying cell slice.
    pub fn cells(&self) -> &[Cell] {
        &self.cells
    }

    fn index(&self, x: u16, y: u16) -> usize {
        (y as usize) * (self.width as usize) + (x as usize)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_buffer_filled_with_spaces() {
        let buf = Buffer::new(10, 5);
        assert_eq!(buf.width, 10);
        assert_eq!(buf.height, 5);
        for y in 0..5 {
            for x in 0..10 {
                let cell = buf.cell(x, y).unwrap();
                assert_eq!(cell.grapheme, " ");
                assert_eq!(cell.fg, None);
                assert_eq!(cell.bg, None);
            }
        }
    }

    #[test]
    fn cell_mut_sets_value() {
        let mut buf = Buffer::new(10, 5);
        let cell = buf.cell_mut(3, 2).unwrap();
        cell.grapheme = "X".to_string();
        cell.bold = true;
        let cell = buf.cell(3, 2).unwrap();
        assert_eq!(cell.grapheme, "X");
        assert!(cell.bold);
    }

    #[test]
    fn out_of_bounds_returns_none() {
        let buf = Buffer::new(10, 5);
        assert!(buf.cell(10, 0).is_none());
        assert!(buf.cell(0, 5).is_none());
        assert!(buf.cell(100, 100).is_none());
    }

    #[test]
    fn clear_resets_all_cells() {
        let mut buf = Buffer::new(5, 5);
        buf.cell_mut(2, 2).unwrap().grapheme = "X".to_string();
        buf.cell_mut(2, 2).unwrap().bold = true;
        buf.clear();
        let cell = buf.cell(2, 2).unwrap();
        assert_eq!(cell.grapheme, " ");
        assert!(!cell.bold);
    }

    #[test]
    fn resize_changes_dimensions() {
        let mut buf = Buffer::new(10, 5);
        buf.resize(20, 10);
        assert_eq!(buf.width, 20);
        assert_eq!(buf.height, 10);
        assert_eq!(buf.cells().len(), 200);
    }
}
