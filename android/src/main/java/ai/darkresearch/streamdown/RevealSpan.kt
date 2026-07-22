package ai.darkresearch.streamdown

import android.text.TextPaint
import android.text.style.CharacterStyle
import android.text.style.UpdateAppearance

/** Hides a transient range in TextView's stable pass without affecting shaping or measurement. */
internal class RevealSpan : CharacterStyle(), UpdateAppearance {
  override fun updateDrawState(paint: TextPaint) {
    paint.alpha = 0
    paint.bgColor = 0
  }
}
