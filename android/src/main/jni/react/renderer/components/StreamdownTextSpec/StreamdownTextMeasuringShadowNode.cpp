#include "StreamdownTextMeasuringShadowNode.h"

namespace facebook::react {

void StreamdownTextMeasuringShadowNode::setMeasurementManager(
    const std::shared_ptr<StreamdownTextMeasurementManager>& manager) {
  ensureUnsealed();
  measurementManager_ = manager;
}

Size StreamdownTextMeasuringShadowNode::measureContent(
    const LayoutContext&,
    const LayoutConstraints& layoutConstraints) const {
  const auto& props = getConcreteProps();
  if (props.text.empty()) {
    return layoutConstraints.clamp({0, 0});
  }
  return layoutConstraints.clamp(
      measurementManager_->measure(getSurfaceId(), layoutConstraints, props));
}

} // namespace facebook::react
