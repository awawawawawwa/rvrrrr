use crate::buffer::{Buffer, Cell};

/// A contiguous run of changed cells on the same row.
pub struct CellRun {
    pub x: u16,
    pub y: u16,
    pub cells: Vec<Cell>,
}

/// Compare two buffers and return runs of changed cells, batched by row.
/// Consecutive changed cells on the same row are grouped into a single `CellRun`
/// to minimize cursor-move commands. Small gaps (up to 3 unchanged cells) are
/// bridged to avoid emitting cursor-move sequences that cost more bytes than
/// just rewriting the unchanged cells.
pub fn compute_diff(prev: &Buffer, curr: &Buffer) -> Vec<CellRun> {
    debug_assert_eq!(prev.width, curr.width);
    debug_assert_eq!(prev.height, curr.height);

    let mut runs = Vec::new();

    for y in 0..curr.height {
        let mut x = 0u16;
        while x < curr.width {
            if curr.cell(x, y) == prev.cell(x, y) {
                x += 1;
                continue;
            }

            let run_start = x;
            let mut cells = Vec::new();

            while x < curr.width {
                let curr_cell = curr.cell(x, y);
                let prev_cell = prev.cell(x, y);
                if curr_cell == prev_cell {
                    let gap_end = (x + 4).min(curr.width);
                    let has_more_changes = (x + 1..gap_end)
                        .any(|gx| curr.cell(gx, y) != prev.cell(gx, y));
                    if has_more_changes {
                        cells.push(curr_cell.unwrap().clone());
                        x += 1;
                        continue;
                    }
                    break;
                }
                cells.push(curr_cell.unwrap().clone());
                x += 1;
            }

            if !cells.is_empty() {
                runs.push(CellRun {
                    x: run_start,
                    y,
                    cells,
                });
            }
        }
    }

    runs
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn identical_buffers_produce_no_diff() {
        let a = Buffer::new(10, 5);
        let b = Buffer::new(10, 5);
        let diff = compute_diff(&a, &b);
        assert!(diff.is_empty());
    }

    #[test]
    fn single_cell_change_detected() {
        let a = Buffer::new(10, 5);
        let mut b = Buffer::new(10, 5);
        b.cell_mut(3, 2).unwrap().grapheme = "X".to_string();
        let diff = compute_diff(&a, &b);
        assert_eq!(diff.len(), 1);
        assert_eq!(diff[0].x, 3);
        assert_eq!(diff[0].y, 2);
        assert_eq!(diff[0].cells.len(), 1);
        assert_eq!(diff[0].cells[0].grapheme, "X");
    }

    #[test]
    fn consecutive_changes_grouped() {
        let a = Buffer::new(10, 5);
        let mut b = Buffer::new(10, 5);
        b.cell_mut(2, 0).unwrap().grapheme = "A".to_string();
        b.cell_mut(3, 0).unwrap().grapheme = "B".to_string();
        b.cell_mut(4, 0).unwrap().grapheme = "C".to_string();
        let diff = compute_diff(&a, &b);
        assert_eq!(diff.len(), 1);
        assert_eq!(diff[0].x, 2);
        assert_eq!(diff[0].cells.len(), 3);
    }

    #[test]
    fn separate_runs_on_same_row() {
        let a = Buffer::new(20, 5);
        let mut b = Buffer::new(20, 5);
        b.cell_mut(0, 0).unwrap().grapheme = "A".to_string();
        b.cell_mut(15, 0).unwrap().grapheme = "B".to_string();
        let diff = compute_diff(&a, &b);
        assert_eq!(diff.len(), 2);
    }

    #[test]
    fn small_gap_bridged() {
        let a = Buffer::new(10, 5);
        let mut b = Buffer::new(10, 5);
        b.cell_mut(0, 0).unwrap().grapheme = "A".to_string();
        // gap of 2 unchanged cells
        b.cell_mut(3, 0).unwrap().grapheme = "B".to_string();
        let diff = compute_diff(&a, &b);
        assert_eq!(diff.len(), 1, "small gap should be bridged into one run");
    }
}
