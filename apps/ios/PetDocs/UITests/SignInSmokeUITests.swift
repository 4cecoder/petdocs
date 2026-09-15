import XCTest

/// Smoke UI test for the M1 scaffold: the app launches signed out (the
/// `-e2eResetSession` launch argument clears the Keychain session — see
/// PetDocsApp.init) and reaches the sign-in screen. Real end-to-end sign-in
/// UI tests follow in M1 once the auth contract is live; they will mirror
/// the portal's LoginUITests (identifiers below are already the contract).
final class SignInSmokeUITests: XCTestCase {
    private var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments.append("-e2eResetSession")
        app.launch()
    }

    func testLaunchesToSignInScreen() {
        XCTAssertTrue(
            app.textFields["signin.emailField"].waitForExistence(timeout: 10),
            "email field must be visible on a fresh install"
        )
        XCTAssertTrue(app.buttons["signin.sendButton"].exists, "send button must exist")
    }

    func testSendDisabledWithoutEmail() {
        let sendButton = app.buttons["signin.sendButton"]
        XCTAssertTrue(sendButton.waitForExistence(timeout: 10))
        XCTAssertFalse(
            sendButton.isEnabled,
            "send button must be disabled while the email field is empty"
        )
    }
}
