#import "StreamdownRevealLayoutManager.h"

@implementation StreamdownRevealLayoutManager

- (void)setRevealRanges:(NSArray<NSDictionary *> *)revealRanges
{
  _revealRanges = [revealRanges copy];
  [self invalidateDisplayForCharacterRange:NSMakeRange(0, self.textStorage.length)];
}

- (void)drawGlyphsForGlyphRange:(NSRange)glyphs atPoint:(CGPoint)origin
{
  if (_revealRanges.count == 0) {
    [super drawGlyphsForGlyphRange:glyphs atPoint:origin];
    return;
  }
  NSMutableArray<NSDictionary *> *visible = [[NSMutableArray alloc] init];
  for (NSDictionary *item in _revealRanges) {
    NSRange characters = NSMakeRange([item[@"start"] unsignedIntegerValue], [item[@"end"] unsignedIntegerValue] - [item[@"start"] unsignedIntegerValue]);
    NSRange range = [self glyphRangeForCharacterRange:characters actualCharacterRange:nil];
    NSRange overlap = NSIntersectionRange(glyphs, range);
    if (overlap.length) [visible addObject:@{ @"range": [NSValue valueWithRange:overlap], @"progress": item[@"progress"] ?: @1, @"animation": item[@"animation"] ?: @"fadeIn" }];
  }
  [visible sortUsingComparator:^NSComparisonResult(NSDictionary *left, NSDictionary *right) {
    NSUInteger a = [left[@"range"] rangeValue].location;
    NSUInteger b = [right[@"range"] rangeValue].location;
    return a < b ? NSOrderedAscending : a > b ? NSOrderedDescending : NSOrderedSame;
  }];
  NSUInteger cursor = glyphs.location;
  NSUInteger limit = NSMaxRange(glyphs);
  for (NSDictionary *item in visible) {
    NSRange range = [item[@"range"] rangeValue];
    if (range.location > cursor) [super drawGlyphsForGlyphRange:NSMakeRange(cursor, range.location - cursor) atPoint:origin];
    CGFloat progress = [item[@"progress"] doubleValue];
    CGContextRef context = UIGraphicsGetCurrentContext();
    CGContextSaveGState(context);
    CGContextSetAlpha(context, MAX(0, MIN(1, progress)));
    if ([item[@"animation"] isEqualToString:@"slideUp"]) CGContextTranslateCTM(context, 0, (1 - progress) * 6);
    [super drawGlyphsForGlyphRange:range atPoint:origin];
    CGContextRestoreGState(context);
    cursor = MAX(cursor, NSMaxRange(range));
  }
  if (cursor < limit) [super drawGlyphsForGlyphRange:NSMakeRange(cursor, limit - cursor) atPoint:origin];
}

@end
