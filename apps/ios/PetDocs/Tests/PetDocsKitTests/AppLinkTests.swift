import XCTest
@testable import PetDocsKit

final class AppLinkTests: XCTestCase {
    // MARK: Custom scheme — petdocs://signin?token=…

    func testParsesCustomSchemeSignIn() {
        let link = AppLink.parse(url: URL(string: "petdocs://signin?token=abc123")!)
        XCTAssertEqual(link, .signInToken("abc123"))
    }

    func testCustomSchemeIsCaseInsensitive() {
        let link = AppLink.parse(url: URL(string: "PETDOCS://SIGNIN?token=abc")!)
        XCTAssertEqual(link, .signInToken("abc"))
    }

    func testCustomSchemeRejectsUnknownHosts() {
        XCTAssertNil(AppLink.parse(url: URL(string: "petdocs://link?code=abc")!))
        XCTAssertNil(AppLink.parse(url: URL(string: "petdocs://")!))
    }

    // MARK: Universal links — https://…/signin?token=…

    func testParsesUniversalLinkOnProdDomain() {
        let link = AppLink.parse(url: URL(string: "https://petdocs.seridian.dev/signin?token=abc123")!)
        XCTAssertEqual(link, .signInToken("abc123"))
    }

    func testUniversalLinkIsHostAgnosticByDesign() {
        // Mirrors the portal: every host serving the AASA is OS-trusted
        // already, so parsing accepts any https host with the /signin path.
        let link = AppLink.parse(url: URL(string: "https://staging.petdocs.example/signin?token=t")!)
        XCTAssertEqual(link, .signInToken("t"))
    }

    func testUniversalLinkAcceptsTrailingSlash() {
        let link = AppLink.parse(url: URL(string: "https://petdocs.seridian.dev/signin/?token=t")!)
        XCTAssertEqual(link, .signInToken("t"))
    }

    func testUniversalLinkRejectsOtherPaths() {
        XCTAssertNil(AppLink.parse(url: URL(string: "https://petdocs.seridian.dev/p/x?token=t")!))
        XCTAssertNil(AppLink.parse(url: URL(string: "https://petdocs.seridian.dev/")!))
    }

    // MARK: Rejects garbage

    func testRejectsWrongSchemesAndPayloads() {
        XCTAssertNil(AppLink.parse(url: nil))
        XCTAssertNil(AppLink.parse(url: URL(string: "http://petdocs.seridian.dev/signin?token=t")!))
        XCTAssertNil(AppLink.parse(url: URL(string: "https://petdocs.seridian.dev/signin")!))
        XCTAssertNil(AppLink.parse(url: URL(string: "petdocs://signin")!))
        XCTAssertNil(AppLink.parse(url: URL(string: "petdocs://signin?token=")!))
        XCTAssertNil(AppLink.parse(url: URL(string: "petdocs://signin?other=t")!))
    }
}
