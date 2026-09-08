import SwiftUI

// Shared SwiftUI kit. Mirrors Android UiKit plus Theme.
// Warm cream art, numbered stepper, vaccine badge, section header.

enum PetMood: String, CaseIterable {
    case happy
    case sleepy
    case camera
    case link
    case clock
    case rocket
}

func moodEmoji(_ mood: PetMood) -> String {
    switch mood {
    case .happy: return "🐾"
    case .sleepy: return "😴"
    case .camera: return "📷"
    case .link: return "🔗"
    case .clock: return "⏰"
    case .rocket: return "🚀"
    }
}

struct PetMoodArt: View {
    var mood: PetMood
    var size: CGFloat = 72

    var body: some View {
        ZStack {
            Circle()
                .fill(Color.cream)
                .frame(width: size, height: size)
                .overlay(Circle().stroke(Color.brandTeal, lineWidth: 2))
            Text(moodEmoji(mood))
                .font(.system(size: size * 0.45))
                .accessibilityLabel("Pet mood \(mood.rawValue)")
        }
    }
}

struct StepperView: View {
    var current: Int
    var labels: [String]

    var body: some View {
        if !labels.isEmpty {
            let safe = min(max(current, 0), labels.count - 1)
            VStack(spacing: 6) {
                HStack {
                    ForEach(labels.indices, id: \.self) { i in
                        Circle()
                            .fill(i <= safe ? Color.brandTeal : Color.cream)
                            .frame(width: 28, height: 28)
                            .overlay(
                                Text("\(i + 1)")
                                    .font(.caption.bold())
                                    .foregroundStyle(i <= safe ? .white : .secondary)
                            )
                            .accessibilityLabel("Step \(i + 1) of \(labels.count): \(labels[i])")
                        if i < labels.count - 1 {
                            Rectangle()
                                .fill(i < safe ? Color.brandTeal : Color.cream)
                                .frame(height: 2)
                        }
                    }
                }
                HStack {
                    ForEach(labels.indices, id: \.self) { i in
                        Text(labels[i])
                            .font(.caption2)
                            .foregroundStyle(i == safe ? Color.brandTeal : .secondary)
                            .frame(maxWidth: .infinity)
                            .lineLimit(1)
                    }
                }
            }
        }
    }
}

struct ArtEmptyState: View {
    var mood: PetMood
    var title: String
    var bodyText: String
    var ctaLabel: String? = nil
    var onCta: (() -> Void)? = nil

    var body: some View {
        VStack(spacing: 8) {
            PetMoodArt(mood: mood, size: 88)
            Text(title)
                .font(.headline)
                .multilineTextAlignment(.center)
            Text(bodyText)
                .font(.body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            if let ctaLabel, let onCta {
                Button(ctaLabel, action: onCta)
                    .buttonStyle(.borderedProminent)
                    .tint(Color.brandTeal)
                    .frame(minHeight: 44)
                    .padding(.top, 4)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(32)
    }
}

struct VaccineBadge: View {
    var status: VaccineStatus

    private var label: String {
        switch status {
        case .administered: return "Vaccines valid"
        case .due: return "Due soon"
        case .overdue: return "Overdue"
        case .waived: return "Waived"
        }
    }

    private var dot: Color {
        switch status {
        case .administered: return .green
        case .due: return Color.brandAmber
        case .overdue: return .red
        case .waived: return .gray
        }
    }

    var body: some View {
        HStack(spacing: 6) {
            Circle().fill(dot).frame(width: 8, height: 8)
            Text(label).font(.caption.bold())
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 4)
        .background(Color.cream)
        .clipShape(Capsule())
        .accessibilityLabel(label)
    }
}

struct SectionHeader: View {
    var title: String
    var actionLabel: String? = nil
    var onAction: (() -> Void)? = nil

    var body: some View {
        HStack {
            Text(title).font(.title3.bold())
            Spacer()
            if let actionLabel, let onAction {
                Button(actionLabel, action: onAction)
                    .frame(minHeight: 44)
            }
        }
        .padding(.horizontal, 4)
    }
}

// Shared date helper for millis since epoch.
func shortDate(_ millis: Int64?) -> String {
    guard let millis, millis > 0 else { return "Due soon" }
    let d = Date(timeIntervalSince1970: TimeInterval(millis) / 1000)
    let f = DateFormatter()
    f.dateStyle = .medium
    f.timeStyle = .none
    return f.string(from: d)
}

func shortDay(_ millis: Int64) -> String {
    if millis <= 0 { return "Due soon" }
    let d = Date(timeIntervalSince1970: TimeInterval(millis) / 1000)
    let f = DateFormatter()
    f.dateFormat = "EEE, MMM d"
    return f.string(from: d)
}
