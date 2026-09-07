import Foundation
import ScreenCaptureKit

@available(macOS 14.0, *)
class ScreenGrabber {
    static func grab(outputPath: String) async -> Int32 {
        do {
            let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
            guard let display = content.displays.first else {
                fputs("Error: No display found\n", stderr)
                return 1
            }

            let filter = SCContentFilter(display: display, excludingApplications: [], exceptingWindows: [])
            let config = SCStreamConfiguration()
            config.width = display.width
            config.height = display.height
            config.showsCursor = true

            let image = try await SCScreenshotManager.captureImage(contentFilter: filter, configuration: config)
            
            let bitmapRep = NSBitmapImageRep(cgImage: image)
            guard let jpegData = bitmapRep.representation(using: .jpeg, properties: [.compressionFactor: 0.75]) else {
                fputs("Error: Failed to encode JPEG\n", stderr)
                return 2
            }

            try jpegData.write(to: URL(fileURLWithPath: outputPath))
            return 0
        } catch {
            fputs("Error capturing screen: \(error.localizedDescription)\n", stderr)
            return 3
        }
    }
}

let outputPath = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "/tmp/imac_remote_capture.jpg"
let exitCode = await ScreenGrabber.grab(outputPath: outputPath)
exit(exitCode)
