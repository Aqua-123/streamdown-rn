import ExpoModulesCore
import Foundation
import QuartzCore
import Darwin
import os

public final class StreamdownHermesEvidenceModule: Module {
  private let log = OSLog(subsystem: "ai.futurix.streamdown-rn", category: "hermes-benchmark")
  private var displayLink: CADisplayLink?
  private var jsSignpost: OSSignpostID?
  private var uiSignpost: OSSignpostID?
  private var appends: [String: (id: OSSignpostID, startNs: UInt64)] = [:]
  private let lock = NSLock()
  private var running = false

  public func definition() -> ModuleDefinition {
    Name("StreamdownHermesEvidence")
    Function("getLaunchArguments") { ProcessInfo.processInfo.arguments }
    Function("getProcessMemoryBytes") { self.processMemoryBytes() }
    Function("startSession") { self.startSession() }
    Function("stopSession") { self.stopSession() }
    Function("beginAppend") { (appendId: String) in self.beginAppend(appendId) }
    Function("endAppend") { (appendId: String) in self.endAppend(appendId) }
    Function("markJsFrame") { self.markJsFrame() }
    OnDestroy { self.stopSession() }
  }

  private func startSession() {
    stopSession()
    lock.lock()
    running = true
    lock.unlock()
    DispatchQueue.main.async {
      self.lock.lock()
      defer { self.lock.unlock() }
      guard self.running, self.displayLink == nil else { return }
      let link = CADisplayLink(target: self, selector: #selector(self.displayFrame))
      link.add(to: .main, forMode: .common)
      self.displayLink = link
    }
  }

  private func stopSession() {
    lock.lock()
    running = false
    let link = displayLink
    displayLink = nil
    if let id = jsSignpost { os_signpost(.end, log: log, name: "streamdown.js-frame", signpostID: id) }
    if let id = uiSignpost { os_signpost(.end, log: log, name: "streamdown.ui-frame", signpostID: id) }
    jsSignpost = nil
    uiSignpost = nil
    for (appendId, append) in appends {
      os_signpost(.end, log: log, name: "streamdown.append", signpostID: append.id, "%{public}@", appendId)
    }
    appends.removeAll()
    lock.unlock()
    if Thread.isMainThread { link?.invalidate() }
    else { DispatchQueue.main.async { link?.invalidate() } }
  }

  private func valid(_ id: String) -> Bool {
    !id.isEmpty && id.count <= 64 && id.allSatisfy { $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" }
  }

  private func processMemoryBytes() -> Int64 {
    var info = task_vm_info_data_t()
    var count = mach_msg_type_number_t(MemoryLayout<task_vm_info_data_t>.size / MemoryLayout<natural_t>.size)
    let status = withUnsafeMutablePointer(to: &info) {
      $0.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
        task_info(mach_task_self_, task_flavor_t(TASK_VM_INFO), $0, &count)
      }
    }
    return status == KERN_SUCCESS ? Int64(info.phys_footprint) : -1
  }

  private func beginAppend(_ appendId: String) {
    guard valid(appendId) else { return }
    lock.lock()
    defer { lock.unlock() }
    guard appends[appendId] == nil else { return }
    let id = OSSignpostID(log: log)
    appends[appendId] = (id, DispatchTime.now().uptimeNanoseconds)
    let metadata = "{\"appendId\":\"\(appendId)\"}"
    os_signpost(.begin, log: log, name: "streamdown.append", signpostID: id, "%{public}@", metadata)
  }

  private func endAppend(_ appendId: String) -> Double {
    lock.lock()
    defer { lock.unlock() }
    guard let append = appends.removeValue(forKey: appendId) else { return -1 }
    os_signpost(.end, log: log, name: "streamdown.append", signpostID: append.id)
    return Double(DispatchTime.now().uptimeNanoseconds - append.startNs)
  }

  private func markJsFrame() {
    lock.lock()
    defer { lock.unlock() }
    if let id = jsSignpost { os_signpost(.end, log: log, name: "streamdown.js-frame", signpostID: id) }
    let id = OSSignpostID(log: log)
    jsSignpost = id
    os_signpost(.begin, log: log, name: "streamdown.js-frame", signpostID: id)
  }

  @objc private func displayFrame() {
    lock.lock()
    defer { lock.unlock() }
    guard running else { return }
    if let id = uiSignpost { os_signpost(.end, log: log, name: "streamdown.ui-frame", signpostID: id) }
    let id = OSSignpostID(log: log)
    uiSignpost = id
    os_signpost(.begin, log: log, name: "streamdown.ui-frame", signpostID: id)
  }
}
