#pragma once

#include "StreamdownTextShadowNode.h"
#include <react/renderer/core/ConcreteComponentDescriptor.h>

namespace facebook::react {

class StreamdownTextComponentDescriptor final : public ConcreteComponentDescriptor<StreamdownTextMeasuringShadowNode> {
 public:
  using ConcreteComponentDescriptor::ConcreteComponentDescriptor;
};

} // namespace facebook::react
