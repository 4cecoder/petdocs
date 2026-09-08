import SwiftUI

// Root tabs: Home, Pets, Docs, More.
// More opens a sheet with Reminders, Share, Scanner, Notifications,
// Admin, Settings, plus Login when signed out.
// Api is built from the session URL with a safe fallback.

struct MoreRouteIdent: Identifiable {
    let id = UUID()
    var value: String
}

struct ContentView: View {
    @EnvironmentObject var vm: AppViewModel
    @EnvironmentObject var session: SessionStore
    @State private var tab = 0
    @State private var showMore = false
    @State private var moreRoute: MoreRouteIdent? = nil
    @State private var showLogin = false

    private var api: ConvexAPI {
        ConvexAPI(convexUrl: session.convexUrl ?? "https://YOUR-DEPLOYMENT.convex.cloud")
    }

    private var isSignedIn: Bool {
        !(session.ownerId ?? "").isEmpty
    }

    var body: some View {
        TabView(selection: $tab) {
            NavigationStack {
                HomeView(api: api, ownerId: session.ownerId)
            }
            .tabItem { Label("Home", systemImage: "house") }
            .tag(0)

            NavigationStack {
                PetsView(api: api, ownerId: session.ownerId)
            }
            .tabItem { Label("Pets", systemImage: "pawprint") }
            .tag(1)

            NavigationStack {
                DocsView(api: api, ownerId: session.ownerId)
            }
            .tabItem { Label("Docs", systemImage: "doc.text") }
            .tag(2)

            NavigationStack {
                MoreList(
                    isSignedIn: isSignedIn,
                    onPick: { route in
                        if route == "login" {
                            showLogin = true
                        } else {
                            moreRoute = MoreRouteIdent(value: route)
                        }
                    },
                    onOpenMore: { showMore = true }
                )
            }
            .tabItem { Label("More", systemImage: "ellipsis.circle") }
            .tag(3)
        }
        .tint(Color.brandTeal)
        .sheet(isPresented: $showMore) {
            NavigationStack {
                MoreList(
                    isSignedIn: isSignedIn,
                    onPick: { route in
                        showMore = false
                        if route == "login" {
                            showLogin = true
                        } else {
                            moreRoute = MoreRouteIdent(value: route)
                        }
                    },
                    onOpenMore: {}
                )
                .navigationTitle("More")
                .navigationBarTitleDisplayMode(.inline)
            }
            .presentationDetents([.medium, .large])
        }
        .sheet(item: $moreRoute) { route in
            NavigationStack {
                MoreDestination(route: route.value, api: api, ownerId: session.ownerId, ownerEmail: session.ownerEmail)
            }
        }
        .sheet(isPresented: $showLogin) {
            NavigationStack {
                LoginView(onSignedIn: { email in
                    session.ownerEmail = email
                    showLogin = false
                    tab = 0
                })
                .navigationTitle("Sign in")
                .navigationBarTitleDisplayMode(.inline)
            }
        }
}

private struct MoreList: View {
    var isSignedIn: Bool
    var onPick: (String) -> Void
    var onOpenMore: () -> Void

    let rows: [(String, String, String)] = [
        ("reminders", "Reminders", "Due dates and care alerts"),
        ("share", "Share", "Shareable passport links"),
        ("scanner", "Scanner", "Scan docs with the camera"),
        ("notifications", "Notifications", "Care alerts and due soon inbox"),
        ("onboarding", "Get started", "Add your first pet in 3 minutes"),
        ("admin", "Admin", "View only staff hub"),
        ("settings", "Settings", "Account and sign out"),
    ]

    var body: some View {
        List {
            ForEach(rows, id: \.0) { r in
                Button {
                    onPick(r.0)
                } label: {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(r.1).font(.headline).foregroundStyle(.primary)
                        Text(r.2).font(.caption).foregroundStyle(.secondary)
                    }
                }
                .frame(minHeight: 44)
            }
            if !isSignedIn {
                Button {
                    onPick("login")
                } label: {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Log in").font(.headline).foregroundStyle(Color.brandTeal)
                        Text("Magic link, no password").font(.caption).foregroundStyle(.secondary)
                    }
                }
                .frame(minHeight: 44)
            }
        }
    }
}

private struct MoreDestination: View {
    var route: String
    var api: ConvexAPI?
    var ownerId: String?
    var ownerEmail: String?

    var body: some View {
        switch route {
        case "reminders":
            RemindersView(api: api, ownerId: ownerId)
                .navigationTitle("Reminders").navigationBarTitleDisplayMode(.inline)
        case "share":
            ShareView(api: api, ownerId: ownerId)
                .navigationTitle("Share").navigationBarTitleDisplayMode(.inline)
        case "scanner":
            ScannerView(api: api, ownerId: ownerId)
                .navigationTitle("Scanner").navigationBarTitleDisplayMode(.inline)
        case "notifications":
            NotificationsView(api: api, ownerId: ownerId)
                .navigationTitle("Notifications").navigationBarTitleDisplayMode(.inline)
        case "onboarding":
            OnboardingView(api: api, ownerId: ownerId, onDone: {})
                .navigationTitle("Get started").navigationBarTitleDisplayMode(.inline)
        case "admin":
            AdminView(api: api, ownerId: ownerId, ownerEmail: ownerEmail)
                .navigationTitle("Admin").navigationBarTitleDisplayMode(.inline)
        default:
            SettingsView(onSignOut: {})
                .navigationTitle("Settings").navigationBarTitleDisplayMode(.inline)
        }
    }
}
