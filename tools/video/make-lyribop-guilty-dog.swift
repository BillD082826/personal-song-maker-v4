import Foundation
import AVFoundation
import CoreImage
import CoreGraphics

let home = FileManager.default.homeDirectoryForCurrentUser.path
let sourceDir = "\(home)/Desktop/LyriBop Ads/Videos/Source Files"
let testDir = "\(home)/Desktop/LyriBop Ads/Videos/Test Renders"

let sceneURLs = (1...4).map {
    URL(fileURLWithPath: "\(sourceDir)/LyriBop_Guilty_Dog_Scene_\($0).mp4")
}
let endingURL = URL(fileURLWithPath: "\(sourceDir)/LyriBop_ Every Pet Has a Story(2).png")
let narrationURL = URL(fileURLWithPath: "\(sourceDir)/LyriBop_Guilty_Dog_Narration_Roger.mp3")
let endingMovieURL = URL(fileURLWithPath: "\(testDir)/Guilty_Dog_Scene_5_TEMP.mov")

let fm = FileManager.default
try? fm.removeItem(at: endingMovieURL)

// ---------------------------------------------------------
// STEP 1: Turn approved Scene 5 artwork into a real
// 4-second 720x1280 vertical video segment.
// ---------------------------------------------------------

let width = 720
let height = 1280
let frameRate: Int32 = 30
let scene5Seconds = 4
let totalFrames = Int(frameRate) * scene5Seconds

guard let sourceImage = CIImage(contentsOf: endingURL) else {
    fatalError("Could not load approved Scene 5 artwork.")
}

let canvasRect = CGRect(x: 0, y: 0, width: width, height: height)

// Fit the entire approved artwork — never crop it.
let scale = min(
    CGFloat(width) / sourceImage.extent.width,
    CGFloat(height) / sourceImage.extent.height
)

let scaledImage = sourceImage.transformed(
    by: CGAffineTransform(scaleX: scale, y: scale)
)

let xOffset = (CGFloat(width) - scaledImage.extent.width) / 2.0 - scaledImage.extent.origin.x
let yOffset = (CGFloat(height) - scaledImage.extent.height) / 2.0 - scaledImage.extent.origin.y

let positionedImage = scaledImage.transformed(
    by: CGAffineTransform(translationX: xOffset, y: yOffset)
)

let blackBackground = CIImage(color: CIColor.black).cropped(to: canvasRect)
let finalScene5Image = positionedImage.composited(over: blackBackground)

let writer = try AVAssetWriter(outputURL: endingMovieURL, fileType: .mov)

let videoSettings: [String: Any] = [
    AVVideoCodecKey: AVVideoCodecType.h264,
    AVVideoWidthKey: width,
    AVVideoHeightKey: height
]

let writerInput = AVAssetWriterInput(
    mediaType: .video,
    outputSettings: videoSettings
)
writerInput.expectsMediaDataInRealTime = false

let attributes: [String: Any] = [
    kCVPixelBufferPixelFormatTypeKey as String: Int(kCVPixelFormatType_32BGRA),
    kCVPixelBufferWidthKey as String: width,
    kCVPixelBufferHeightKey as String: height
]

let adaptor = AVAssetWriterInputPixelBufferAdaptor(
    assetWriterInput: writerInput,
    sourcePixelBufferAttributes: attributes
)

guard writer.canAdd(writerInput) else {
    fatalError("Could not add Scene 5 writer input.")
}
writer.add(writerInput)

guard writer.startWriting() else {
    fatalError("Could not start Scene 5 writer: \(writer.error?.localizedDescription ?? "Unknown error")")
}

writer.startSession(atSourceTime: .zero)

let ciContext = CIContext()

for frame in 0..<totalFrames {
    while !writerInput.isReadyForMoreMediaData {
        Thread.sleep(forTimeInterval: 0.002)
    }

    guard let pool = adaptor.pixelBufferPool else {
        fatalError("Scene 5 pixel buffer pool unavailable.")
    }

    var maybeBuffer: CVPixelBuffer?
    let status = CVPixelBufferPoolCreatePixelBuffer(
        nil,
        pool,
        &maybeBuffer
    )

    guard status == kCVReturnSuccess,
          let buffer = maybeBuffer else {
        fatalError("Could not create Scene 5 pixel buffer.")
    }

    ciContext.render(
        finalScene5Image,
        to: buffer,
        bounds: canvasRect,
        colorSpace: CGColorSpaceCreateDeviceRGB()
    )

    let presentationTime = CMTime(
        value: CMTimeValue(frame),
        timescale: frameRate
    )

    guard adaptor.append(buffer, withPresentationTime: presentationTime) else {
        fatalError("Could not append Scene 5 frame.")
    }
}

writerInput.markAsFinished()

let writerDone = DispatchSemaphore(value: 0)
writer.finishWriting {
    writerDone.signal()
}
writerDone.wait()

guard writer.status == .completed else {
    fatalError("Scene 5 creation failed: \(writer.error?.localizedDescription ?? "Unknown error")")
}

print("Scene 5 temporary movie created.")

// ---------------------------------------------------------
// STEP 2: Assemble the four approved 4-second moving clips
// plus the real 4-second Scene 5 video.
// ---------------------------------------------------------

let composition = AVMutableComposition()

guard let compositionVideoTrack = composition.addMutableTrack(
    withMediaType: .video,
    preferredTrackID: kCMPersistentTrackID_Invalid
) else {
    fatalError("Could not create composition video track.")
}

var cursor = CMTime.zero
let fourSeconds = CMTime(seconds: 4, preferredTimescale: 600)

var allSceneURLs = sceneURLs
allSceneURLs.append(endingMovieURL)

var sourceInfo: [(track: AVAssetTrack, start: CMTime)] = []

for url in allSceneURLs {
    let asset = AVURLAsset(url: url)
    let tracks = try await asset.loadTracks(withMediaType: .video)

    guard let track = tracks.first else {
        fatalError("Missing video track: \(url.lastPathComponent)")
    }

    try compositionVideoTrack.insertTimeRange(
        CMTimeRange(start: .zero, duration: fourSeconds),
        of: track,
        at: cursor
    )

    sourceInfo.append((track, cursor))
    cursor = CMTimeAdd(cursor, fourSeconds)
}

// ---------------------------------------------------------
// STEP 3: Add Roger narration at exactly 2 seconds.
// Use the full approved narration; the 20-second video end
// naturally trims only the tiny portion beyond 20 seconds.
// ---------------------------------------------------------

let narrationAsset = AVURLAsset(url: narrationURL)
let narrationTracks = try await narrationAsset.loadTracks(withMediaType: .audio)

if let narrationSource = narrationTracks.first,
   let compositionAudioTrack = composition.addMutableTrack(
        withMediaType: .audio,
        preferredTrackID: kCMPersistentTrackID_Invalid
   ) {

    let narrationDuration = try await narrationAsset.load(.duration)
    let remainingVideoTime = CMTime(seconds: 18, preferredTimescale: 600)
    let insertDuration = CMTimeMinimum(narrationDuration, remainingVideoTime)

    try compositionAudioTrack.insertTimeRange(
        CMTimeRange(start: .zero, duration: insertDuration),
        of: narrationSource,
        at: CMTime(seconds: 2, preferredTimescale: 600)
    )
}

// ---------------------------------------------------------
// STEP 4: Render everything to a 720x1280 9:16 canvas.
// The source moving scenes are already 720x1280, so this
// preserves their native resolution with no needless upscale.
// ---------------------------------------------------------

let renderSize = CGSize(width: width, height: height)
let videoComposition = AVMutableVideoComposition()
videoComposition.renderSize = renderSize
videoComposition.frameDuration = CMTime(value: 1, timescale: frameRate)

var instructions: [AVVideoCompositionInstructionProtocol] = []

for item in sourceInfo {
    let naturalSize = try await item.track.load(.naturalSize)
    let preferredTransform = try await item.track.load(.preferredTransform)

    let transformedRect = CGRect(
        origin: .zero,
        size: naturalSize
    ).applying(preferredTransform)

    let orientedWidth = abs(transformedRect.width)
    let orientedHeight = abs(transformedRect.height)

    let fitScale = min(
        renderSize.width / orientedWidth,
        renderSize.height / orientedHeight
    )

    var transform = preferredTransform

    // Normalize transformed origin first.
    transform = transform.concatenating(
        CGAffineTransform(
            translationX: -transformedRect.minX,
            y: -transformedRect.minY
        )
    )

    transform = transform.concatenating(
        CGAffineTransform(scaleX: fitScale, y: fitScale)
    )

    let fittedWidth = orientedWidth * fitScale
    let fittedHeight = orientedHeight * fitScale

    let centerX = (renderSize.width - fittedWidth) / 2.0
    let centerY = (renderSize.height - fittedHeight) / 2.0

    transform = transform.concatenating(
        CGAffineTransform(
            translationX: centerX / fitScale,
            y: centerY / fitScale
        )
    )

    let instruction = AVMutableVideoCompositionInstruction()
    instruction.timeRange = CMTimeRange(
        start: item.start,
        duration: fourSeconds
    )

    let layerInstruction = AVMutableVideoCompositionLayerInstruction(
        assetTrack: compositionVideoTrack
    )
    layerInstruction.setTransform(transform, at: item.start)

    instruction.layerInstructions = [layerInstruction]
    instructions.append(instruction)
}

videoComposition.instructions = instructions

// ---------------------------------------------------------
// STEP 5: Export to a NEW test file only.
// Approved master is never overwritten here.
// ---------------------------------------------------------

let outputURL = URL(
    fileURLWithPath: "\(testDir)/LyriBop_Guilty_Dog_VERTICAL_TEST.mp4"
)

try? fm.removeItem(at: outputURL)

guard let exporter = AVAssetExportSession(
    asset: composition,
    presetName: AVAssetExportPresetHighestQuality
) else {
    fatalError("Could not create final exporter.")
}

exporter.videoComposition = videoComposition

do {
    try await exporter.export(to: outputURL, as: .mp4)
    print("SUCCESS")
    print("Created: \(outputURL.path)")
} catch {
    fatalError("Final export failed: \(error.localizedDescription)")
}
