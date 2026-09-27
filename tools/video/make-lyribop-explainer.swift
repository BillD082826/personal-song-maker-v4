import Foundation
import AppKit
import AVFoundation
import CoreVideo
import CoreGraphics

let width = 1080
let height = 1920
let fps: Int32 = 30
let duration = 24.0
let totalFrames = Int(duration * Double(fps))

let adPath = "/Users/billdonofrio/Desktop/LyriBop Ads/LyriBop_Ad_01_Story.png"
let formPath = "/Users/billdonofrio/Desktop/LyriBop Ads/Videos/Source Files/LyriBop_Order_Form.png"
let narrationPath = "/Users/billdonofrio/Desktop/LyriBop Ads/Videos/Source Files/LyriBop_Explainer_Narration.aiff"
let outputDir = "/Users/billdonofrio/Desktop/LyriBop Ads/Videos"
let silentPath = outputDir + "/LyriBop_Explainer_silent.mp4"
let finalPath = outputDir + "/LyriBop_Explainer_TEST.mp4"

func fail(_ message: String) -> Never {
    fputs("ERROR: \(message)\n", stderr)
    exit(1)
}

func loadCGImage(_ path: String) -> CGImage {
    guard let image = NSImage(contentsOfFile: path),
          let cg = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
        fail("Could not load image: \(path)")
    }
    return cg
}

func centeredText(_ text: String, y: CGFloat, size: CGFloat, weight: NSFont.Weight = .bold, alpha: CGFloat = 1.0) {
    let style = NSMutableParagraphStyle()
    style.alignment = .center
    let attrs: [NSAttributedString.Key: Any] = [
        .font: NSFont.systemFont(ofSize: size, weight: weight),
        .foregroundColor: NSColor.white.withAlphaComponent(alpha),
        .paragraphStyle: style
    ]
    NSString(string: text).draw(
        in: NSRect(x: 55, y: y, width: CGFloat(width - 110), height: size * 1.7),
        withAttributes: attrs
    )
}

func roundedPanel(_ rect: CGRect, alpha: CGFloat = 0.94) {
    NSColor(calibratedWhite: 0.10, alpha: alpha).setFill()
    NSBezierPath(roundedRect: rect, xRadius: 28, yRadius: 28).fill()
}

func ease(_ x: Double) -> CGFloat {
    let v = max(0.0, min(1.0, x))
    return CGFloat(v * v * (3.0 - 2.0 * v))
}

func fadeFor(_ time: Double, start: Double, end: Double, edge: Double = 0.45) -> CGFloat {
    if time < start || time > end { return 0 }
    if time < start + edge { return ease((time - start) / edge) }
    if time > end - edge { return ease((end - time) / edge) }
    return 1
}

let adImage = loadCGImage(adPath)
let formImage = loadCGImage(formPath)

try? FileManager.default.removeItem(atPath: silentPath)
try? FileManager.default.removeItem(atPath: finalPath)

guard let writer = try? AVAssetWriter(outputURL: URL(fileURLWithPath: silentPath), fileType: .mp4) else {
    fail("Could not create video writer.")
}

let settings: [String: Any] = [
    AVVideoCodecKey: AVVideoCodecType.h264,
    AVVideoWidthKey: width,
    AVVideoHeightKey: height,
    AVVideoCompressionPropertiesKey: [
        AVVideoAverageBitRateKey: 8_000_000,
        AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel
    ]
]

let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
input.expectsMediaDataInRealTime = false

let attrs: [String: Any] = [
    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB,
    kCVPixelBufferWidthKey as String: width,
    kCVPixelBufferHeightKey as String: height
]

let adaptor = AVAssetWriterInputPixelBufferAdaptor(
    assetWriterInput: input,
    sourcePixelBufferAttributes: attrs
)

guard writer.canAdd(input) else { fail("Could not add video input.") }
writer.add(input)

guard writer.startWriting() else {
    fail(writer.error?.localizedDescription ?? "Could not start video writer.")
}
writer.startSession(atSourceTime: .zero)

func makeFrame(frame: Int) -> CVPixelBuffer? {
    var buffer: CVPixelBuffer?
    CVPixelBufferCreate(
        kCFAllocatorDefault,
        width,
        height,
        kCVPixelFormatType_32ARGB,
        attrs as CFDictionary,
        &buffer
    )
    guard let pixelBuffer = buffer else { return nil }

    CVPixelBufferLockBaseAddress(pixelBuffer, [])
    defer { CVPixelBufferUnlockBaseAddress(pixelBuffer, []) }

    guard let base = CVPixelBufferGetBaseAddress(pixelBuffer),
          let context = CGContext(
            data: base,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: CVPixelBufferGetBytesPerRow(pixelBuffer),
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue
          ) else { return nil }

    let nsContext = NSGraphicsContext(cgContext: context, flipped: false)
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = nsContext

    NSColor.black.setFill()
    NSRect(x: 0, y: 0, width: width, height: height).fill()

    let t = Double(frame) / Double(fps)

    // Scene 1: Opening artwork — 0 to 4.5 sec
    if t < 4.5 {
        let a = fadeFor(t, start: 0, end: 4.5)
        let motion = CGFloat(sin(min(1.0, t / 4.5) * .pi))
        let size = CGFloat(1000) * (1.0 + 0.045 * motion)
        let x = (CGFloat(width) - size) / 2
        let y: CGFloat = 440 - (size - 1000) / 2

        context.saveGState()
        context.setAlpha(a)
        context.draw(adImage, in: CGRect(x: x, y: y, width: size, height: size))
        context.restoreGState()

        centeredText("TURN YOUR STORY INTO A SONG", y: 1540, size: 57, alpha: a)
        centeredText("LyriBop™", y: 1450, size: 48, weight: .semibold, alpha: a)
    }

    // Scene 2: Real order form — 3.8 to 12.2 sec
    if t >= 3.8 && t < 12.2 {
        let a = fadeFor(t, start: 3.8, end: 12.2)
        let local = max(0, min(1, (t - 3.8) / 8.4))
        let zoom = CGFloat(1.00 + 0.15 * local)
        let formW = CGFloat(900) * zoom
        let formH = formW * CGFloat(formImage.height) / CGFloat(formImage.width)
        let formX = (CGFloat(width) - formW) / 2
        let formY: CGFloat = 470 - CGFloat(local * 150)

        context.saveGState()
        context.setAlpha(a)
        context.draw(formImage, in: CGRect(x: formX, y: formY, width: formW, height: formH))
        context.restoreGState()

        roundedPanel(CGRect(x: 80, y: 1510, width: 920, height: 235), alpha: 0.88 * a)
        centeredText("1. Who is the song for?", y: 1660, size: 43, alpha: a)
        centeredText("2. Pick the occasion & music style", y: 1590, size: 39, weight: .semibold, alpha: a)
        centeredText("3. Tell us your story", y: 1525, size: 43, alpha: a)
    }

    // Scene 3: Story becomes preview — 11.4 to 17.3 sec
    if t >= 11.4 && t < 17.3 {
        let a = fadeFor(t, start: 11.4, end: 17.3)
        let pulse = CGFloat(1.0 + 0.035 * sin((t - 11.4) * 3.2))
        let panelW = CGFloat(900) * pulse
        let panelX = (CGFloat(width) - panelW) / 2

        roundedPanel(CGRect(x: panelX, y: 610, width: panelW, height: 690), alpha: 0.94 * a)
        centeredText("🎧", y: 1130, size: 110, alpha: a)
        centeredText("HEAR YOUR SONG", y: 1020, size: 65, alpha: a)
        centeredText("BEFORE YOU BUY", y: 930, size: 65, alpha: a)
        centeredText("FREE 30-SECOND PREVIEW", y: 795, size: 50, alpha: a)
        centeredText("No payment required", y: 710, size: 36, weight: .medium, alpha: a)
    }

    // Scene 4: Price / included lyrics — 16.5 to 21.1 sec
    if t >= 16.5 && t < 21.1 {
        let a = fadeFor(t, start: 16.5, end: 21.1)
        let local = (t - 16.5) / 4.6
        let scale = CGFloat(0.94 + 0.06 * ease(min(1, local * 2)))
        let w = CGFloat(900) * scale
        let x = (CGFloat(width) - w) / 2

        roundedPanel(CGRect(x: x, y: 590, width: w, height: 740), alpha: 0.96 * a)
        centeredText("LOVE YOUR PREVIEW?", y: 1160, size: 54, alpha: a)
        centeredText("ONLY $10.00", y: 1010, size: 92, alpha: a)
        centeredText("Complete Personalized Song", y: 885, size: 43, weight: .semibold, alpha: a)
        centeredText("+", y: 815, size: 48, alpha: a)
        centeredText("Printable Lyrics Included", y: 735, size: 43, weight: .semibold, alpha: a)
    }

    // Scene 5: Closing — 20.4 to 24 sec
    if t >= 20.4 {
        let a = fadeFor(t, start: 20.4, end: 24.0, edge: 0.5)
        let motion = CGFloat(1.0 + 0.025 * sin((t - 20.4) * 1.8))
        let size = CGFloat(720) * motion
        let x = (CGFloat(width) - size) / 2
        let y: CGFloat = 760 - (size - 720) / 2

        context.saveGState()
        context.setAlpha(a * 0.65)
        context.draw(adImage, in: CGRect(x: x, y: y, width: size, height: size))
        context.restoreGState()

        centeredText("YOUR STORY.", y: 1570, size: 78, alpha: a)
        centeredText("YOUR SONG.", y: 1470, size: 78, alpha: a)
        centeredText("LyriBop™", y: 1345, size: 66, alpha: a)
        centeredText("Start Your Free Preview", y: 570, size: 48, weight: .semibold, alpha: a)
    }

    NSGraphicsContext.restoreGraphicsState()
    return pixelBuffer
}

print("Creating 24-second LyriBop explainer video...")

var frame = 0
while frame < totalFrames {
    if input.isReadyForMoreMediaData {
        guard let pixelBuffer = makeFrame(frame: frame) else {
            fail("Could not create frame \(frame).")
        }
        let time = CMTime(value: CMTimeValue(frame), timescale: fps)
        if !adaptor.append(pixelBuffer, withPresentationTime: time) {
            fail(writer.error?.localizedDescription ?? "Could not append frame.")
        }
        frame += 1

        if frame % 180 == 0 {
            print("Video progress: \(frame / Int(fps)) seconds")
        }
    } else {
        Thread.sleep(forTimeInterval: 0.01)
    }
}

input.markAsFinished()
writer.endSession(atSourceTime: CMTime(seconds: duration, preferredTimescale: 600))

let finishGroup = DispatchGroup()
finishGroup.enter()
writer.finishWriting {
    finishGroup.leave()
}
finishGroup.wait()

guard writer.status == .completed else {
    fail(writer.error?.localizedDescription ?? "Silent video export failed.")
}

print("Video scenes complete.")
print("Adding Samantha narration...")

let videoAsset = AVURLAsset(url: URL(fileURLWithPath: silentPath))
let narrationAsset = AVURLAsset(url: URL(fileURLWithPath: narrationPath))
let composition = AVMutableComposition()

guard let sourceVideo = videoAsset.tracks(withMediaType: .video).first,
      let videoTrack = composition.addMutableTrack(
        withMediaType: .video,
        preferredTrackID: kCMPersistentTrackID_Invalid
      ) else {
    fail("Could not prepare video track.")
}

do {
    try videoTrack.insertTimeRange(
        CMTimeRange(start: .zero, duration: CMTime(seconds: duration, preferredTimescale: 600)),
        of: sourceVideo,
        at: .zero
    )
} catch {
    fail("Could not add video: \(error.localizedDescription)")
}

if let sourceAudio = narrationAsset.tracks(withMediaType: .audio).first,
   let audioTrack = composition.addMutableTrack(
       withMediaType: .audio,
       preferredTrackID: kCMPersistentTrackID_Invalid
   ) {
    do {
        let audioDuration = min(narrationAsset.duration.seconds, duration)
        try audioTrack.insertTimeRange(
            CMTimeRange(start: .zero, duration: CMTime(seconds: audioDuration, preferredTimescale: 600)),
            of: sourceAudio,
            at: CMTime(seconds: 0.35, preferredTimescale: 600)
        )
    } catch {
        fail("Could not add narration: \(error.localizedDescription)")
    }
} else {
    fail("Could not find narration audio.")
}

guard let exporter = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetHighestQuality) else {
    fail("Could not create final exporter.")
}

exporter.outputURL = URL(fileURLWithPath: finalPath)
exporter.outputFileType = .mp4
exporter.shouldOptimizeForNetworkUse = true

let exportGroup = DispatchGroup()
exportGroup.enter()
exporter.exportAsynchronously {
    exportGroup.leave()
}
exportGroup.wait()

guard exporter.status == .completed else {
    fail(exporter.error?.localizedDescription ?? "Final export failed.")
}

print("")
print("LYRIBOP EXPLAINER TEST COMPLETE")
print("24 seconds • 1080x1920 • Samantha narration")
print("Opening ad → real order form → free preview → $10 offer → closing")
print("Saved:")
print(finalPath)
