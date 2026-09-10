import AppKit
import Foundation

let arguments = CommandLine.arguments
guard arguments.count == 4,
      let scale = Double(arguments[3]),
      scale > 0,
      scale <= 1,
      let source = NSImage(contentsOfFile: arguments[1]) else {
    fputs("usage: macos-icon.swift <input.png> <output.png> <content-scale>\n", stderr)
    exit(2)
}

let canvasSize = 1024
let contentSize = Int((Double(canvasSize) * scale).rounded())
let contentOrigin = (canvasSize - contentSize) / 2
guard let bitmap = NSBitmapImageRep(
    bitmapDataPlanes: nil,
    pixelsWide: canvasSize,
    pixelsHigh: canvasSize,
    bitsPerSample: 8,
    samplesPerPixel: 4,
    hasAlpha: true,
    isPlanar: false,
    colorSpaceName: .deviceRGB,
    bytesPerRow: 0,
    bitsPerPixel: 0
), let context = NSGraphicsContext(bitmapImageRep: bitmap) else {
    exit(3)
}

bitmap.size = NSSize(width: canvasSize, height: canvasSize)
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = context
context.imageInterpolation = .high
NSColor.clear.setFill()
NSRect(x: 0, y: 0, width: canvasSize, height: canvasSize).fill()
source.draw(
    in: NSRect(x: contentOrigin, y: contentOrigin, width: contentSize, height: contentSize),
    from: NSRect(origin: .zero, size: source.size),
    operation: .sourceOver,
    fraction: 1,
    respectFlipped: true,
    hints: [.interpolation: NSImageInterpolation.high]
)
context.flushGraphics()
NSGraphicsContext.restoreGraphicsState()

guard let png = bitmap.representation(using: .png, properties: [:]) else { exit(4) }
try png.write(to: URL(fileURLWithPath: arguments[2]), options: .atomic)
