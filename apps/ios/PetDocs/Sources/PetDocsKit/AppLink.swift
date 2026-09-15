import Foundation

/// Single pure parser for EVERY inbound sign-in link — custom scheme and
/// universal links alike — so routing never forks on the transport.
/// Mirrors the portal's `AppLink` in AdventurersApp.swift.
///
/// Accepted forms:
/// - `petdocs://signin?token=…`                          → `.signInToken` (custom scheme;
///   works on personal (free) dev teams — no entitlement required)
/// - `https://petdocs.seridian.dev/signin?token=…`       → `.signInToken` (universal link;
///   requires the paid-team Associated Domains entitlement + an AASA file — M3)
///
/// Everything else (wrong scheme/host/path, missing/empty token, garbage)
/// parses to `nil`. Scheme/host match case-insensitively.
public enum AppLink: Equatable, Sendable {
    case signInToken(String)

    public static let customScheme = "petdocs"
    /// Universal-link path for sign-in (https://petdocs.seridian.dev/signin).
    public static let universalSignInPath = "/signin"

    public static func parse(url: URL?) -> AppLink? {
        guard let url,
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            return nil
        }
        let scheme = components.scheme?.lowercased()

        // Custom scheme: petdocs://signin?token=…
        if scheme == customScheme {
            guard components.host?.lowercased() == "signin" else { return nil }
            return token(from: components).map { AppLink.signInToken($0) }
        }

        // Universal link: https://<host>/signin?token=…
        // Host-agnostic on purpose (mirrors the portal): every applinks host
        // serving the AASA is trusted by the OS already. Trailing slash is
        // normalized so /signin/ matches too.
        if scheme == "https" {
            var path = components.path.lowercased()
            if path.count > 1 && path.hasSuffix("/") {
                path = String(path.dropLast())
            }
            guard path == universalSignInPath else { return nil }
            return token(from: components).map { AppLink.signInToken($0) }
        }

        return nil
    }

    private static func token(from components: URLComponents) -> String? {
        guard let token = components.queryItems?.first(where: { $0.name == "token" })?.value,
              !token.isEmpty else {
            return nil
        }
        return token
    }
}

/// Posted by the app entry (`PetDocsApp`) after a successful parse so the
/// sign-in flow — wherever the user is — can pick up verification. Carries
/// the opaque token under `userInfo["token"]`. Mirrors the portal's
/// `.magicTokenReceived` notification pattern.
extension Notification.Name {
    public static let signinTokenReceived = Notification.Name("petdocs.signinTokenReceived")
}
