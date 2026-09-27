import Foundation
import AppKit
import AVFoundation
import CoreVideo
import CoreGraphics

let sourcePath = "/Users/billdonofrio/Desktop/LyriBop Ads/Videos/Source Files/IMG_3677.mov"
let outputDir = "/Users/billdonofrio/Desktop/LyriBop Ads/Videos"
let silentPath = outputDir + "/LyriBop_Arlo_burned_silent.mp4"
let finalPath = outputDir + "/LyriBop_Arlo_FUNNY_VISUAL_TEST_V2.mp4"

let width = 1080
let height = 1920
let fps: Int32 = 30
let duration = 15.0
let totalFrames = Int(duration * Double(fps))

func fail(_ message: String) -> Never {
    fputs("ERROR: \(message)\n", stderr)
    exit(1)
}

func centeredText(_ text: String,
                  y: CGFloat,
                  size: CGFloat,
                  alpha: CGFloat = 1.0) {

    let style = NSMutableParagraphStyle()
    style.alignment = .center

    let shadow = NSShadow()
    shadow.shadowColor = NSColor.black.withAlphaComponent(0.95)
    shadow.shadowBlurRadius = 10
    shadow.shadowOffset = NSSize(width: 0, height: -2)

    let attrs: [NSAttributedString.Key: Any] = [
        .font: NSFont.systemFont(ofSize: size, weight: .heavy),
        .foregroundColor: NSColor.white.withAlphaComponent(alpha),
        .paragraphStyle: style,
        .shadow: shadow
    ]

    NSString(string: text).draw(
        in: NSRect(
            x: 55,
            y: y,
            width: CGFloat(width - 110),
            height: size * 4.5
        ),
        withAttributes: attrs
    )
}

func panel(_ rect: CGRect, alpha: CGFloat = 0.48) {
    NSColor.black.withAlphaComponent(alpha).setFill()
    NSBezierPath(roundedRect: rect, xRadius: 26, yRadius: 26).fill()
}

func drawCaption(time: Double) {

    if time >= 0.3 && time < 4.5 {
        centeredText(
            "ARLO HEARD SOMEBODY\nWROTE A SONG ABOUT HIM…",
            y: 1490,
            size: 58
        )
    }

    if time >= 4.5 && time < 9.0 {
        centeredText(
            "WAIT…\nYOU TOLD THEM\nEVERYTHING?",
            y: 1440,
            size: 52
        )
    }

    if time >= 9.0 && time < 11.5 {
        centeredText(
            "OKAY… HE LIKES IT.",
            y: 1500,
            size: 64
        )
    }

    if time >= 11.5 {
        centeredText(
            "LyriBop™",
            y: 1570,
            size: 82
        )
        centeredText(
            "Turn their story into a song.",
            y: 1470,
            size: 48
        )

        centeredText(
            "FREE 30-SECOND PREVIEW",
            y: 300,
            size: 48
        )
        centeredText(
            "COMPLETE SONG + PRINTABLE LYRICS — $10",
            y: 220,
            size: 36
        )
    }
}

let asset = AVURLAsset(url: URL(fileURLWithPath: sourcePath))
let generator = AVAssetImageGenerator(asset: asset)
generator.appliesPreferredTrackTransform = true
generator.requestedTimeToleranceBefore = .zero
generator.requestedTimeToleranceAfter = .zero

try? FileManager.default.removeItem(atPath: silentPath)
try? FileManager.default.removeItem(atPath: finalPath)

guard let writer = try? AVAssetWriter(
    outputURL: URL(fileURLWithPath: silentPath),
    fileType: .mp4
) else {
    fail("Could not create video writer.")
}

let settings: [String: Any] = [
    AVVideoCodecKey: AVVideoCodecType.h264,
    AVVideoWidthKey: width,
    AVVideoHeightKey: height,
    AVVideoCompressionPropertiesKey: [
        AVVideoAverageBitRateKey: 8_000_000
    ]
]

let input = AVAssetWriterInput(
    mediaType: .video,
    outputSettings: settings
)

input.expectsMediaDataInRealTime = false

let attrs: [String: Any] = [
    kCVPixelBufferPixelFormatTypeKey as String:
        kCVPixelFormatType_32ARGB,
    kCVPixelBufferWidthKey as String: width,
    kCVPixelBufferHeightKey as String: height
]

let adaptor = AVAssetWriterInputPixelBufferAdaptor(
    assetWriterInput: input,
    sourcePixelBufferAttributes: attrs
)

guard writer.canAdd(input) else {
    fail("Could not add video input.")
}

writer.add(input)

guard writer.startWriting() else {
    fail(writer.error?.localizedDescription ?? "Could not start writer.")
}

writer.startSession(atSourceTime: .zero)

func makeFrame(frame: Int) -> CVPixelBuffer? {

    let seconds = Double(frame) / Double(fps)
    let sourceTime = CMTime(
        seconds: seconds,
        preferredTimescale: 600
    )

    guard let cgImage = try? generator.copyCGImage(
        at: sourceTime,
        actualTime: nil
    ) else {
        return nil
    }

    var buffer: CVPixelBuffer?

    CVPixelBufferCreate(
        kCFAllocatorDefault,
        width,
        height,
        kCVPixelFormatType_32ARGB,
        attrs as CFDictionary,
        &buffer
    )

    guard let pixelBuffer = buffer else {
        return nil
    }

    CVPixelBufferLockBaseAddress(pixelBuffer, [])
    defer {
        CVPixelBufferUnlockBaseAddress(pixelBuffer, [])
    }

    guard let baseAddress = CVPixelBufferGetBaseAddress(pixelBuffer) else {
        return nil
    }

    let bytesPerRow = CVPixelBufferGetBytesPerRow(pixelBuffer)

    guard let context = CGContext(
        data: baseAddress,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: bytesPerRow,
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue
    ) else {
        return nil
    }

    context.setFillColor(NSColor.black.cgColor)
    context.fill(
        CGRect(x: 0, y: 0, width: width, height: height)
    )

    let imageRatio =
        CGFloat(cgImage.width) / CGFloat(cgImage.height)

    let targetRatio =
        CGFloat(width) / CGFloat(height)

    var drawRect = CGRect.zero

    if imageRatio > targetRatio {
        let drawHeight = CGFloat(height)
        let drawWidth = drawHeight * imageRatio

        drawRect = CGRect(
            x: (CGFloat(width) - drawWidth) / 2,
            y: 0,
            width: drawWidth,
            height: drawHeight
        )
    } else {
        let drawWidth = CGFloat(width)
        let drawHeight = drawWidth / imageRatio

        drawRect = CGRect(
            x: 0,
            y: (CGFloat(height) - drawHeight) / 2,
            width: drawWidth,
            height: drawHeight
        )
    }

    context.draw(cgImage, in: drawRect)

    NSGraphicsContext.saveGraphicsState()

    let nsContext = NSGraphicsContext(
        cgContext: context,
        flipped: false
    )

    NSGraphicsContext.current = nsContext

    drawCaption(time: seconds)

    NSGraphicsContext.restoreGraphicsState()

    return pixelBuffer
}

print("Creating 15-second Arlo funny video with burned-in captions...")

var frame = 0

while frame < totalFrames {

    if input.isReadyForMoreMediaData {

        guard let pixelBuffer = makeFrame(frame: frame) else {
            fail("Could not create frame \(frame).")
        }

        let time = CMTime(
            value: CMTimeValue(frame),
            timescale: fps
        )

        guard adaptor.append(
            pixelBuffer,
            withPresentationTime: time
        ) else {
            fail(
                writer.error?.localizedDescription ??
                "Could not append frame."
            )
        }

        frame += 1

        if frame % 150 == 0 {
            print("Video progress: \(frame / Int(fps)) seconds")
        }

    } else {
        Thread.sleep(forTimeInterval: 0.01)
    }
}

input.markAsFinished()

writer.endSession(
    atSourceTime: CMTime(
        seconds: duration,
        preferredTimescale: 600
    )
)

let finishGroup = DispatchGroup()
finishGroup.enter()

writer.finishWriting {
    finishGroup.leave()
}

finishGroup.wait()

guard writer.status == .completed else {
    fail(
        writer.error?.localizedDescription ??
        "Video export failed."
    )
}

print("Burned-in video complete.")
print("Adding Roger narration...")

let burnedAsset = AVURLAsset(
    url: URL(fileURLWithPath: silentPath)
)

let originalAsset = AVURLAsset(
    url: URL(fileURLWithPath: sourcePath)
)

let composition = AVMutableComposition()

guard
    let burnedVideo =
        burnedAsset.tracks(withMediaType: .video).first,
    let videoTrack =
        composition.addMutableTrack(
            withMediaType: .video,
            preferredTrackID:
                kCMPersistentTrackID_Invalid
        )
else {
    fail("Could not prepare burned video.")
}

let finalDuration = CMTime(
    seconds: duration,
    preferredTimescale: 600
)

do {
    try videoTrack.insertTimeRange(
        CMTimeRange(
            start: .zero,
            duration: finalDuration
        ),
        of: burnedVideo,
        at: .zero
    )
} catch {
    fail("Could not add burned video.")
}

let narrationAsset = AVURLAsset(
    url: URL(fileURLWithPath:
        NSHomeDirectory() +
        "/Desktop/LyriBop Ads/Videos/Source Files/LyriBop_Arlo_Narration_Roger.mp3"
    )
)

if
    let narrationAudio =
        narrationAsset.tracks(withMediaType: .audio).first,
    let audioTrack =
        composition.addMutableTrack(
            withMediaType: .audio,
            preferredTrackID:
                kCMPersistentTrackID_Invalid
        )
{
    let narrationDuration = min(
        narrationAsset.duration,
        finalDuration
    )

    try? audioTrack.insertTimeRange(
        CMTimeRange(
            start: .zero,
            duration: narrationDuration
        ),
        of: narrationAudio,
        at: .zero
    )
}

guard let exporter = AVAssetExportSession(
    asset: composition,
    presetName: AVAssetExportPresetHighestQuality
) else {
    fail("Could not create final exporter.")
}

exporter.outputURL =
    URL(fileURLWithPath: finalPath)

exporter.outputFileType = .mp4
exporter.shouldOptimizeForNetworkUse = true

let exportGroup = DispatchGroup()
exportGroup.enter()

exporter.exportAsynchronously {
    exportGroup.leave()
}

exportGroup.wait()

guard exporter.status == .completed else {
    fail(
        exporter.error?.localizedDescription ??
        "Final export failed."
    )
}

print("")
print("ARLO FUNNY VISUAL TEST V2 COMPLETE")
print("15 seconds • 1080x1920 • burned captions • Roger narration")
print("Saved:")
print(finalPath)
