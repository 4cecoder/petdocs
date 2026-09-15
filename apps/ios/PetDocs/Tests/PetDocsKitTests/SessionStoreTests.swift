import XCTest
@testable import PetDocsKit

final class SessionStoreTests: XCTestCase {
    private let dee = User(id: "owner_1", email: "dee@example.com", name: "Dee")
    private let rod = User(id: "owner_2", email: "rod@example.com", name: "Rod")

    @MainActor
    func testStartsSignedOutWhenNothingStored() {
        let store = SessionStore(storage: InMemorySessionStore())
        XCTAssertNil(store.session)
        XCTAssertFalse(store.isSignedIn)
    }

    @MainActor
    func testSignInPublishesAndPersists() {
        let storage = InMemorySessionStore()
        let store = SessionStore(storage: storage)
        let session = Session(bearerToken: "sess-abc", user: dee)

        store.signIn(session)

        XCTAssertEqual(store.session, session)
        XCTAssertTrue(store.isSignedIn)
        // Round-trips through the storage boundary, not just the published value.
        XCTAssertEqual(storage.load(), session)
    }

    @MainActor
    func testRestoreFromExistingStorage() {
        let storage = InMemorySessionStore()
        let session = Session(bearerToken: "sess-xyz", user: rod)
        storage.save(session)

        let store = SessionStore(storage: storage)

        XCTAssertEqual(store.session, session, "Relaunch must restore the session")
        XCTAssertTrue(store.isSignedIn)
    }

    @MainActor
    func testSignOutClearsPublishedAndStored() {
        let storage = InMemorySessionStore()
        let store = SessionStore(storage: storage)
        store.signIn(Session(bearerToken: "sess-abc", user: dee))

        store.signOut()

        XCTAssertNil(store.session)
        XCTAssertFalse(store.isSignedIn)
        XCTAssertNil(storage.load())
    }

    @MainActor
    func testSignInOverwritesPreviousSession() {
        let store = SessionStore(storage: InMemorySessionStore())
        store.signIn(Session(bearerToken: "old", user: dee))

        store.signIn(Session(bearerToken: "new", user: rod))

        XCTAssertEqual(store.session?.bearerToken, "new")
        XCTAssertEqual(store.session?.user.id, "owner_2")
    }

    @MainActor
    func testFailedLoadBehavesAsSignedOut() {
        // The KeychainSessionStore treats an undecodable payload as
        // signed-out + evicted; from the facade's side, a store whose load
        // fails (returns nil) must simply restore to signed out, never crash.
        let failing = FailingSessionStore()
        let store = SessionStore(storage: failing)
        XCTAssertNil(store.session)
        XCTAssertFalse(store.isSignedIn)

        // Signing in after a failed load still works (self-healing).
        store.signIn(Session(bearerToken: "sess-abc", user: dee))
        XCTAssertEqual(store.session?.bearerToken, "sess-abc")
        XCTAssertTrue(failing.saveWasCalled)
    }
}

/// load() always fails (nil), save() records the call — models the
/// Keychain-after-corruption path without touching the real keychain.
private final class FailingSessionStore: SessionStoring, @unchecked Sendable {
    private let lock = NSLock()
    private var _saveWasCalled = false

    var saveWasCalled: Bool { lock.withLock { _saveWasCalled } }

    func load() -> Session? {
        nil
    }

    func save(_: Session) {
        lock.withLock { _saveWasCalled = true }
    }

    func clear() {}
}
