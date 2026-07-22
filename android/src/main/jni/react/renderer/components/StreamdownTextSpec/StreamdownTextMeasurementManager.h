#pragma once

#include <react/renderer/components/StreamdownTextSpec/Props.h>
#include <react/renderer/core/LayoutConstraints.h>
#include <react/utils/ContextContainer.h>

namespace facebook::react {

class StreamdownTextMeasurementManager {
 public:
  explicit StreamdownTextMeasurementManager(
      const std::shared_ptr<const ContextContainer>& contextContainer)
      : contextContainer_(contextContainer) {}

  Size measure(
      SurfaceId surfaceId,
      LayoutConstraints layoutConstraints,
      const StreamdownTextProps& props) const;

 private:
  const std::shared_ptr<const ContextContainer> contextContainer_;
};

} // namespace facebook::react
