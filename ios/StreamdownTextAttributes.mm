#import "StreamdownTextAttributes.h"
#import <React/RCTConvert.h>

static NSArray<NSDictionary *> *SDJSONArray(NSString *json)
{
  NSData *data = [json dataUsingEncoding:NSUTF8StringEncoding];
  id value = data ? [NSJSONSerialization JSONObjectWithData:data options:0 error:nil] : nil;
  return [value isKindOfClass:NSArray.class] ? value : @[];
}

static UIColor *SDColor(id value)
{
  if (![value isKindOfClass:NSString.class]) return nil;
  @try { return [RCTConvert UIColor:value]; } @catch (__unused NSException *exception) { return nil; }
}

static UIFont *SDFont(UIFont *base, NSDictionary *run)
{
  CGFloat size = [run[@"fontSize"] respondsToSelector:@selector(doubleValue)] ? [run[@"fontSize"] doubleValue] : base.pointSize;
  size = [[UIFontMetrics defaultMetrics] scaledValueForValue:size];
  NSString *family = [run[@"fontFamily"] isKindOfClass:NSString.class] ? run[@"fontFamily"] : nil;
  NSString *weightValue = [run[@"fontWeight"] isKindOfClass:NSString.class] ? run[@"fontWeight"] : nil;
  NSString *style = [run[@"fontStyle"] isKindOfClass:NSString.class] ? run[@"fontStyle"] : nil;
  NSInteger numericWeight = weightValue.integerValue;
  UIFontWeight weight = ([weightValue isEqualToString:@"bold"] || numericWeight >= 600) ? UIFontWeightSemibold : UIFontWeightRegular;
  UIFont *font = family.length ? [UIFont fontWithName:family size:size] : [UIFont systemFontOfSize:size weight:weight];
  if (!font) font = [UIFont systemFontOfSize:size weight:weight];
  if ([style isEqualToString:@"italic"]) {
    UIFontDescriptor *descriptor = [font.fontDescriptor fontDescriptorWithSymbolicTraits:font.fontDescriptor.symbolicTraits | UIFontDescriptorTraitItalic];
    UIFont *italic = [UIFont fontWithDescriptor:descriptor size:size];
    if (italic) font = italic;
  }
  return font;
}

NSAttributedString *SDAttributedText(NSString *text, NSString *runsJSON, NSString *direction)
{
  NSMutableAttributedString *result = [[NSMutableAttributedString alloc] initWithString:text];
  NSRange full = NSMakeRange(0, text.length);
  if (full.length) [result addAttribute:NSFontAttributeName value:[UIFont systemFontOfSize:[[UIFontMetrics defaultMetrics] scaledValueForValue:16]] range:full];
  for (NSDictionary *run in SDJSONArray(runsJSON)) {
    NSInteger start = [run[@"start"] integerValue];
    NSInteger end = [run[@"end"] integerValue];
    if (start < 0 || end <= start || end > text.length) continue;
    NSRange range = NSMakeRange(start, end - start);
    UIColor *color = SDColor(run[@"color"]);
    UIColor *background = SDColor(run[@"backgroundColor"]);
    if (color) [result addAttribute:NSForegroundColorAttributeName value:color range:range];
    if (background) [result addAttribute:NSBackgroundColorAttributeName value:background range:range];
    UIFont *existing = [result attribute:NSFontAttributeName atIndex:range.location effectiveRange:nil] ?: [UIFont systemFontOfSize:16];
    if (run[@"fontSize"] || run[@"fontFamily"] || run[@"fontWeight"] || run[@"fontStyle"]) {
      [result addAttribute:NSFontAttributeName value:SDFont(existing, run) range:range];
    }
    if ([run[@"underline"] boolValue]) [result addAttribute:NSUnderlineStyleAttributeName value:@(NSUnderlineStyleSingle) range:range];
    if ([run[@"strikethrough"] boolValue]) [result addAttribute:NSStrikethroughStyleAttributeName value:@(NSUnderlineStyleSingle) range:range];
    if ([run[@"url"] isKindOfClass:NSString.class]) [result addAttribute:NSLinkAttributeName value:run[@"url"] range:range];
    if ([run[@"lineHeight"] respondsToSelector:@selector(doubleValue)]) {
      NSMutableParagraphStyle *paragraph = [[NSMutableParagraphStyle alloc] init];
      CGFloat height = [[UIFontMetrics defaultMetrics] scaledValueForValue:[run[@"lineHeight"] doubleValue]];
      paragraph.minimumLineHeight = height;
      paragraph.maximumLineHeight = height;
      NSString *alignment = [run[@"textAlign"] isKindOfClass:NSString.class] ? run[@"textAlign"] : nil;
      if ([alignment isEqualToString:@"center"]) paragraph.alignment = NSTextAlignmentCenter;
      else if ([alignment isEqualToString:@"right"]) paragraph.alignment = NSTextAlignmentRight;
      else if ([alignment isEqualToString:@"justify"]) paragraph.alignment = NSTextAlignmentJustified;
      [result addAttribute:NSParagraphStyleAttributeName value:paragraph range:range];
    } else if ([run[@"textAlign"] isKindOfClass:NSString.class]) {
      NSMutableParagraphStyle *paragraph = [[NSMutableParagraphStyle alloc] init];
      NSString *alignment = run[@"textAlign"];
      if ([alignment isEqualToString:@"center"]) paragraph.alignment = NSTextAlignmentCenter;
      else if ([alignment isEqualToString:@"right"]) paragraph.alignment = NSTextAlignmentRight;
      else if ([alignment isEqualToString:@"justify"]) paragraph.alignment = NSTextAlignmentJustified;
      [result addAttribute:NSParagraphStyleAttributeName value:paragraph range:range];
    }
  }
  if (full.length) {
    NSMutableArray<NSDictionary *> *paragraphRanges = [[NSMutableArray alloc] init];
    [result enumerateAttribute:NSParagraphStyleAttributeName inRange:full options:0 usingBlock:^(NSParagraphStyle *style, NSRange range, __unused BOOL *stop) {
      [paragraphRanges addObject:@{ @"style": style ?: NSNull.null, @"range": [NSValue valueWithRange:range] }];
    }];
    for (NSDictionary *item in paragraphRanges) {
      id storedStyle = item[@"style"];
      NSParagraphStyle *style = storedStyle == NSNull.null ? nil : storedStyle;
      NSRange range = [item[@"range"] rangeValue];
      NSMutableParagraphStyle *paragraph = style ? style.mutableCopy : [[NSMutableParagraphStyle alloc] init];
      paragraph.baseWritingDirection = [direction isEqualToString:@"rtl"] ? NSWritingDirectionRightToLeft : [direction isEqualToString:@"ltr"] ? NSWritingDirectionLeftToRight : NSWritingDirectionNatural;
      [result addAttribute:NSParagraphStyleAttributeName value:paragraph range:range];
    }
  }
  return result;
}

CGSize SDMeasureAttributedText(NSString *text, NSString *runsJSON, NSString *direction, CGFloat maxWidth)
{
  NSTextStorage *storage = [[NSTextStorage alloc] initWithAttributedString:SDAttributedText(text, runsJSON, direction)];
  NSLayoutManager *layout = [[NSLayoutManager alloc] init];
  NSTextContainer *container = [[NSTextContainer alloc] initWithSize:CGSizeMake(MAX(0, maxWidth), CGFLOAT_MAX)];
  container.lineFragmentPadding = 0;
  container.maximumNumberOfLines = 0;
  [layout addTextContainer:container];
  [storage addLayoutManager:layout];
  [layout ensureLayoutForTextContainer:container];
  CGRect used = [layout usedRectForTextContainer:container];
  return CGSizeMake(ceil(MIN(maxWidth, used.size.width)), ceil(used.size.height));
}
