#pragma once

#include "StreamdownTextMeasurementManager.h"
#include "StreamdownTextMeasuringShadowNode.h"

#include <react/renderer/core/ConcreteComponentDescriptor.h>

namespace facebook::react {

class StreamdownTextMeasuringComponentDescriptor final
    : public ConcreteComponentDescriptor<StreamdownTextMeasuringShadowNode> {
 public:
  explicit StreamdownTextMeasuringComponentDescriptor(
      const ComponentDescriptorParameters& parameters)
      : ConcreteComponentDescriptor(parameters),
        measurementManager_(
            std::make_shared<StreamdownTextMeasurementManager>(
                contextContainer_)) {}

  void adopt(ShadowNode& shadowNode) const override {
    ConcreteComponentDescriptor::adopt(shadowNode);
    auto& node =
        static_cast<StreamdownTextMeasuringShadowNode&>(shadowNode);
    node.setMeasurementManager(measurementManager_);
  }

 private:
  const std::shared_ptr<StreamdownTextMeasurementManager>
      measurementManager_;
};

} // namespace facebook::react
