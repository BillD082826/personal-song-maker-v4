import Foundation
import AppKit
import AVFoundation
import CoreVideo
import CoreGraphics

let width = 1080
let height = 1920
let fps: Int32 = 30
let duration = 23.0
let totalFrames = Int(duration * Double(fps))

let adPath = "/Users/billdonofrio/Desktop/LyriBop Ads/Videos/LyriBop_Birthday_Surprise.png"
let formPath = "/Users/billdonofrio/Desktop/LyriBop Ads/Videos/LyriBop_Order_Form.png"
let narrationPath = "/Users/billdonofrio/Desktop/LyriBop Ads/Videos/LyriBop_Birthday_Narration_Roger.wav"
let outputDir = "/Users/billdonofrio/Desktop/LyriBop Ads/Videos"
let silentPath = outputDir + "/LyriBop_Birthday_Surprise_silent.mp4"
let finalPath = outputDir + "/LyriBop_Birthday_Surprise_ROGER_TEST.mp4"

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

    // Continuous birthday-photo background for the full video
    let bgW = CGFloat(width) * 1.08
    let bgH = bgW * CGFloat(adImage.height) / CGFloat(adImage.width)
    let bgX = (CGFloat(width) - bgW) / 2
    let bgY = (CGFloat(height) - bgH) / 2
    context.draw(adImage, in: CGRect(x: bgX, y: bgY, width: bgW, height: bgH))

    // Scene 1: Story-first birthday hook — 0 to 5 sec
    if t < 5.0 {
        let a = fadeFor(t, start: 0, end: 5.0)
        let local = max(0, min(1, t / 5.0))
        let imageW = CGFloat(width) * CGFloat(1.02 + 0.06 * local)
        let imageH = imageW * CGFloat(adImage.height) / CGFloat(adImage.width)
        let x = (CGFloat(width) - imageW) / 2
        let y = (CGFloat(height) - imageH) / 2 - CGFloat(local * 35)

        context.saveGState()
        context.setAlpha(a)
        context.draw(adImage, in: CGRect(x: x, y: y, width: imageW, height: imageH))
        context.restoreGState()

//         roundedPanel(CGRect(x: 55, y: 1500, width: 970, height: 250), alpha: 0.78 * a)
        centeredText("SHE THOUGHT SHE WAS", y: 1635, size: 50, alpha: a)
        centeredText("GETTING A BIRTHDAY CARD…", y: 1550, size: 50, alpha: a)
    }

    // Scene 2: Emotional reveal — 4.3 to 9 sec
    if t >= 4.3 && t < 9.0 {
        let a = fadeFor(t, start: 4.3, end: 9.0)
        let local = max(0, min(1, (t - 4.3) / 4.7))
        let imageW = CGFloat(width) * CGFloat(1.08 + 0.08 * local)
        let imageH = imageW * CGFloat(adImage.height) / CGFloat(adImage.width)
        let x = (CGFloat(width) - imageW) / 2
        let y = (CGFloat(height) - imageH) / 2 - CGFloat(70 + local * 45)

        context.saveGState()
        context.setAlpha(a * 0.72)
        context.draw(adImage, in: CGRect(x: x, y: y, width: imageW, height: imageH))
        context.restoreGState()

//         roundedPanel(CGRect(x: 70, y: 670, width: 940, height: 570), alpha: 0.91 * a)
        centeredText("INSTEAD…", y: 1090, size: 52, alpha: a)
        centeredText("HER STORY", y: 960, size: 82, alpha: a)
        centeredText("BECAME A SONG.", y: 840, size: 82, alpha: a)
        centeredText("LyriBop™", y: 725, size: 54, weight: .semibold, alpha: a)
    }

    // Scene 3: Free preview — 8.3 to 13.8 sec
    if t >= 8.3 && t < 13.8 {
        let a = fadeFor(t, start: 8.3, end: 13.8)
        let pulse = CGFloat(1.0 + 0.025 * sin((t - 8.3) * 3.0))
        let w = CGFloat(920) * pulse
        let x = (CGFloat(width) - w) / 2

//         roundedPanel(CGRect(x: x, y: 610, width: w, height: 720), alpha: 0.95 * a)
        centeredText("HEAR IT FIRST", y: 1135, size: 72, alpha: a)
        centeredText("FREE", y: 980, size: 104, alpha: a)
        centeredText("30-SECOND PREVIEW", y: 855, size: 58, alpha: a)
        centeredText("No payment required", y: 750, size: 38, weight: .medium, alpha: a)
    }

    // Scene 4: Offer — 13.0 to 17.2 sec
    if t >= 13.0 && t < 17.2 {
        let a = fadeFor(t, start: 13.0, end: 17.2)
        let local = max(0, min(1, (t - 13.0) / 4.2))
        let scale = CGFloat(0.95 + 0.05 * ease(local))
        let w = CGFloat(920) * scale
        let x = (CGFloat(width) - w) / 2

//         roundedPanel(CGRect(x: x, y: 580, width: w, height: 770), alpha: 0.96 * a)
        centeredText("LOVE YOUR PREVIEW?", y: 1175, size: 54, alpha: a)
        centeredText("ONLY $10", y: 1015, size: 108, alpha: a)
        centeredText("Complete Personalized Song", y: 875, size: 43, weight: .semibold, alpha: a)
        centeredText("+ Printable Lyrics", y: 775, size: 45, weight: .semibold, alpha: a)
    }

    // Scene 5: Closing CTA — 16.5 to 19 sec
    if t >= 16.5 {
        let a = fadeFor(t, start: 16.5, end: 23.0, edge: 0.35)

        context.saveGState()
        context.setAlpha(a * 0.30)
        let imageW = CGFloat(width) * 1.05
        let imageH = imageW * CGFloat(adImage.height) / CGFloat(adImage.width)
        context.draw(adImage, in: CGRect(
            x: (CGFloat(width) - imageW) / 2,
            y: (CGFloat(height) - imageH) / 2,
            width: imageW,
            height: imageH
        ))
        context.restoreGState()

//         roundedPanel(CGRect(x: 70, y: 620, width: 940, height: 680), alpha: 0.90 * a)
        centeredText("MAKE THEIR STORY", y: 1120, size: 64, alpha: a)
        centeredText("THE GIFT.", y: 1015, size: 86, alpha: a)
        centeredText("LyriBop™", y: 865, size: 76, alpha: a)
        centeredText("Start Your Free Preview", y: 745, size: 48, weight: .semibold, alpha: a)
    }

    NSGraphicsContext.restoreGraphicsState()
    return pixelBuffer
}

print("Creating 23-second LyriBop Birthday Surprise video...")

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
print("Adding Birthday Surprise narration...")

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
print("23-second timeline • 1080x1920 • Birthday Surprise narration")
print("Birthday story → emotional reveal → free preview → $10 offer → closing")
print("Saved:")
print(finalPath)
