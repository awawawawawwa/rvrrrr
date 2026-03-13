/// Input event types and crossterm → InputEvent mapping.
///
/// `InputEvent` matches the Ink-style key event shape expected by `useInput`
/// on the TypeScript side. All booleans default to false; only the relevant
/// flag is set to true.
use crossterm::event::{Event, KeyCode, KeyEvent, KeyEventKind, KeyModifiers};
use serde::Serialize;

/// Key modifier / special-key info accompanying an `InputEvent`.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyInfo {
    pub up_arrow: bool,
    pub down_arrow: bool,
    pub left_arrow: bool,
    pub right_arrow: bool,
    /// Serialized as `"return"` in JSON (Rust keyword workaround).
    #[serde(rename = "return")]
    pub return_key: bool,
    pub escape: bool,
    pub ctrl: bool,
    pub shift: bool,
    pub tab: bool,
    pub backspace: bool,
    pub delete: bool,
    pub meta: bool,
}

impl Default for KeyInfo {
    fn default() -> Self {
        Self {
            up_arrow: false,
            down_arrow: false,
            left_arrow: false,
            right_arrow: false,
            return_key: false,
            escape: false,
            ctrl: false,
            shift: false,
            tab: false,
            backspace: false,
            delete: false,
            meta: false,
        }
    }
}

/// A key press event in Ink-compatible shape.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InputEvent {
    /// The character typed (empty string for special/modifier-only keys).
    pub input: String,
    pub key: KeyInfo,
}

/// Convert a crossterm `Event` to an `InputEvent`, returning `None` for
/// non-key-press events (mouse, resize, focus, paste, key release/repeat).
pub fn map_crossterm_event(event: Event) -> Option<InputEvent> {
    let Event::Key(KeyEvent {
        code,
        modifiers,
        kind,
        ..
    }) = event
    else {
        return None;
    };

    // Only process key presses, not releases or repeats.
    if kind != KeyEventKind::Press {
        return None;
    }

    let ctrl = modifiers.contains(KeyModifiers::CONTROL);
    let shift = modifiers.contains(KeyModifiers::SHIFT);
    let meta = modifiers.contains(KeyModifiers::ALT);

    let mut key = KeyInfo {
        ctrl,
        shift,
        meta,
        ..Default::default()
    };

    let input = match code {
        KeyCode::Char(c) => {
            c.to_string()
        }
        KeyCode::Up => {
            key.up_arrow = true;
            String::new()
        }
        KeyCode::Down => {
            key.down_arrow = true;
            String::new()
        }
        KeyCode::Left => {
            key.left_arrow = true;
            String::new()
        }
        KeyCode::Right => {
            key.right_arrow = true;
            String::new()
        }
        KeyCode::Enter => {
            key.return_key = true;
            String::new()
        }
        KeyCode::Esc => {
            key.escape = true;
            String::new()
        }
        KeyCode::Tab => {
            key.tab = true;
            String::new()
        }
        KeyCode::BackTab => {
            key.tab = true;
            key.shift = true;
            String::new()
        }
        KeyCode::Backspace => {
            key.backspace = true;
            String::new()
        }
        KeyCode::Delete => {
            key.delete = true;
            String::new()
        }
        // Ignore all other key codes (function keys, home, end, page up/down, etc.)
        _ => return None,
    };

    Some(InputEvent { input, key })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crossterm::event::{KeyEvent, KeyEventState};

    fn make_key_event(code: KeyCode, modifiers: KeyModifiers) -> Event {
        Event::Key(KeyEvent {
            code,
            modifiers,
            kind: KeyEventKind::Press,
            state: KeyEventState::empty(),
        })
    }

    #[test]
    fn map_char_a() {
        let ev = make_key_event(KeyCode::Char('a'), KeyModifiers::empty());
        let result = map_crossterm_event(ev).unwrap();
        assert_eq!(result.input, "a");
        assert!(!result.key.ctrl);
        assert!(!result.key.shift);
        assert!(!result.key.meta);
    }

    #[test]
    fn map_ctrl_c() {
        let ev = make_key_event(KeyCode::Char('c'), KeyModifiers::CONTROL);
        let result = map_crossterm_event(ev).unwrap();
        assert_eq!(result.input, "c");
        assert!(result.key.ctrl);
        assert!(!result.key.shift);
    }

    #[test]
    fn map_up_arrow() {
        let ev = make_key_event(KeyCode::Up, KeyModifiers::empty());
        let result = map_crossterm_event(ev).unwrap();
        assert_eq!(result.input, "");
        assert!(result.key.up_arrow);
        assert!(!result.key.down_arrow);
    }

    #[test]
    fn map_down_arrow() {
        let ev = make_key_event(KeyCode::Down, KeyModifiers::empty());
        let result = map_crossterm_event(ev).unwrap();
        assert!(result.key.down_arrow);
        assert!(!result.key.up_arrow);
    }

    #[test]
    fn map_left_arrow() {
        let ev = make_key_event(KeyCode::Left, KeyModifiers::empty());
        let result = map_crossterm_event(ev).unwrap();
        assert!(result.key.left_arrow);
    }

    #[test]
    fn map_right_arrow() {
        let ev = make_key_event(KeyCode::Right, KeyModifiers::empty());
        let result = map_crossterm_event(ev).unwrap();
        assert!(result.key.right_arrow);
    }

    #[test]
    fn map_enter() {
        let ev = make_key_event(KeyCode::Enter, KeyModifiers::empty());
        let result = map_crossterm_event(ev).unwrap();
        assert!(result.key.return_key);
        assert_eq!(result.input, "");
    }

    #[test]
    fn map_escape() {
        let ev = make_key_event(KeyCode::Esc, KeyModifiers::empty());
        let result = map_crossterm_event(ev).unwrap();
        assert!(result.key.escape);
    }

    #[test]
    fn map_tab() {
        let ev = make_key_event(KeyCode::Tab, KeyModifiers::empty());
        let result = map_crossterm_event(ev).unwrap();
        assert!(result.key.tab);
        assert!(!result.key.shift);
    }

    #[test]
    fn map_back_tab() {
        let ev = make_key_event(KeyCode::BackTab, KeyModifiers::SHIFT);
        let result = map_crossterm_event(ev).unwrap();
        assert!(result.key.tab);
        assert!(result.key.shift);
    }

    #[test]
    fn map_backspace() {
        let ev = make_key_event(KeyCode::Backspace, KeyModifiers::empty());
        let result = map_crossterm_event(ev).unwrap();
        assert!(result.key.backspace);
    }

    #[test]
    fn map_delete() {
        let ev = make_key_event(KeyCode::Delete, KeyModifiers::empty());
        let result = map_crossterm_event(ev).unwrap();
        assert!(result.key.delete);
    }

    #[test]
    fn non_key_event_returns_none() {
        let ev = Event::Resize(80, 24);
        assert!(map_crossterm_event(ev).is_none());
    }

    #[test]
    fn key_release_returns_none() {
        let ev = Event::Key(KeyEvent {
            code: KeyCode::Char('a'),
            modifiers: KeyModifiers::empty(),
            kind: KeyEventKind::Release,
            state: KeyEventState::empty(),
        });
        assert!(map_crossterm_event(ev).is_none());
    }

    #[test]
    fn serialize_input_event_return_key() {
        let ev = make_key_event(KeyCode::Enter, KeyModifiers::empty());
        let result = map_crossterm_event(ev).unwrap();
        let json = serde_json::to_string(&result).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["key"]["return"], true);
        assert_eq!(parsed["input"], "");
    }

    #[test]
    fn serialize_input_event_ctrl_c() {
        let ev = make_key_event(KeyCode::Char('c'), KeyModifiers::CONTROL);
        let result = map_crossterm_event(ev).unwrap();
        let json = serde_json::to_string(&result).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["input"], "c");
        assert_eq!(parsed["key"]["ctrl"], true);
    }
}
