package ai.aqua.streamdown

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.events.Event

internal class StreamdownLinkPressEvent(surfaceId: Int, viewId: Int, private val url: String) :
  Event<StreamdownLinkPressEvent>(surfaceId, viewId) {
  override fun getEventName() = "topLinkPress"
  public override fun getEventData(): WritableMap = Arguments.createMap().apply { putString("url", url) }
}
