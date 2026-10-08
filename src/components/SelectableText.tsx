import React from 'react';
import { Text, TextProps } from 'react-native';

// Static text the user can copy with a long-press. Never use it inside a
// touchable, a swipeable row or a row with onLongPress, and only as the
// outermost Text (nested spans stay plain Text).
export function SelectableText(props: TextProps) {
    return <Text selectable {...props} />;
}
