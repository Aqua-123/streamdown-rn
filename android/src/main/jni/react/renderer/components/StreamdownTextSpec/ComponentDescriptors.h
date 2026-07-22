#pragma once

#include <react/renderer/componentregistry/ComponentDescriptorProviderRegistry.h>

#include "StreamdownTextMeasuringComponentDescriptor.h"

namespace facebook::react {

using StreamdownTextComponentDescriptor =
    StreamdownTextMeasuringComponentDescriptor;

void StreamdownTextSpec_registerComponentDescriptorsFromCodegen(
    std::shared_ptr<const ComponentDescriptorProviderRegistry> registry);

} // namespace facebook::react
