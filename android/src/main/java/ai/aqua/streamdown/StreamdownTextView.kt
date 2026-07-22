package ai.aqua.streamdown

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Color
import android.graphics.Canvas
import android.graphics.Path
import android.graphics.Typeface
import android.os.Build
import android.os.SystemClock
import android.text.Spannable
import android.text.SpannableString
import android.text.StaticLayout
import android.text.TextPaint
import android.text.method.LinkMovementMethod
import android.text.style.AbsoluteSizeSpan
import android.text.style.BackgroundColorSpan
import android.text.style.ClickableSpan
import android.text.style.ForegroundColorSpan
import android.text.style.LineHeightSpan
import android.text.style.StrikethroughSpan
import android.text.style.StyleSpan
import android.text.style.TypefaceSpan
import android.text.style.UnderlineSpan
import android.view.Choreographer
import android.view.Gravity
import android.view.View
import android.widget.TextView
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.roundToInt

internal data class ActiveReveal(
  val id: String,
  val start: Int,
  val end: Int,
  val startsAtMs: Long,
  val durationMs: Long,
  val easing: String,
  val animation: String,
)

class StreamdownTextView(context: Context) : TextView(context), Choreographer.FrameCallback {
  var pendingText = ""
  var pendingRuns = "[]"
  var pendingRanges = "[]"
  var pendingAnimation = "none"
  var pendingDuration = 0f
  var pendingEasing = "linear"
  var pendingRevision = 0
  var pendingReducedMotion = false
  var pendingSelectable = false
  var pendingDirection = "auto"
  var onLinkPress: ((String) -> Unit)? = null

  private var renderedText = ""
  private var renderedRuns = "[]"
  private var overlayText = SpannableString("")
  private var overlayLayout: StaticLayout? = null
  private var overlayWidth = -1
  private val active = mutableListOf<ActiveReveal>()
  private val seen = mutableSetOf<String>()
  private var framePosted = false

  init {
    includeFontPadding = false
    setPadding(0, 0, 0, 0)
    setBackgroundColor(Color.TRANSPARENT)
    movementMethod = LinkMovementMethod.getInstance()
    highlightColor = Color.TRANSPARENT
  }

  fun applyPending() {
    val append = pendingText.startsWith(renderedText)
    val semanticAppend = append && topology(pendingRuns, renderedText.length) == topology(renderedRuns, renderedText.length)
    if (!semanticAppend) {
      active.clear()
      seen.clear()
    }
    renderedText = pendingText
    renderedRuns = pendingRuns
    setTextIsSelectable(pendingSelectable)
    textDirection = when (pendingDirection) {
      "rtl" -> View.TEXT_DIRECTION_RTL
      "ltr" -> View.TEXT_DIRECTION_LTR
      else -> View.TEXT_DIRECTION_FIRST_STRONG
    }
    addPendingRanges()
    rebuildSpannable()
    scheduleFrame()
  }

  private fun addPendingRanges() {
    val disabled = pendingAnimation == "none" || pendingDuration <= 0 || pendingReducedMotion ||
      (Build.VERSION.SDK_INT >= 26 && !ValueAnimator.areAnimatorsEnabled())
    val now = SystemClock.uptimeMillis()
    val ranges = jsonArray(pendingRanges)
    for (index in 0 until ranges.length()) {
      val range = ranges.optJSONObject(index) ?: continue
      val start = range.optInt("start", -1)
      val end = range.optInt("end", -1)
      if (start < 0 || end <= start || end > pendingText.length) continue
      val id = "$pendingRevision:$start:$end"
      if (!seen.add(id) || disabled) continue
      active += ActiveReveal(
        id, start, end,
        now + range.optLong("delay", 0).coerceAtLeast(0),
        pendingDuration.toLong().coerceAtLeast(1), pendingEasing, pendingAnimation,
      )
    }
  }

  private fun rebuildSpannable() {
    val value = SpannableString(pendingText)
    val runs = jsonArray(pendingRuns)
    for (index in 0 until runs.length()) {
      val run = runs.optJSONObject(index) ?: continue
      val start = run.optInt("start", -1)
      val end = run.optInt("end", -1)
      if (start < 0 || end <= start || end > value.length) continue
      applyRun(value, run, start, end)
    }
    overlayText = SpannableString(value)
    overlayLayout = null
    overlayWidth = -1
    for (item in active) {
      if (item.end > value.length) continue
      value.setSpan(RevealSpan(), item.start, item.end, Spannable.SPAN_EXCLUSIVE_EXCLUSIVE)
    }
    text = value
  }

  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)
    if (active.isEmpty() || overlayText.isEmpty()) return
    val stableLayout = layout ?: return
    val transientLayout = transientLayout(stableLayout.width)
    val now = SystemClock.uptimeMillis()
    val path = Path()
    val contentLeft = compoundPaddingLeft.toFloat()
    val contentTop = extendedPaddingTop.toFloat() - scrollY
    for (item in active) {
      if (item.end > overlayText.length) continue
      path.reset()
      stableLayout.getSelectionPath(item.start, item.end, path)
      val value = progress(item, now)
      val save = canvas.save()
      canvas.translate(contentLeft, contentTop)
      canvas.clipPath(path)
      if (item.animation == "slideUp") {
        canvas.translate(0f, (1f - value) * 6f * resources.displayMetrics.density)
      }
      val layer = canvas.saveLayerAlpha(
        0f,
        0f,
        transientLayout.width.toFloat(),
        transientLayout.height.toFloat(),
        (255f * value).roundToInt().coerceIn(0, 255),
      )
      transientLayout.draw(canvas)
      canvas.restoreToCount(layer)
      canvas.restoreToCount(save)
    }
  }

  private fun transientLayout(width: Int): StaticLayout {
    overlayLayout?.takeIf { overlayWidth == width }?.let { return it }
    val stable = layout
    val built = StaticLayout.Builder.obtain(overlayText, 0, overlayText.length, paint, width.coerceAtLeast(1))
      .setAlignment(stable?.alignment ?: android.text.Layout.Alignment.ALIGN_NORMAL)
      .setIncludePad(includeFontPadding)
      .setLineSpacing(lineSpacingExtra, lineSpacingMultiplier)
      .setBreakStrategy(breakStrategy)
      .setHyphenationFrequency(hyphenationFrequency)
      .setTextDirection(textDirectionHeuristic)
      .build()
    overlayWidth = width
    overlayLayout = built
    return built
  }

  private fun applyRun(value: SpannableString, run: JSONObject, start: Int, end: Int) {
    val flags = Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
    run.string("color")?.let { parseColor(it)?.let { color -> value.setSpan(ForegroundColorSpan(color), start, end, flags) } }
    run.string("backgroundColor")?.let { parseColor(it)?.let { color -> value.setSpan(BackgroundColorSpan(color), start, end, flags) } }
    run.string("fontFamily")?.let { value.setSpan(TypefaceSpan(it), start, end, flags) }
    if (run.has("fontSize")) {
      val sp = run.optDouble("fontSize", 16.0).toFloat()
      val dip = sp * resources.displayMetrics.scaledDensity / resources.displayMetrics.density
      value.setSpan(AbsoluteSizeSpan(dip.roundToInt(), true), start, end, flags)
    }
    if (run.has("lineHeight")) {
      val px = run.optDouble("lineHeight", 0.0).toFloat() * resources.displayMetrics.scaledDensity
      if (px > 0) value.setSpan(LineHeightSpan.Standard(px.roundToInt()), start, end, flags)
    }
    val bold = run.string("fontWeight")?.toIntOrNull()?.let { it >= 600 }
      ?: (run.string("fontWeight") == "bold")
    val italic = run.string("fontStyle") == "italic"
    if (bold || italic) value.setSpan(StyleSpan(if (bold && italic) Typeface.BOLD_ITALIC else if (bold) Typeface.BOLD else Typeface.ITALIC), start, end, flags)
    if (run.optBoolean("underline", false)) value.setSpan(UnderlineSpan(), start, end, flags)
    if (run.optBoolean("strikethrough", false)) value.setSpan(StrikethroughSpan(), start, end, flags)
    run.string("url")?.let { url ->
      value.setSpan(object : ClickableSpan() {
        override fun onClick(widget: View) { onLinkPress?.invoke(url) }
        override fun updateDrawState(ds: TextPaint) = Unit
      }, start, end, flags)
    }
    if (start == 0 && end == value.length) {
      gravity = when (run.string("textAlign")) {
        "center" -> Gravity.CENTER_HORIZONTAL
        "right" -> Gravity.END
        else -> Gravity.START
      }
    }
  }

  private fun scheduleFrame() {
    if (active.isEmpty() || framePosted) return
    framePosted = true
    Choreographer.getInstance().postFrameCallback(this)
  }

  override fun doFrame(frameTimeNanos: Long) {
    framePosted = false
    val now = SystemClock.uptimeMillis()
    var completed = false
    for (item in active) {
      val value = progress(item, now)
      if (value >= 1f) completed = true
    }
    if (completed) {
      active.removeAll { progress(it, now) >= 1f }
      rebuildSpannable()
    } else invalidate()
    scheduleFrame()
  }

  override fun onDetachedFromWindow() {
    if (framePosted) Choreographer.getInstance().removeFrameCallback(this)
    framePosted = false
    super.onDetachedFromWindow()
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    scheduleFrame()
  }

  private fun progress(item: ActiveReveal, now: Long): Float {
    val raw = ((now - item.startsAtMs).toFloat() / item.durationMs).coerceIn(0f, 1f)
    return when (item.easing) {
      "ease-in" -> raw * raw
      "ease-out" -> 1f - (1f - raw) * (1f - raw)
      "ease-in-out" -> if (raw < .5f) 2f * raw * raw else 1f - (-2f * raw + 2f).let { it * it } / 2f
      else -> raw
    }
  }

  companion object {
    private fun jsonArray(value: String): JSONArray = try { JSONArray(value) } catch (_: Exception) { JSONArray() }
    private fun JSONObject.string(name: String): String? = if (has(name) && !isNull(name)) optString(name) else null
    private fun parseColor(value: String): Int? = try { Color.parseColor(value) } catch (_: IllegalArgumentException) { null }
    private fun topology(value: String, limit: Int): String {
      val output = mutableListOf<String>()
      val runs = jsonArray(value)
      for (index in 0 until runs.length()) {
        val run = runs.optJSONObject(index) ?: continue
        val start = run.optInt("start", -1)
        val end = run.optInt("end", -1).coerceAtMost(limit)
        if (start < 0 || end <= start || start >= limit) continue
        val styles = run.keys().asSequence()
          .filter { it != "start" && it != "end" }
          .sorted()
          .joinToString(",") { key -> "$key=${run.opt(key)}" }
        output += "$start:$end:$styles"
      }
      return output.joinToString("|")
    }
  }
}
