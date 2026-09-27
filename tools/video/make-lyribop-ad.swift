import Foundation
import AppKit
import AVFoundation
import CoreVideo
import CoreGraphics

let sourcePath = "/Users/billdonofrio/Desktop/LyriBop Ads/LyriBop_Ad_01_Story.png"
let videosFolder = "/Users/billdonofrio/Desktop/LyriBop Ads/Videos"
let silentPath = "\(videosFolder)/LyriBop_Ad_01_silent.mp4"
let musicPath = "\(videosFolder)/LyriBop_Ad_01_music.wav"
let outputPath = "\(videosFolder)/LyriBop_Ad_01_12sec.mp4"

let width = 1080
let height = 1920
let fps: Int32 = 30
let durationSeconds = 12
let totalFrames = Int(fps) * durationSeconds

func fail(_ message: String) -> Never {
    fputs("ERROR: \(message)\n", stderr)
    exit(1)
}

try? FileManager.default.removeItem(atPath: silentPath)
try? FileManager.default.removeItem(atPath: musicPath)
try? FileManager.default.removeItem(atPath: outputPath)

guard let sourceImage = NSImage(contentsOfFile: sourcePath) else {
    fail("Could not open Ad #1 artwork.")
}

print("1/4 Creating vertical LyriBop video frame...")

guard let bitmap = NSBitmapImageRep(
    bitmapDataPlanes: nil,
    pixelsWide: width,
    pixelsHigh: height,
    bitsPerSample: 8,
    samplesPerPixel: 4,
    hasAlpha: true,
    isPlanar: false,
    colorSpaceName: .deviceRGB,
    bytesPerRow: 0,
    bitsPerPixel: 0
) else {
    fail("Could not create video canvas.")
}

NSGraphicsContext.saveGraphicsState()
guard let graphicsContext = NSGraphicsContext(bitmapImageRep: bitmap) else {
    fail("Could not create graphics context.")
}
NSGraphicsContext.current = graphicsContext

NSColor.black.setFill()
NSRect(x: 0, y: 0, width: width, height: height).fill()

let artworkSize: CGFloat = 1080
let artworkRect = NSRect(
    x: 0,
    y: 300,
    width: artworkSize,
    height: artworkSize
)

sourceImage.draw(
    in: artworkRect,
    from: NSRect(origin: .zero, size: sourceImage.size),
    operation: .copy,
    fraction: 1.0
)

let paragraph = NSMutableParagraphStyle()
paragraph.alignment = .center

let priceLine1 = "Only $10.00 - Complete Song +"
let priceLine2 = "Printable Lyrics"

let titleAttributes: [NSAttributedString.Key: Any] = [
    .font: NSFont.systemFont(ofSize: 54, weight: .bold),
    .foregroundColor: NSColor.white,
    .paragraphStyle: paragraph
]

priceLine1.draw(
    in: NSRect(x: 55, y: 1515, width: 970, height: 80),
    withAttributes: titleAttributes
)

priceLine2.draw(
    in: NSRect(x: 55, y: 1445, width: 970, height: 80),
    withAttributes: titleAttributes
)

NSGraphicsContext.restoreGraphicsState()

guard let cgImage = bitmap.cgImage else {
    fail("Could not prepare finished video frame.")
}

print("2/4 Rendering 12-second video...")

let silentURL = URL(fileURLWithPath: silentPath)

guard let writer = try? AVAssetWriter(outputURL: silentURL, fileType: .mp4) else {
    fail("Could not create video writer.")
}

let videoSettings: [String: Any] = [
    AVVideoCodecKey: AVVideoCodecType.h264,
    AVVideoWidthKey: width,
    AVVideoHeightKey: height,
    AVVideoCompressionPropertiesKey: [
        AVVideoAverageBitRateKey: 8_000_000,
        AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel
    ]
]

let videoInput = AVAssetWriterInput(
    mediaType: .video,
    outputSettings: videoSettings
)
videoInput.expectsMediaDataInRealTime = false

let pixelAttributes: [String: Any] = [
    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
    kCVPixelBufferWidthKey as String: width,
    kCVPixelBufferHeightKey as String: height
]

let adaptor = AVAssetWriterInputPixelBufferAdaptor(
    assetWriterInput: videoInput,
    sourcePixelBufferAttributes: pixelAttributes
)

guard writer.canAdd(videoInput) else {
    fail("Could not add video stream.")
}
writer.add(videoInput)

guard writer.startWriting() else {
    fail(writer.error?.localizedDescription ?? "Video writer could not start.")
}

writer.startSession(atSourceTime: .zero)

func makePixelBuffer(frame: Int) -> CVPixelBuffer? {
    var pixelBuffer: CVPixelBuffer?

    let status = CVPixelBufferCreate(
        kCFAllocatorDefault,
        width,
        height,
        kCVPixelFormatType_32BGRA,
        [
            kCVPixelBufferCGImageCompatibilityKey: true,
            kCVPixelBufferCGBitmapContextCompatibilityKey: true
        ] as CFDictionary,
        &pixelBuffer
    )

    guard status == kCVReturnSuccess, let buffer = pixelBuffer else {
        return nil
    }

    CVPixelBufferLockBaseAddress(buffer, [])

    guard let base = CVPixelBufferGetBaseAddress(buffer) else {
        CVPixelBufferUnlockBaseAddress(buffer, [])
        return nil
    }

    let bytesPerRow = CVPixelBufferGetBytesPerRow(buffer)

    guard let context = CGContext(
        data: base,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: bytesPerRow,
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue |
                    CGBitmapInfo.byteOrder32Little.rawValue
    ) else {
        CVPixelBufferUnlockBaseAddress(buffer, [])
        return nil
    }

    context.setFillColor(CGColor(gray: 0.0, alpha: 1.0))
    context.fill(CGRect(x: 0, y: 0, width: width, height: height))

    let progress = Double(frame) / Double(max(1, totalFrames - 1))
    let motion = sin(progress * Double.pi)
    let scale = 1.0 + 0.04 * motion

    let baseSize = 1080.0
    let animatedSize = baseSize * scale
    let artworkX = (1080.0 - animatedSize) / 2.0
    let artworkY = 300.0 - ((animatedSize - baseSize) / 2.0)

    context.saveGState()
    context.clip(to: CGRect(x: 0, y: 300, width: 1080, height: 1080))
    context.draw(
        sourceImage.cgImage(
            forProposedRect: nil,
            context: nil,
            hints: nil
        )!,
        in: CGRect(
            x: artworkX,
            y: artworkY,
            width: animatedSize,
            height: animatedSize
        )
    )
    context.restoreGState()

    context.saveGState()
    context.setBlendMode(.copy)
    context.setFillColor(CGColor(gray: 0.0, alpha: 1.0))
    context.fill(CGRect(x: 0, y: 0, width: 1080, height: 300))
    context.fill(CGRect(x: 0, y: 1380, width: 1080, height: 540))
    context.restoreGState()

    let priceBitmap = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: width,
        pixelsHigh: height,
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .deviceRGB,
        bytesPerRow: 0,
        bitsPerPixel: 0
    )!

    NSGraphicsContext.saveGraphicsState()
    let priceContext = NSGraphicsContext(bitmapImageRep: priceBitmap)!
    NSGraphicsContext.current = priceContext

    NSColor.clear.setFill()
    NSRect(x: 0, y: 0, width: width, height: height).fill()

    let priceParagraph = NSMutableParagraphStyle()
    priceParagraph.alignment = .center

    let priceAttributes: [NSAttributedString.Key: Any] = [
        .font: NSFont.systemFont(ofSize: 54, weight: .bold),
        .foregroundColor: NSColor.white,
        .paragraphStyle: priceParagraph
    ]

    priceLine1.draw(
        in: NSRect(x: 55, y: 1515, width: 970, height: 80),
        withAttributes: priceAttributes
    )
    priceLine2.draw(
        in: NSRect(x: 55, y: 1445, width: 970, height: 80),
        withAttributes: priceAttributes
    )

    NSGraphicsContext.restoreGraphicsState()

    if let priceImage = priceBitmap.cgImage {
        context.draw(priceImage, in: CGRect(x: 0, y: 0, width: width, height: height))
    }

    CVPixelBufferUnlockBaseAddress(buffer, [])
    return buffer
}

for frame in 0..<totalFrames {
    while !videoInput.isReadyForMoreMediaData {
        usleep(1000)
    }

    guard let buffer = makePixelBuffer(frame: frame) else {
        fail("Could not create video frame \(frame).")
    }

    let time = CMTime(value: CMTimeValue(frame), timescale: fps)

    if !adaptor.append(buffer, withPresentationTime: time) {
        fail(writer.error?.localizedDescription ?? "Could not append video frame.")
    }
}

videoInput.markAsFinished()

let videoSemaphore = DispatchSemaphore(value: 0)
writer.finishWriting {
    videoSemaphore.signal()
}
videoSemaphore.wait()

guard writer.status == .completed else {
    fail(writer.error?.localizedDescription ?? "Video rendering failed.")
}

print("3/4 Creating original upbeat soundtrack...")

let musicURL = URL(fileURLWithPath: musicPath)

let sampleRate = 44_100.0
let totalAudioFrames = Int(sampleRate * Double(durationSeconds))

let chords: [[Double]] = [
    [261.63, 329.63, 392.00],
    [349.23, 440.00, 523.25],
    [392.00, 493.88, 587.33],
    [261.63, 329.63, 392.00]
]

var pcm = Data()
pcm.reserveCapacity(totalAudioFrames * 4)

for absoluteFrame in 0..<totalAudioFrames {
    let t = Double(absoluteFrame) / sampleRate

    let beatPosition = t.truncatingRemainder(dividingBy: 0.5)
    let beatEnvelope = exp(-beatPosition * 8.0)

    let chordIndex = Int(t / 3.0) % chords.count
    let chord = chords[chordIndex]

    var musicalValue = 0.0
    for frequency in chord {
        musicalValue += sin(2.0 * Double.pi * frequency * t) * 0.055
    }

    let bassFrequency = chord[0] / 2.0
    musicalValue += sin(2.0 * Double.pi * bassFrequency * t) * 0.10

    let click = sin(2.0 * Double.pi * 880.0 * t) * beatEnvelope * 0.035

    let fadeIn = min(1.0, t / 0.35)
    let fadeOut = min(1.0, (Double(durationSeconds) - t) / 0.6)
    let envelope = max(0.0, min(fadeIn, fadeOut))

    let value = max(-1.0, min(1.0, (musicalValue + click) * envelope))
    var sample = Int16(value * 32767.0).littleEndian

    withUnsafeBytes(of: &sample) { bytes in
        pcm.append(contentsOf: bytes)
        pcm.append(contentsOf: bytes)
    }
}

func le16(_ value: UInt16) -> Data {
    var v = value.littleEndian
    return Data(bytes: &v, count: 2)
}

func le32(_ value: UInt32) -> Data {
    var v = value.littleEndian
    return Data(bytes: &v, count: 4)
}

let dataSize = UInt32(pcm.count)
let byteRate = UInt32(sampleRate) * 2 * 16 / 8
let blockAlign: UInt16 = 2 * 16 / 8

var wav = Data()
wav.append("RIFF".data(using: .ascii)!)
wav.append(le32(36 + dataSize))
wav.append("WAVE".data(using: .ascii)!)
wav.append("fmt ".data(using: .ascii)!)
wav.append(le32(16))
wav.append(le16(1))
wav.append(le16(2))
wav.append(le32(UInt32(sampleRate)))
wav.append(le32(byteRate))
wav.append(le16(blockAlign))
wav.append(le16(16))
wav.append("data".data(using: .ascii)!)
wav.append(le32(dataSize))
wav.append(pcm)

do {
    try wav.write(to: musicURL)
} catch {
    fail("Could not write WAV soundtrack: \(error.localizedDescription)")
}

print("4/4 Combining video and music...")

let videoAsset = AVURLAsset(url: silentURL)
let audioAsset = AVURLAsset(url: musicURL)

let composition = AVMutableComposition()

guard
    let sourceVideoTrack = videoAsset.tracks(withMediaType: .video).first,
    let compositionVideoTrack = composition.addMutableTrack(
        withMediaType: .video,
        preferredTrackID: kCMPersistentTrackID_Invalid
    )
else {
    fail("Could not prepare video for final export.")
}

let fullDuration = CMTime(seconds: Double(durationSeconds), preferredTimescale: 600)

do {
    try compositionVideoTrack.insertTimeRange(
        CMTimeRange(start: .zero, duration: fullDuration),
        of: sourceVideoTrack,
        at: .zero
    )
} catch {
    fail("Could not insert video: \(error.localizedDescription)")
}

guard
    let sourceAudioTrack = audioAsset.tracks(withMediaType: .audio).first,
    let compositionAudioTrack = composition.addMutableTrack(
        withMediaType: .audio,
        preferredTrackID: kCMPersistentTrackID_Invalid
    )
else {
    fail("Could not prepare soundtrack for final export.")
}

do {
    try compositionAudioTrack.insertTimeRange(
        CMTimeRange(start: .zero, duration: fullDuration),
        of: sourceAudioTrack,
        at: .zero
    )
} catch {
    fail("Could not insert soundtrack: \(error.localizedDescription)")
}

let finalURL = URL(fileURLWithPath: outputPath)

guard let exporter = AVAssetExportSession(
    asset: composition,
    presetName: AVAssetExportPresetHighestQuality
) else {
    fail("Could not create final MP4 exporter.")
}

exporter.outputURL = finalURL
exporter.outputFileType = .mp4
exporter.shouldOptimizeForNetworkUse = true

let exportSemaphore = DispatchSemaphore(value: 0)

exporter.exportAsynchronously {
    exportSemaphore.signal()
}

exportSemaphore.wait()

guard exporter.status == .completed else {
    fail(exporter.error?.localizedDescription ?? "Final MP4 export failed.")
}

try? FileManager.default.removeItem(atPath: silentPath)
try? FileManager.default.removeItem(atPath: musicPath)

print("")
print("==============================================")
print("LYRIBOP AD #1 COMPLETE")
print("==============================================")
print("12 seconds")
print("1080 x 1920 vertical")
print("Price permanently displayed")
print("Original upbeat soundtrack included")
print("")
print("Saved here:")
print(outputPath)
print("==============================================")
