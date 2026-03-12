use crossterm::style::Color;

/// Parse a CSS-style color string into a crossterm Color.
/// Supports: `#rrggbb`, `#rgb`, `rgb(r,g,b)`, and named colors.
/// Returns `None` for unrecognized formats.
pub fn parse_color(s: &str) -> Option<Color> {
    let s = s.trim();

    if let Some(hex) = s.strip_prefix('#') {
        return parse_hex(hex);
    }

    if let Some(inner) = s.strip_prefix("rgb(").and_then(|s| s.strip_suffix(')')) {
        return parse_rgb_func(inner);
    }

    parse_named(s)
}

fn parse_hex(hex: &str) -> Option<Color> {
    match hex.len() {
        6 => {
            let r = u8::from_str_radix(&hex[0..2], 16).ok()?;
            let g = u8::from_str_radix(&hex[2..4], 16).ok()?;
            let b = u8::from_str_radix(&hex[4..6], 16).ok()?;
            Some(Color::Rgb { r, g, b })
        }
        3 => {
            let r = u8::from_str_radix(&hex[0..1], 16).ok()? * 17;
            let g = u8::from_str_radix(&hex[1..2], 16).ok()? * 17;
            let b = u8::from_str_radix(&hex[2..3], 16).ok()? * 17;
            Some(Color::Rgb { r, g, b })
        }
        _ => None,
    }
}

fn parse_rgb_func(inner: &str) -> Option<Color> {
    let parts: Vec<&str> = inner.split(',').collect();
    if parts.len() != 3 {
        return None;
    }
    let r: u8 = parts[0].trim().parse().ok()?;
    let g: u8 = parts[1].trim().parse().ok()?;
    let b: u8 = parts[2].trim().parse().ok()?;
    Some(Color::Rgb { r, g, b })
}

fn parse_named(name: &str) -> Option<Color> {
    match name.to_lowercase().as_str() {
        "black" => Some(Color::Black),
        "red" => Some(Color::DarkRed),
        "green" => Some(Color::DarkGreen),
        "yellow" => Some(Color::DarkYellow),
        "blue" => Some(Color::DarkBlue),
        "magenta" => Some(Color::DarkMagenta),
        "cyan" => Some(Color::DarkCyan),
        "white" => Some(Color::White),
        "gray" | "grey" => Some(Color::Grey),
        "blackbright" => Some(Color::DarkGrey),
        "redbright" => Some(Color::Red),
        "greenbright" => Some(Color::Green),
        "yellowbright" => Some(Color::Yellow),
        "bluebright" => Some(Color::Blue),
        "magentabright" => Some(Color::Magenta),
        "cyanbright" => Some(Color::Cyan),
        "whitebright" => Some(Color::White),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_hex_rrggbb() {
        assert_eq!(parse_color("#ff0000"), Some(Color::Rgb { r: 255, g: 0, b: 0 }));
        assert_eq!(parse_color("#00ff00"), Some(Color::Rgb { r: 0, g: 255, b: 0 }));
        assert_eq!(parse_color("#1a2b3c"), Some(Color::Rgb { r: 26, g: 43, b: 60 }));
    }

    #[test]
    fn parse_hex_rgb_shorthand() {
        assert_eq!(parse_color("#f00"), Some(Color::Rgb { r: 255, g: 0, b: 0 }));
        assert_eq!(parse_color("#0f0"), Some(Color::Rgb { r: 0, g: 255, b: 0 }));
        assert_eq!(parse_color("#abc"), Some(Color::Rgb { r: 170, g: 187, b: 204 }));
    }

    #[test]
    fn parse_rgb_function() {
        assert_eq!(parse_color("rgb(255,128,0)"), Some(Color::Rgb { r: 255, g: 128, b: 0 }));
        assert_eq!(parse_color("rgb( 10 , 20 , 30 )"), Some(Color::Rgb { r: 10, g: 20, b: 30 }));
    }

    #[test]
    fn parse_named_colors() {
        assert_eq!(parse_color("red"), Some(Color::DarkRed));
        assert_eq!(parse_color("green"), Some(Color::DarkGreen));
        assert_eq!(parse_color("blue"), Some(Color::DarkBlue));
        assert_eq!(parse_color("gray"), Some(Color::Grey));
        assert_eq!(parse_color("grey"), Some(Color::Grey));
        assert_eq!(parse_color("white"), Some(Color::White));
        assert_eq!(parse_color("black"), Some(Color::Black));
    }

    #[test]
    fn unknown_returns_none() {
        assert_eq!(parse_color("notacolor"), None);
        assert_eq!(parse_color("#zzzzzz"), None);
        assert_eq!(parse_color("rgb(1,2)"), None);
        assert_eq!(parse_color(""), None);
    }

    #[test]
    fn trims_whitespace() {
        assert_eq!(parse_color("  red  "), Some(Color::DarkRed));
        assert_eq!(parse_color("  #ff0000  "), Some(Color::Rgb { r: 255, g: 0, b: 0 }));
    }
}
