import SwiftUI

// Petdocs brand palette. Cream background, teal primary, amber accent,
// ink text. Matches Android PetdocsColors and the web design tokens.
extension Color {
    static let cream = Color(red: 1.0, green: 0.984, blue: 0.961) // FFFBF5
    static let brandTeal = Color(red: 0.051, green: 0.580, blue: 0.533) // 0D9488
    static let brandAmber = Color(red: 0.961, green: 0.620, blue: 0.043) // F59E0B
    static let ink = Color(red: 0.110, green: 0.098, blue: 0.090) // 1C1917
    static let inkSoft = Color(red: 0.471, green: 0.443, blue: 0.424) // 78716C
}

struct CardStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(16)
            .background(Color.white)
            .cornerRadius(16)
            .shadow(color: Color.ink.opacity(0.06), radius: 8, x: 0, y: 2)
    }
}

extension View {
    // Rounded 16 card used across lists, sheets, and dialogs.
    func petCard() -> some View {
        modifier(CardStyle())
    }

    // Keeps every tappable control at least 48pt, per platform guidance.
    func minTouchTarget() -> some View {
        frame(minWidth: 48, minHeight: 48)
    }
}
