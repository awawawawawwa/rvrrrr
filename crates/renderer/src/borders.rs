use crate::protocol::BoxStyleWire;

pub struct BorderChars {
    pub top_left: &'static str,
    pub top: &'static str,
    pub top_right: &'static str,
    pub right: &'static str,
    pub bottom_right: &'static str,
    pub bottom: &'static str,
    pub bottom_left: &'static str,
    pub left: &'static str,
}

pub struct BorderCharsOwned {
    pub top_left: String,
    pub top: String,
    pub top_right: String,
    pub right: String,
    pub bottom_right: String,
    pub bottom: String,
    pub bottom_left: String,
    pub left: String,
}

static SINGLE: BorderChars = BorderChars {
    top_left: "┌", top: "─", top_right: "┐",
    right: "│", bottom_right: "┘", bottom: "─",
    bottom_left: "└", left: "│",
};

static DOUBLE: BorderChars = BorderChars {
    top_left: "╔", top: "═", top_right: "╗",
    right: "║", bottom_right: "╝", bottom: "═",
    bottom_left: "╚", left: "║",
};

static ROUND: BorderChars = BorderChars {
    top_left: "╭", top: "─", top_right: "╮",
    right: "│", bottom_right: "╯", bottom: "─",
    bottom_left: "╰", left: "│",
};

static BOLD: BorderChars = BorderChars {
    top_left: "┏", top: "━", top_right: "┓",
    right: "┃", bottom_right: "┛", bottom: "━",
    bottom_left: "┗", left: "┃",
};

static SINGLE_DOUBLE: BorderChars = BorderChars {
    top_left: "╓", top: "─", top_right: "╖",
    right: "║", bottom_right: "╜", bottom: "─",
    bottom_left: "╙", left: "║",
};

static CLASSIC: BorderChars = BorderChars {
    top_left: "+", top: "-", top_right: "+",
    right: "|", bottom_right: "+", bottom: "-",
    bottom_left: "+", left: "|",
};

pub fn preset_border(name: &str) -> Option<&'static BorderChars> {
    match name {
        "single" => Some(&SINGLE),
        "double" => Some(&DOUBLE),
        "round" => Some(&ROUND),
        "bold" => Some(&BOLD),
        "singleDouble" => Some(&SINGLE_DOUBLE),
        "classic" => Some(&CLASSIC),
        _ => None,
    }
}

impl From<&BoxStyleWire> for BorderCharsOwned {
    fn from(wire: &BoxStyleWire) -> Self {
        BorderCharsOwned {
            top_left: wire.top_left.clone(),
            top: wire.top.clone(),
            top_right: wire.top_right.clone(),
            right: wire.right.clone(),
            bottom_right: wire.bottom_right.clone(),
            bottom: wire.bottom.clone(),
            bottom_left: wire.bottom_left.clone(),
            left: wire.left.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn all_presets_resolve() {
        assert!(preset_border("single").is_some());
        assert!(preset_border("double").is_some());
        assert!(preset_border("round").is_some());
        assert!(preset_border("bold").is_some());
        assert!(preset_border("singleDouble").is_some());
        assert!(preset_border("classic").is_some());
    }

    #[test]
    fn unknown_preset_returns_none() {
        assert!(preset_border("unknown").is_none());
        assert!(preset_border("").is_none());
    }

    #[test]
    fn single_border_chars() {
        let b = preset_border("single").unwrap();
        assert_eq!(b.top_left, "┌");
        assert_eq!(b.top, "─");
        assert_eq!(b.top_right, "┐");
        assert_eq!(b.right, "│");
        assert_eq!(b.bottom_right, "┘");
        assert_eq!(b.bottom, "─");
        assert_eq!(b.bottom_left, "└");
        assert_eq!(b.left, "│");
    }

    #[test]
    fn custom_from_box_style_wire() {
        let wire = BoxStyleWire {
            top_left: "A".into(),
            top: "B".into(),
            top_right: "C".into(),
            right: "D".into(),
            bottom_right: "E".into(),
            bottom: "F".into(),
            bottom_left: "G".into(),
            left: "H".into(),
        };
        let owned = BorderCharsOwned::from(&wire);
        assert_eq!(owned.top_left, "A");
        assert_eq!(owned.right, "D");
        assert_eq!(owned.left, "H");
    }
}
