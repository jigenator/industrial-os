//! Acid / Black roles, mirrored from `design-system/foundation/palette.mjs`.
//! Rust cannot import the design-system package, so `test/palette.test.mjs` compares these
//! values with it. Change the design system first, then these constants.
use ratatui::style::Color;

pub const FIELD: Color = Color::Rgb(0x00, 0x00, 0x00);
pub const SURFACE: Color = Color::Rgb(0x1c, 0x1c, 0x1c);
pub const PRIMARY: Color = Color::Rgb(0xff, 0xff, 0xff);
pub const SECONDARY: Color = Color::Rgb(0xcf, 0xcf, 0xcf);
pub const ACCENT: Color = Color::Rgb(0xc0, 0xfe, 0x04);
pub const DECORATIVE: Color = Color::Rgb(0x71, 0x71, 0x71);
pub const STRUCTURAL: Color = Color::Rgb(0x55, 0x55, 0x55);
pub const WARNING: Color = Color::Rgb(0xd7, 0x9e, 0x52);
pub const CRITICAL: Color = Color::Rgb(0xf2, 0x47, 0x23);
