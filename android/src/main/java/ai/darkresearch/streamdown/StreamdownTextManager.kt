package ai.darkresearch.streamdown

import android.content.Context
import android.view.View
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.common.MapBuilder
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.PixelUtil
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.viewmanagers.StreamdownTextManagerDelegate
import com.facebook.react.viewmanagers.StreamdownTextManagerInterface
import com.facebook.yoga.YogaMeasureMode
import com.facebook.yoga.YogaMeasureOutput
import kotlin.math.roundToInt

@ReactModule(name = StreamdownTextManager.NAME)
class StreamdownTextManager : SimpleViewManager<StreamdownTextView>(), StreamdownTextManagerInterface<StreamdownTextView> {
  private val delegate = StreamdownTextManagerDelegate(this)
  override fun getDelegate(): ViewManagerDelegate<StreamdownTextView> = delegate
  override fun getName() = NAME
  public override fun createViewInstance(context: ThemedReactContext) = StreamdownTextView(context)

  override fun addEventEmitters(context: ThemedReactContext, view: StreamdownTextView) {
    view.onLinkPress = { url ->
      UIManagerHelper.getEventDispatcherForReactTag(context, view.id)?.dispatchEvent(
        StreamdownLinkPressEvent(UIManagerHelper.getSurfaceId(context), view.id, url)
      )
    }
  }

  override fun getExportedCustomDirectEventTypeConstants(): MutableMap<String, Any> =
    MapBuilder.of("topLinkPress", MapBuilder.of("registrationName", "onLinkPress"))

  @ReactProp(name = "text") override fun setText(view: StreamdownTextView, value: String?) { view.pendingText = value ?: "" }
  @ReactProp(name = "runs") override fun setRuns(view: StreamdownTextView, value: String?) { view.pendingRuns = value ?: "[]" }
  @ReactProp(name = "animationRanges") override fun setAnimationRanges(view: StreamdownTextView, value: String?) { view.pendingRanges = value ?: "[]" }
  @ReactProp(name = "animation") override fun setAnimation(view: StreamdownTextView, value: String?) { view.pendingAnimation = value ?: "none" }
  @ReactProp(name = "duration") override fun setDuration(view: StreamdownTextView, value: Float) { view.pendingDuration = if (value.isFinite()) value else 0f }
  @ReactProp(name = "easing") override fun setEasing(view: StreamdownTextView, value: String?) { view.pendingEasing = value ?: "linear" }
  @ReactProp(name = "revision") override fun setRevision(view: StreamdownTextView, value: Int) { view.pendingRevision = value }
  @ReactProp(name = "reducedMotion") override fun setReducedMotion(view: StreamdownTextView, value: Boolean) { view.pendingReducedMotion = value }
  @ReactProp(name = "selectable") override fun setSelectable(view: StreamdownTextView, value: Boolean) { view.pendingSelectable = value }
  @ReactProp(name = "direction") override fun setDirection(view: StreamdownTextView, value: String?) { view.pendingDirection = value ?: "auto" }

  override fun onAfterUpdateTransaction(view: StreamdownTextView) {
    super.onAfterUpdateTransaction(view)
    view.applyPending()
  }

  override fun updateExtraData(root: StreamdownTextView, extraData: Any?) = Unit

  override fun measure(
    context: Context,
    localData: ReadableMap?,
    props: ReadableMap?,
    state: ReadableMap?,
    width: Float,
    widthMode: YogaMeasureMode,
    height: Float,
    heightMode: YogaMeasureMode,
    attachmentsPositions: FloatArray?,
  ): Long {
    val view = StreamdownTextView(context)
    if (props != null) {
      view.pendingText = props.string("text", "")
      view.pendingRuns = props.string("runs", "[]")
      view.pendingRanges = "[]"
      view.pendingAnimation = "none"
      view.pendingReducedMotion = true
      view.pendingSelectable = props.bool("selectable")
      view.pendingDirection = props.string("direction", "auto")
    }
    view.applyPending()
    // FabricUIManager.measure supplies constraints in physical pixels and expects
    // YogaMeasureOutput in that same coordinate space. Converting them as DIP a
    // second time makes the TextView measure against a screen several times wider,
    // which collapses wrapped prose into clipped single-line layouts.
    val widthSpec = View.MeasureSpec.makeMeasureSpec(width.finitePixels(), widthMode.specMode())
    val heightSpec = View.MeasureSpec.makeMeasureSpec(height.finitePixels(), heightMode.specMode())
    view.measure(widthSpec, heightSpec)
    return YogaMeasureOutput.make(
      PixelUtil.toDIPFromPixel(view.measuredWidth.toFloat()),
      PixelUtil.toDIPFromPixel(view.measuredHeight.toFloat()),
    )
  }

  companion object { const val NAME = "StreamdownText" }
}

private fun YogaMeasureMode.specMode() = when (this) {
  YogaMeasureMode.EXACTLY -> View.MeasureSpec.EXACTLY
  YogaMeasureMode.AT_MOST -> View.MeasureSpec.AT_MOST
  YogaMeasureMode.UNDEFINED -> View.MeasureSpec.UNSPECIFIED
}

private fun Float.finitePixels() = if (isFinite()) roundToInt().coerceAtLeast(0) else 0

private fun ReadableMap.string(name: String, fallback: String) = if (hasKey(name) && !isNull(name)) getString(name) ?: fallback else fallback
private fun ReadableMap.bool(name: String) = hasKey(name) && !isNull(name) && getBoolean(name)
