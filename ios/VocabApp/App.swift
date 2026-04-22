import SwiftUI

@main
struct VocabApp: App {
    var body: some Scene {
        WindowGroup {
            WebViewContainer()
                .ignoresSafeArea(.container, edges: .all)
        }
    }
}
