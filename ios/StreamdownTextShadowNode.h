#pragma once

#include <react/renderer/components/StreamdownTextSpec/ShadowNodes.h>

namespace facebook::react {

class StreamdownTextMeasuringShadowNode final : public StreamdownTextShadowNode {
 public:
  using StreamdownTextShadowNode::StreamdownTextShadowNode;
  Size measureContent(const LayoutContext &layoutContext, const LayoutConstraints &layoutConstraints) const override;
  static ShadowNodeTraits BaseTraits()
  {
    auto traits = StreamdownTextShadowNode::BaseTraits();
    traits.set(ShadowNodeTraits::Trait::LeafYogaNode);
    traits.set(ShadowNodeTraits::Trait::MeasurableYogaNode);
    return traits;
  }
};

} // namespace facebook::react
