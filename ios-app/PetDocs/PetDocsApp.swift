import SwiftUI

@main
struct PetDocsApp: App {
    @StateObject private var session = SessionStore()
    @StateObject private var viewModel = AppViewModel()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(session)
                .environmentObject(viewModel)
        }
    }
}
