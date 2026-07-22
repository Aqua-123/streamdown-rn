#import "StreamdownTextShadowNode.h"
#import "StreamdownTextAttributes.h"

#include <cmath>
#include <react/renderer/core/LayoutConstraints.h>

namespace facebook::react {

Size StreamdownTextMeasuringShadowNode::measureContent(const LayoutContext &, const LayoutConstraints &constraints) const
{
  const auto &props = *std::static_pointer_cast<const StreamdownTextProps>(getProps());
  CGFloat width = constraints.maximumSize.width;
  if (!std::isfinite(width)) width = CGFLOAT_MAX / 4;
  CGSize size = SDMeasureAttributedText(
    [NSString stringWithUTF8String:props.text.c_str()],
    [NSString stringWithUTF8String:props.runs.c_str()],
    [NSString stringWithUTF8String:props.direction.c_str()],
    width
  );
  return { static_cast<Float>(size.width), static_cast<Float>(size.height) };
}

} // namespace facebook::react
