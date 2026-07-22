#include "StreamdownTextMeasurementManager.h"

#include <fbjni/fbjni.h>
#include <folly/dynamic.h>
#include <react/jni/ReadableNativeMap.h>
#include <react/renderer/core/conversions.h>

using namespace facebook::jni;

namespace facebook::react {

Size StreamdownTextMeasurementManager::measure(
    SurfaceId surfaceId,
    LayoutConstraints layoutConstraints,
    const StreamdownTextProps& props) const {
  const jni::global_ref<jobject>& fabricUIManager =
      contextContainer_->at<jni::global_ref<jobject>>("FabricUIManager");

  static const auto measure =
      facebook::jni::findClassStatic("com/facebook/react/fabric/FabricUIManager")
          ->getMethod<jlong(
              jint,
              jstring,
              ReadableMap::javaobject,
              ReadableMap::javaobject,
              ReadableMap::javaobject,
              jfloat,
              jfloat,
              jfloat,
              jfloat)>("measure");

  folly::dynamic serializedProps = folly::dynamic::object();
  serializedProps["text"] = props.text;
  serializedProps["runs"] = props.runs;
  serializedProps["selectable"] = props.selectable;
  serializedProps["direction"] = props.direction;

  local_ref<ReadableNativeMap::javaobject> nativeProps =
      ReadableNativeMap::newObjectCxxArgs(std::move(serializedProps));
  local_ref<ReadableMap::javaobject> readableProps =
      make_local(reinterpret_cast<ReadableMap::javaobject>(nativeProps.get()));

  const auto minimumSize = layoutConstraints.minimumSize;
  const auto maximumSize = layoutConstraints.maximumSize;
  local_ref<JString> componentName = make_jstring("StreamdownText");

  return yogaMeassureToSize(measure(
      fabricUIManager,
      surfaceId,
      componentName.get(),
      nullptr,
      readableProps.get(),
      nullptr,
      minimumSize.width,
      maximumSize.width,
      minimumSize.height,
      maximumSize.height));
}

} // namespace facebook::react
