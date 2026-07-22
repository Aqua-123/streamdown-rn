#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

NSAttributedString *SDAttributedText(NSString *text, NSString *runsJSON, NSString *direction);
CGSize SDMeasureAttributedText(NSString *text, NSString *runsJSON, NSString *direction, CGFloat maxWidth);

NS_ASSUME_NONNULL_END
