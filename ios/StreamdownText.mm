#import "StreamdownText.h"
#import "StreamdownTextAttributes.h"
#import "StreamdownTextComponentDescriptor.h"
#import "StreamdownRevealLayoutManager.h"

#import <react/renderer/components/StreamdownTextSpec/EventEmitters.h>
#import <react/renderer/components/StreamdownTextSpec/Props.h>
#import <react/renderer/components/StreamdownTextSpec/RCTComponentViewHelpers.h>
#import "RCTFabricComponentsPlugins.h"

using namespace facebook::react;

static NSString *SDTopology(NSString *json, NSUInteger limit)
{
  NSData *data = [json dataUsingEncoding:NSUTF8StringEncoding];
  id decoded = data ? [NSJSONSerialization JSONObjectWithData:data options:0 error:nil] : nil;
  if (![decoded isKindOfClass:NSArray.class]) return @"";
  NSMutableArray *normalized = [[NSMutableArray alloc] init];
  for (NSDictionary *run in (NSArray *)decoded) {
    NSInteger start = [run[@"start"] integerValue];
    NSInteger end = MIN((NSInteger)limit, [run[@"end"] integerValue]);
    if (start < 0 || end <= start || start >= (NSInteger)limit) continue;
    NSMutableDictionary *item = [run mutableCopy];
    item[@"start"] = @(start);
    item[@"end"] = @(end);
    [normalized addObject:item];
  }
  NSData *encoded = [NSJSONSerialization dataWithJSONObject:normalized options:NSJSONWritingSortedKeys error:nil];
  return encoded ? [[NSString alloc] initWithData:encoded encoding:NSUTF8StringEncoding] : @"";
}

@interface StreamdownTextComponentView () <RCTStreamdownTextViewProtocol>
@end

@implementation StreamdownTextComponentView {
  UITextView *_textView;
  StreamdownRevealLayoutManager *_layoutManager;
  NSMutableDictionary<NSString *, NSMutableDictionary *> *_active;
  NSMutableSet<NSString *> *_seen;
  CADisplayLink *_displayLink;
  NSString *_renderedText;
  NSString *_renderedRuns;
  NSString *_animation;
  NSString *_easing;
  NSTimeInterval _duration;
  NSInteger _revision;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<StreamdownTextComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const StreamdownTextProps>();
    _props = defaultProps;
    _active = [[NSMutableDictionary alloc] init];
    _seen = [[NSMutableSet alloc] init];
    _renderedText = @"";
    _renderedRuns = @"[]";
    _layoutManager = [[StreamdownRevealLayoutManager alloc] init];
    NSTextStorage *storage = [[NSTextStorage alloc] init];
    [storage addLayoutManager:_layoutManager];
    NSTextContainer *container = [[NSTextContainer alloc] initWithSize:CGSizeMake(0, CGFLOAT_MAX)];
    container.widthTracksTextView = YES;
    container.lineFragmentPadding = 0;
    [_layoutManager addTextContainer:container];
    _textView = [[UITextView alloc] initWithFrame:CGRectZero textContainer:container];
    _textView.backgroundColor = UIColor.clearColor;
    _textView.editable = NO;
    _textView.scrollEnabled = NO;
    _textView.selectable = NO;
    _textView.textContainerInset = UIEdgeInsetsZero;
    _textView.linkTextAttributes = @{};
    _textView.delegate = self;
    self.contentView = _textView;
  }
  return self;
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
  const auto &next = *std::static_pointer_cast<const StreamdownTextProps>(props);
  NSString *text = [NSString stringWithUTF8String:next.text.c_str()];
  NSString *runs = [NSString stringWithUTF8String:next.runs.c_str()];
  NSString *ranges = [NSString stringWithUTF8String:next.animationRanges.c_str()];
  NSString *direction = [NSString stringWithUTF8String:next.direction.c_str()];
  _animation = [NSString stringWithUTF8String:next.animation.c_str()];
  _easing = [NSString stringWithUTF8String:next.easing.c_str()];
  _duration = MAX(0, next.duration) / 1000.0;
  _revision = next.revision;
  BOOL append = [text hasPrefix:_renderedText];
  BOOL semanticAppend = append && [SDTopology(runs, _renderedText.length) isEqualToString:SDTopology(_renderedRuns, _renderedText.length)];
  if (!semanticAppend) {
    [_active removeAllObjects];
    [_seen removeAllObjects];
  }
  _renderedText = text;
  _renderedRuns = runs;
  _textView.selectable = next.selectable;
  _textView.attributedText = SDAttributedText(text, runs, direction);
  [self addRanges:ranges disabled:next.reducedMotion || UIAccessibilityIsReduceMotionEnabled() || _duration <= 0 || [_animation isEqualToString:@"none"]];
  [self updateRevealRanges];
  [self scheduleDisplayLink];
  [super updateProps:props oldProps:oldProps];
}

- (void)addRanges:(NSString *)json disabled:(BOOL)disabled
{
  NSData *data = [json dataUsingEncoding:NSUTF8StringEncoding];
  id decoded = data ? [NSJSONSerialization JSONObjectWithData:data options:0 error:nil] : nil;
  if (![decoded isKindOfClass:NSArray.class]) return;
  NSTimeInterval now = CACurrentMediaTime();
  for (NSDictionary *range in (NSArray *)decoded) {
    NSInteger start = [range[@"start"] integerValue];
    NSInteger end = [range[@"end"] integerValue];
    if (start < 0 || end <= start || end > _renderedText.length) continue;
    NSString *identifier = [NSString stringWithFormat:@"%ld:%ld:%ld", (long)_revision, (long)start, (long)end];
    if ([_seen containsObject:identifier]) continue;
    [_seen addObject:identifier];
    if (disabled) continue;
    _active[identifier] = [@{ @"start": @(start), @"end": @(end), @"startsAt": @(now + MAX(0, [range[@"delay"] doubleValue]) / 1000.0), @"animation": _animation ?: @"fadeIn", @"easing": _easing ?: @"linear" } mutableCopy];
  }
}

- (CGFloat)easedProgress:(NSDictionary *)item now:(NSTimeInterval)now
{
  CGFloat raw = MAX(0, MIN(1, (now - [item[@"startsAt"] doubleValue]) / MAX(_duration, 0.001)));
  NSString *easing = item[@"easing"];
  if ([easing isEqualToString:@"ease-in"]) return raw * raw;
  if ([easing isEqualToString:@"ease-out"]) return 1 - (1 - raw) * (1 - raw);
  if ([easing isEqualToString:@"ease-in-out"]) return raw < .5 ? 2 * raw * raw : 1 - pow(-2 * raw + 2, 2) / 2;
  return raw;
}

- (void)updateRevealRanges
{
  NSTimeInterval now = CACurrentMediaTime();
  NSMutableArray *ranges = [[NSMutableArray alloc] init];
  NSMutableArray *finished = [[NSMutableArray alloc] init];
  [_active enumerateKeysAndObjectsUsingBlock:^(NSString *key, NSMutableDictionary *item, __unused BOOL *stop) {
    CGFloat progress = [self easedProgress:item now:now];
    if (progress >= 1) [finished addObject:key];
    else [ranges addObject:@{ @"start": item[@"start"], @"end": item[@"end"], @"progress": @(progress), @"animation": item[@"animation"] }];
  }];
  [_active removeObjectsForKeys:finished];
  _layoutManager.revealRanges = ranges;
}

- (void)scheduleDisplayLink
{
  if (_active.count == 0 || _displayLink) return;
  _displayLink = [CADisplayLink displayLinkWithTarget:self selector:@selector(displayFrame:)];
  if (@available(iOS 15.0, *)) _displayLink.preferredFrameRateRange = CAFrameRateRangeMake(30, UIScreen.mainScreen.maximumFramesPerSecond, UIScreen.mainScreen.maximumFramesPerSecond);
  [_displayLink addToRunLoop:NSRunLoop.mainRunLoop forMode:NSRunLoopCommonModes];
}

- (void)displayFrame:(__unused CADisplayLink *)link
{
  [self updateRevealRanges];
  if (_active.count == 0) {
    [_displayLink invalidate];
    _displayLink = nil;
  }
}

- (void)prepareForRecycle
{
  [_displayLink invalidate];
  _displayLink = nil;
  [_active removeAllObjects];
  [_seen removeAllObjects];
  _renderedText = @"";
  _renderedRuns = @"[]";
  [super prepareForRecycle];
}

- (void)didMoveToWindow
{
  [super didMoveToWindow];
  if (self.window) {
    [self updateRevealRanges];
    [self scheduleDisplayLink];
  } else {
    [_displayLink invalidate];
    _displayLink = nil;
  }
}

- (BOOL)textView:(__unused UITextView *)textView shouldInteractWithURL:(NSURL *)URL inRange:(__unused NSRange)characterRange interaction:(__unused UITextItemInteraction)interaction API_AVAILABLE(ios(10.0))
{
  auto emitter = std::static_pointer_cast<const StreamdownTextEventEmitter>(_eventEmitter);
  if (emitter) emitter->onLinkPress({std::string(URL.absoluteString.UTF8String)});
  return NO;
}

@end
