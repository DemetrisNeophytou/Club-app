import { Image, View } from "react-native";
import { palette } from "@portal/shared";

/**
 * The signature "portal arch" (spec §5): hero images clipped in an arch —
 * fully rounded at the top, square at the bottom.
 */
export function ArchImage({ uri, height = 220 }: { uri: string | null; height?: number }) {
  return (
    <View
      className="w-full overflow-hidden border border-line bg-deep"
      style={{
        height,
        borderTopLeftRadius: 999,
        borderTopRightRadius: 999,
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
      }}
    >
      {uri ? (
        <Image source={{ uri }} resizeMode="cover" style={{ width: "100%", height: "100%" }} />
      ) : (
        // Placeholder gradient-ish block until Storage images land
        <View style={{ flex: 1, backgroundColor: palette.card }} />
      )}
    </View>
  );
}
