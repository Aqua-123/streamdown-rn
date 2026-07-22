#pragma once

#include "StreamdownTextMeasurementManager.h"

#include <react/renderer/components/StreamdownTextSpec/ShadowNodes.h>

namespace facebook::react {

class StreamdownTextMeasuringShadowNode final
    : public StreamdownTextShadowNode {
 public:
  using StreamdownTextShadowNode::StreamdownTextShadowNode;

  static ShadowNodeTraits BaseTraits() {
    auto traits = StreamdownTextShadowNode::BaseTraits();
    traits.set(ShadowNodeTraits::Trait::LeafYogaNode);
    traits.set(ShadowNodeTraits::Trait::MeasurableYogaNode);
    return traits;
  }

  void setMeasurementManager(
      const std::shared_ptr<StreamdownTextMeasurementManager>& manager);

  Size measureContent(
      const LayoutContext& layoutContext,
      const LayoutConstraints& layoutConstraints) const override;

 private:
  std::shared_ptr<StreamdownTextMeasurementManager> measurementManager_;
};

} // namespace facebook::react
