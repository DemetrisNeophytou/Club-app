import { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { palette } from "@portal/shared";

const AnimatedView = Animated.View;

/**
 * The "portal ring" (spec §5): a slowly rotating copper→seaglass ring that
 * frames the QR. The rotation doubles as a liveness cue — a screenshot
 * doesn't move.
 */
export function PortalRing({ size, children }: { size: number; children: React.ReactNode }) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 6000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const ring = size + 36;

  return (
    <View style={{ width: ring, height: ring, alignItems: "center", justifyContent: "center" }}>
      <AnimatedView style={{ position: "absolute", transform: [{ rotate }] }}>
        <Svg width={ring} height={ring}>
          <Defs>
            <LinearGradient id="portal" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={palette.copperHi} />
              <Stop offset="0.6" stopColor={palette.copper} />
              <Stop offset="1" stopColor={palette.seaglass} />
            </LinearGradient>
          </Defs>
          <Circle
            cx={ring / 2}
            cy={ring / 2}
            r={(ring - 6) / 2}
            stroke="url(#portal)"
            strokeWidth={3}
            strokeDasharray={`${ring * 2.4} ${ring * 0.5}`}
            fill="none"
          />
        </Svg>
      </AnimatedView>
      <View className="items-center justify-center rounded-3xl bg-bone p-3">{children}</View>
    </View>
  );
}
