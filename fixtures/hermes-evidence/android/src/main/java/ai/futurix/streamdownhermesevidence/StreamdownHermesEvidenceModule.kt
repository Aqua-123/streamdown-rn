package ai.futurix.streamdownhermesevidence

import android.os.Build
import android.os.Debug
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.os.Trace
import android.view.Choreographer
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger

class StreamdownHermesEvidenceModule : Module(), Choreographer.FrameCallback {
  private val main = Handler(Looper.getMainLooper())
  private val cookies = AtomicInteger(1)
  private data class Append(val cookie: Int, val startNs: Long)
  private val appends = ConcurrentHashMap<String, Append>()
  private var running = false
  private var jsCookie: Int? = null
  private var uiCookie: Int? = null

  override fun definition() = ModuleDefinition {
    Name("StreamdownHermesEvidence")
    Function("getLaunchArguments") { emptyList<String>() }
    Function("getProcessMemoryBytes") {
      val memory = Debug.MemoryInfo()
      Debug.getMemoryInfo(memory)
      memory.totalPss.toLong() * 1024L
    }
    Function("startSession") { startSession() }
    Function("stopSession") { stopSession() }
    Function("beginAppend") { appendId: String -> beginAppend(appendId) }
    Function("endAppend") { appendId: String -> endAppend(appendId) }
    Function("markJsFrame") { markJsFrame() }
    OnDestroy { stopSession() }
  }

  private fun supported() = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
  private fun begin(name: String, cookie: Int) { if (supported()) Trace.beginAsyncSection(name, cookie) }
  private fun end(name: String, cookie: Int) { if (supported()) Trace.endAsyncSection(name, cookie) }

  @Synchronized
  private fun startSession() {
    stopSession()
    running = true
    main.post { startFramesIfRunning() }
  }

  @Synchronized
  private fun startFramesIfRunning() {
    if (!running) return
    Choreographer.getInstance().removeFrameCallback(this)
    Choreographer.getInstance().postFrameCallback(this)
  }

  @Synchronized
  private fun stopSession() {
    running = false
    if (Looper.myLooper() == Looper.getMainLooper()) Choreographer.getInstance().removeFrameCallback(this)
    else main.post { Choreographer.getInstance().removeFrameCallback(this) }
    jsCookie?.let { end("streamdown-rn:js-frame", it) }
    uiCookie?.let { end("streamdown-rn:ui-frame", it) }
    jsCookie = null
    uiCookie = null
    appends.forEach { (id, append) -> end("streamdown-rn:append:$id", append.cookie) }
    appends.clear()
  }

  @Synchronized
  private fun beginAppend(id: String) {
    require(id.isNotBlank() && id.length <= 64 && id.all { it.isLetterOrDigit() || it == '-' || it == '_' })
    val cookie = cookies.getAndIncrement()
    check(appends.putIfAbsent(id, Append(cookie, SystemClock.elapsedRealtimeNanos())) == null) { "duplicate append id" }
    begin("streamdown-rn:append:$id", cookie)
  }

  @Synchronized
  private fun endAppend(id: String): Long {
    val append = appends.remove(id) ?: throw IllegalStateException("unknown append id")
    end("streamdown-rn:append:$id", append.cookie)
    return SystemClock.elapsedRealtimeNanos() - append.startNs
  }

  @Synchronized
  private fun markJsFrame() {
    jsCookie?.let { end("streamdown-rn:js-frame", it) }
    cookies.getAndIncrement().also { jsCookie = it; begin("streamdown-rn:js-frame", it) }
  }

  @Synchronized
  override fun doFrame(frameTimeNanos: Long) {
    if (!running) return
    uiCookie?.let { end("streamdown-rn:ui-frame", it) }
    cookies.getAndIncrement().also { uiCookie = it; begin("streamdown-rn:ui-frame", it) }
    Choreographer.getInstance().postFrameCallback(this)
  }
}
